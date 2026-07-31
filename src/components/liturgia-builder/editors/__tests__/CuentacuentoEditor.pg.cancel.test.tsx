/**
 * PG / G7 — Cancelación en el editor REAL (T-G.5 mitad de frontera, T-G.10,
 * T-G.11, T-G.12, T-G.13).
 *
 * Barra G7: se renderiza el `CuentacuentoEditor` de PRODUCCIÓN con el
 * `useStoryImagePipeline` de producción, el runner de producción, las nueve
 * factories de producción y los envoltorios de invocación de producción.
 * `use-toast` corre REAL — este archivo NO lo mockea.
 *
 * Único mock: el BORDE externo compartido de la fase (`pbBoundary`) —
 * Supabase auth / tablas / storage y la invocación de funciones pagas — más
 * `fetch` (el HEAD de verificación de existencia de PB). No se mockea el hook,
 * el runner, las factories, los colectores, los componentes hijos ni los
 * helpers de cancelación; no se llaman callbacks extraídos; no hay aserciones
 * sobre el texto del fuente ni sobre los imports.
 *
 * La señal medida es el BORDE PAGADO (`functions.invoke`) y lo que ve el
 * usuario en pantalla.
 *
 * Honestidad (G4): cancelar aborta la petición del cliente, resuelve la espera
 * local y prohíbe despachos futuros. NO revoca una petición ya despachada al
 * edge ni recupera su gasto — por eso T-G.13 ACEPTA el aviso tardío.
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import type { LiturgyContext } from '@/types/shared/liturgy';
import type { Story } from '@/types/shared/story';

vi.mock('@/integrations/supabase/client', async () => {
  const { makeSupabaseMock } = await import('@/lib/cuentacuentos/__tests__/pbBoundary');
  return { supabase: makeSupabaseMock() };
});

import {
  ctl,
  deletes,
  invokes,
  resetBoundary,
  upserts,
  type InvokeCall,
} from '@/lib/cuentacuentos/__tests__/pbBoundary';
import { EXISTING_DRAFTS_URL } from '@/lib/cuentacuentos/__tests__/pbImageFixtures';

// Producción — importada DESPUÉS del mock de borde.
import CuentacuentoEditor from '../CuentacuentoEditor';

const LITURGY_ID = 'lit-pg';

const CONTEXT: LiturgyContext = {
  id: LITURGY_ID,
  date: new Date('2026-06-07'),
  title: 'Liturgia PG',
  readings: [],
  summary: '',
  preacher: 'Pastor Test',
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
};

type BoundaryResult = { data: unknown; error: unknown };

const okImages = (n = 2): BoundaryResult => ({
  data: { success: true, images: Array.from({ length: n }, () => EXISTING_DRAFTS_URL) },
  error: null,
});

/**
 * `initialStory` con N escenas. Las escenas listadas en `scenesWithImages`
 * llegan con una URL de Storage YA EXISTENTE, que el efecto de siembra copia a
 * las opciones del editor sin re-subir nada.
 */
function makeStory(
  id: string,
  status: string,
  opts: { sceneCount: number; scenesWithImages?: number[] },
): Story {
  const { sceneCount, scenesWithImages = [] } = opts;
  return {
    id,
    title: `Cuento ${id}`,
    summary: 'Resumen breve',
    location: { name: 'Jerusalén' } as unknown as Story['location'],
    illustrationStyle: 'ghibli',
    characters: [
      {
        id: 'char-1',
        name: 'María',
        role: 'protagonist',
        description: 'Niña curiosa',
        visualDescription: 'niña con vestido azul',
        characterSheetUrl: EXISTING_DRAFTS_URL,
      } as unknown as Story['characters'][number],
    ],
    scenes: Array.from({ length: sceneCount }, (_, i) => {
      const number = i + 1;
      return {
        number,
        text: `Texto de la escena ${number}`,
        visualDescription: `Descripción visual ${number}`,
        ...(scenesWithImages.includes(number) ? { selectedImageUrl: EXISTING_DRAFTS_URL } : {}),
      } as unknown as Story['scenes'][number];
    }),
    props: [] as unknown as Story['props'],
    spiritualConnection: 'Esperanza',
    metadata: { createdAt: '', updatedAt: '', status: status as Story['metadata']['status'] },
  } as unknown as Story;
}

const sceneImagesInvokes = () => invokes.filter((c) => c.fn === 'generate-scene-images');
const invokesOfType = (type: string) =>
  sceneImagesInvokes().filter((c) => c.body.type === type);
const sceneNumberOf = (call: InvokeCall) =>
  Number(String((call.body.scene as { text?: string } | undefined)?.text ?? '').replace(/\D+/g, ''));

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  promise.catch(() => {});
  return { promise, resolve, reject };
}

async function yields(n: number) {
  for (let i = 0; i < n; i++) await Promise.resolve();
}
/** Deja correr timers REALES — el stagger del runner son 400 ms por worker. */
async function settle(ms: number) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
    await yields(30);
  });
}

beforeEach(() => {
  resetBoundary();
  ctl.userId = 'user-pg';
  ctl.draftRow = null;
  ctl.invokeHandler = async () => okImages();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response));
  vi.useRealTimers();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Arranca el lote real de escenas desde el banner del paso `scenes`. */
async function startSceneBatch() {
  const button = await screen.findByRole(
    'button',
    { name: /Generar (todas las escenas|escenas faltantes)/i },
    { timeout: 10000 },
  );
  await act(async () => {
    fireEvent.click(button);
    await yields(40);
  });
}

/** Pulsa el Cancelar visible (debe haber exactamente uno). */
async function clickCancelar() {
  const buttons = screen.getAllByRole('button', { name: 'Cancelar' });
  expect(buttons).toHaveLength(1);
  expect((buttons[0] as HTMLButtonElement).disabled).toBe(false);
  await act(async () => {
    fireEvent.click(buttons[0]);
    await yields(40);
  });
}

/**
 * Lleva el editor REAL al paso `cover` aprobando escenas: es el camino de
 * producción que además ARMA el auto-arranque del lote portada+fin.
 */
async function approveScenesIntoCoverStep() {
  const approve = await screen.findByRole(
    'button',
    { name: /Aprobar escenas/i },
    { timeout: 10000 },
  );
  await act(async () => {
    fireEvent.click(approve);
    await yields(60);
  });
  await waitFor(
    () => expect(screen.queryByRole('button', { name: /Aprobar escenas/i })).toBeNull(),
    { timeout: 10000 },
  );
}

// =============================================================================
// T-G.5 (mitad de frontera) — la señal del runner llega a functions.invoke
// =============================================================================

describe('T-G.5 (frontera) — `supabase.functions.invoke` recibe la señal VIVA de la corrida', () => {
  it('cada llamada viaja con `{body, signal}`; todas las de una corrida comparten la MISMA instancia, viva durante la llamada y abortada por el Cancelar real', async () => {
    ctl.invokeHandler = () => new Promise<BoundaryResult>(() => {});
    render(
      <CuentacuentoEditor
        context={CONTEXT}
        initialStory={makeStory('story-g5', 'characters-approved', { sceneCount: 3 })}
        onStoryCreated={vi.fn()}
      />,
    );
    await startSceneBatch();
    // Los workers 1 y 2 arrancan escalonados (400 ms / 800 ms).
    await settle(1000);

    const calls = invokesOfType('scene');
    expect(calls.length).toBeGreaterThanOrEqual(2);
    // Cada llamada lleva su señal, y es la MISMA instancia: el runner mintea
    // UN controlador por corrida — no uno por tarea, ni una copia, ni un
    // booleano derivado.
    for (const c of calls) expect(c.signal).toBeInstanceOf(AbortSignal);
    expect(new Set(calls.map((c) => c.signal)).size).toBe(1);
    for (const c of calls) expect(c.signal!.aborted).toBe(false);

    await clickCancelar();

    for (const c of calls) expect(c.signal!.aborted).toBe(true);
  }, 30000);
});

// =============================================================================
// T-G.10 — Lote de escenas real: cancelar, reanudar, sin auto-arranque
// =============================================================================

describe('T-G.10 — cancelación y reanudación reales del lote de escenas', () => {
  it('cancelar detiene el retiro de tareas; lo no aplicado vuelve al conteo exacto de faltantes y sólo eso se re-despacha', async () => {
    // La escena 1 responde; las demás ignoran la señal y nunca terminan.
    ctl.invokeHandler = async (call) =>
      sceneNumberOf(call) === 1 ? okImages() : new Promise<BoundaryResult>(() => {});

    render(
      <CuentacuentoEditor
        context={CONTEXT}
        initialStory={makeStory('story-g10', 'characters-approved', { sceneCount: 4 })}
        onStoryCreated={vi.fn()}
      />,
    );

    // Arranca con las cuatro escenas faltantes.
    expect(
      await screen.findByRole('button', { name: /Generar todas las escenas/i }, { timeout: 10000 }),
    ).toBeTruthy();
    await startSceneBatch();
    await settle(1200);

    const beforeCancel = invokesOfType('scene').length;
    expect(beforeCancel).toBe(4);

    // Antes de cancelar, las tres escenas no aplicadas reportan generación en
    // curso (la escena 1 ya aplicó y ofrece "Regenerar").
    expect(screen.getAllByRole('button', { name: /Generando\.\.\./ })).toHaveLength(3);

    await clickCancelar();

    // MITAD DE ESTADO: ninguna tarjeta queda con el spinner colgado. Sin la
    // normalización, las tres escenas no aplicadas se quedan en `running` para
    // siempre y siguen diciendo "Generando..." aunque no haya nada corriendo.
    expect(screen.queryAllByRole('button', { name: /Generando\.\.\./ })).toHaveLength(0);
    expect(screen.getAllByRole('button', { name: /^Generar$/ })).toHaveLength(3);

    // El retiro de tareas se detuvo: ni el tiempo ni los staggers residuales
    // producen despachos nuevos.
    await settle(1200);
    expect(invokesOfType('scene').length).toBe(beforeCancel);
    expect(screen.queryAllByRole('button', { name: /Generando\.\.\./ })).toHaveLength(0);

    // Lo cancelado y NO aplicado vuelve al conteo derivado de estado; la
    // escena 1, que sí se aplicó, se conserva.
    const resume = await screen.findByRole(
      'button',
      { name: /Generar escenas faltantes \(3\)/i },
      { timeout: 10000 },
    );
    expect((resume as HTMLButtonElement).disabled).toBe(false);

    // Reanudar despacha SÓLO las escenas que siguen sin opciones.
    invokes.length = 0;
    ctl.invokeHandler = async () => okImages();
    await act(async () => {
      fireEvent.click(resume);
      await yields(40);
    });
    await settle(1200);

    const resumed = invokesOfType('scene');
    expect(resumed).toHaveLength(3);
    expect(resumed.map(sceneNumberOf).sort()).toEqual([2, 3, 4]);
  }, 40000);

  it('tras el cancel de usuario ningún auto-arranque revive el lote por su cuenta', async () => {
    ctl.invokeHandler = () => new Promise<BoundaryResult>(() => {});
    render(
      <CuentacuentoEditor
        context={CONTEXT}
        initialStory={makeStory('story-g10b', 'characters-approved', { sceneCount: 3 })}
        onStoryCreated={vi.fn()}
      />,
    );
    await startSceneBatch();
    await settle(1000);

    await clickCancelar();
    const afterCancel = sceneImagesInvokes().length;

    // Ventana amplia: un auto-arranque espontáneo aparecería acá.
    await settle(1600);
    expect(sceneImagesInvokes().length).toBe(afterCancel);
    // Y el paso quedó OFRECIENDO el lote, no corriéndolo.
    expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull();
    expect(
      screen.getByRole('button', { name: /Generar todas las escenas/i }),
    ).toBeTruthy();
  }, 40000);
});

// =============================================================================
// T-G.11 — Control real de portada/fin y recolectabilidad
// =============================================================================

describe('T-G.11 — el paso portada/fin expone su Cancelar y vuelve a un estado recolectable', () => {
  it('con la portada EN VUELO y el fin en STAGGER hay UN solo Cancelar habilitado; al pulsarlo no hay más despachos, ambos quedan ociosos y el gate de finalización deja de trabarse', async () => {
    const coverGate = deferred<BoundaryResult>();
    ctl.invokeHandler = async (call) =>
      call.body.type === 'cover' ? coverGate.promise : new Promise<BoundaryResult>(() => {});

    render(
      <CuentacuentoEditor
        context={CONTEXT}
        initialStory={makeStory('story-g11', 'scenes-pending', {
          sceneCount: 1,
          scenesWithImages: [1],
        })}
        onStoryCreated={vi.fn()}
      />,
    );
    await approveScenesIntoCoverStep();

    // El auto-arranque de la aprobación encoló portada + fin.
    await waitFor(() => expect(invokesOfType('cover')).toHaveLength(1), { timeout: 10000 });
    // La portada está EN VUELO y el fin todavía DUERME su stagger (400 ms).
    expect(invokesOfType('end')).toHaveLength(0);

    const cancelButtons = screen.getAllByRole('button', { name: 'Cancelar' });
    expect(cancelButtons).toHaveLength(1);
    expect((cancelButtons[0] as HTMLButtonElement).disabled).toBe(false);
    // Copy visible y nombre accesible EXACTOS (D8).
    expect(cancelButtons[0].textContent).toBe('Cancelar');
    // Y la portada, en vuelo, sí reporta su spinner.
    expect(screen.getAllByRole('button', { name: /Generando\.\.\./ })).toHaveLength(1);

    // Antes de cancelar, el gate de finalización está cerrado POR LA CORRIDA.
    const finalizar = screen.getByRole('button', { name: /Finalizar cuento/i });
    expect((finalizar as HTMLButtonElement).disabled).toBe(true);
    expect(finalizar.getAttribute('title')).toBe('Espera a que termine la generación en curso');

    await clickCancelar();

    // El worker del fin despierta dentro de una corrida ya cancelada: no
    // despacha nada, ni cuando vence su stagger.
    await settle(1000);
    expect(invokesOfType('end')).toHaveLength(0);
    expect(invokesOfType('cover')).toHaveLength(1);

    // El control desaparece con la corrida y los ítems vuelven a estado
    // ocioso/recolectable SIN remontar: ningún spinner colgado y ambos
    // controles de generación quedan libres.
    expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull();
    expect(screen.queryAllByRole('button', { name: /Generando\.\.\./ })).toHaveLength(0);
    const generarPortada = screen.getByRole('button', { name: /Generar portada/i });
    expect((generarPortada as HTMLButtonElement).disabled).toBe(false);
    const generarFin = screen.getByRole('button', { name: /Generar "Fin"/i });
    expect((generarFin as HTMLButtonElement).disabled).toBe(false);

    // El gate de finalización ya NO se traba en un `running` fantasma.
    const finalizar2 = screen.getByRole('button', { name: /Finalizar cuento/i });
    expect(finalizar2.getAttribute('title')).not.toBe(
      'Espera a que termine la generación en curso',
    );

    coverGate.resolve(okImages(4));
    await settle(200);
  }, 40000);

  it('con la portada en BACKOFF (falla reintentable) el Cancelar sigue disponible y corta el intento siguiente', async () => {
    let coverAttempts = 0;
    ctl.invokeHandler = async (call) => {
      if (call.body.type === 'cover') {
        coverAttempts++;
        return { data: null, error: new Error('502 transitorio') };
      }
      return new Promise<BoundaryResult>(() => {});
    };

    render(
      <CuentacuentoEditor
        context={CONTEXT}
        initialStory={makeStory('story-g11b', 'scenes-pending', {
          sceneCount: 1,
          scenesWithImages: [1],
        })}
        onStoryCreated={vi.fn()}
      />,
    );
    await approveScenesIntoCoverStep();

    await waitFor(() => expect(coverAttempts).toBe(1), { timeout: 10000 });
    // El backoff base son 2 s: acá la portada ESPERA, no está en vuelo.
    await settle(300);
    expect(coverAttempts).toBe(1);

    await clickCancelar();

    // El intento 2 nunca sale, ni siquiera pasado el backoff completo.
    await settle(3200);
    expect(coverAttempts).toBe(1);
    expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull();
    // Y el ítem quedó OCIOSO, no en error: su control queda libre.
    const generarFin = screen.getByRole('button', { name: /Generar "Fin"/i });
    expect((generarFin as HTMLButtonElement).disabled).toBe(false);
  }, 50000);

  it('cancelar NO interrumpe el trabajo ya aplicado: la portada persiste igual y sus opciones sobreviven', async () => {
    ctl.invokeHandler = async (call) =>
      call.body.type === 'cover' ? okImages(4) : new Promise<BoundaryResult>(() => {});

    render(
      <CuentacuentoEditor
        context={CONTEXT}
        initialStory={makeStory('story-g11c', 'scenes-pending', {
          sceneCount: 1,
          scenesWithImages: [1],
        })}
        onStoryCreated={vi.fn()}
      />,
    );
    await approveScenesIntoCoverStep();
    await waitFor(() => expect(invokesOfType('cover')).toHaveLength(1), { timeout: 10000 });

    // La portada YA aplicó: su placeholder desapareció.
    await waitFor(
      () => expect(screen.queryByText(/Genera o sube opciones de portada/i)).toBeNull(),
      { timeout: 10000 },
    );
    const upsertsBefore = upserts.length;

    const cancelar = screen.queryByRole('button', { name: 'Cancelar' });
    if (cancelar) {
      await act(async () => {
        fireEvent.click(cancelar);
        await yields(40);
      });
    }
    await settle(400);

    // Lo aplicado no se revierte y su escritura llegó a destino.
    expect(screen.queryByText(/Genera o sube opciones de portada/i)).toBeNull();
    expect(upserts.length).toBeGreaterThanOrEqual(upsertsBefore);
    expect(upserts.length).toBeGreaterThan(0);
    // Y el fin, que nunca llegó a aplicar, quedó ocioso y recolectable.
    const generarFin = screen.getByRole('button', { name: /Generar "Fin"/i });
    expect((generarFin as HTMLButtonElement).disabled).toBe(false);
  }, 40000);
});

// =============================================================================
// T-G.12 — Cancel de usuario vs lifecycle destructivo
// =============================================================================

describe('T-G.12 — el cancel de usuario NO es una operación destructiva', () => {
  it('cero borrados de borrador, el cuento sigue en pantalla, y la reanudación APLICA (identidad {storyId, epoch} intacta)', async () => {
    ctl.invokeHandler = () => new Promise<BoundaryResult>(() => {});

    render(
      <CuentacuentoEditor
        context={CONTEXT}
        initialStory={makeStory('story-g12', 'characters-approved', { sceneCount: 2 })}
        onStoryCreated={vi.fn()}
      />,
    );
    await startSceneBatch();
    await settle(700);
    expect(invokesOfType('scene').length).toBeGreaterThanOrEqual(1);

    const deletesBefore = deletes.length;
    await clickCancelar();
    await settle(300);

    // (1) Ninguna baja de borrador: el cancel de usuario no es delete ni
    //     regenerate.
    expect(deletes.length).toBe(deletesBefore);
    // (2) El cuento sigue vivo: el paso de escenas se sigue renderizando, no
    //     el formulario de configuración de un editor sin story.
    expect(screen.getByText(/Texto de la escena 1/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Generar cuento con IA/i })).toBeNull();

    // (3) Prueba de que NO hubo bump de época: al reanudar, los resultados
    //     APLICAN. Con una época nueva la guardia de identidad de `apply`
    //     devolvería APPLY_STALE y el conteo de faltantes no bajaría jamás.
    ctl.invokeHandler = async () => okImages();
    const resume = await screen.findByRole(
      'button',
      { name: /Generar todas las escenas/i },
      { timeout: 10000 },
    );
    await act(async () => {
      fireEvent.click(resume);
      await new Promise((r) => setTimeout(r, 3000));
      await yields(40);
    });

    // Ambas escenas aplicaron: el banner de faltantes desaparece por completo.
    await waitFor(
      () =>
        expect(
          screen.queryByRole('button', {
            name: /Generar (todas las escenas|escenas faltantes)/i,
          }),
        ).toBeNull(),
      { timeout: 15000 },
    );
    expect(upserts.length).toBeGreaterThan(0);
  }, 40000);

  it('las entradas save-failed, su conteo SCOPEADO y el gate de aprobación sobreviven al cancel de usuario', async () => {
    // Escenas 1 y 2 generan y aplican, pero su persistencia FALLA; la 3 se
    // queda en vuelo para que la corrida siga activa y exista el Cancelar.
    ctl.invokeHandler = async (call) =>
      sceneNumberOf(call) === 3 ? new Promise<BoundaryResult>(() => {}) : okImages();

    render(
      <CuentacuentoEditor
        context={CONTEXT}
        initialStory={makeStory('story-g12b', 'characters-approved', { sceneCount: 3 })}
        onStoryCreated={vi.fn()}
      />,
    );
    await screen.findByRole('button', { name: /Generar todas las escenas/i }, { timeout: 10000 });
    ctl.upsertError = { message: 'no se pudo guardar' };

    await startSceneBatch();
    await waitFor(
      () => expect(screen.queryByRole('button', { name: /Reintentar fallidas \(2\)/i })).toBeNull(),
      { timeout: 3000 },
    ).catch(() => {});
    await settle(1600);

    // Estado previo: dos guardados fallidos y el gate de aprobación cerrado
    // POR ellos (el conteo que lo cierra sale del registry SCOPEADO a la
    // identidad viva {storyId, epoch}).
    const blockedTitle = 'Hay imágenes sin guardar; reintenta antes de aprobar';
    const approveBefore = screen.getByRole('button', { name: /Aprobar escenas/i });
    expect(approveBefore.getAttribute('title')).toBe(blockedTitle);

    const deletesBefore = deletes.length;
    await clickCancelar();
    await settle(300);

    // El cancel de USUARIO no invalida nada: sin bump de época ni purga del
    // registry, el conteo scopeado sigue cerrando el gate y "Reintentar
    // guardado" sigue ofreciéndose.
    const approveAfter = screen.getByRole('button', { name: /Aprobar escenas/i });
    expect(approveAfter.getAttribute('title')).toBe(blockedTitle);
    expect(screen.getByRole('button', { name: /Reintentar fallidas \(2\)/i })).toBeTruthy();
    expect(deletes.length).toBe(deletesBefore);
  }, 40000);
});

// =============================================================================
// T-G.13 — Residuo de aviso ACEPTADO
// =============================================================================

describe('T-G.13 — aviso tardío aceptado, imagen tardía descartada', () => {
  it('una respuesta tardía con `skippedImages` real sigue avisando (acumula y deduplica) pero su imagen NO se aplica; un aborto sin envelope no inventa aviso', async () => {
    const gates = new Map<number, ReturnType<typeof deferred<BoundaryResult>>>();
    ctl.invokeHandler = async (call) => {
      const d = deferred<BoundaryResult>();
      gates.set(sceneNumberOf(call), d);
      return d.promise;
    };

    render(
      <CuentacuentoEditor
        context={CONTEXT}
        initialStory={makeStory('story-g13', 'characters-approved', { sceneCount: 3 })}
        onStoryCreated={vi.fn()}
      />,
    );
    await startSceneBatch();
    await settle(1200);
    expect(gates.size).toBe(3);
    expect(
      screen.queryByText(/foto de referencia no se usó|fotos de referencia no se usaron/i),
    ).toBeNull();

    await clickCancelar();

    // (a) Respuesta TARDÍA de una llamada YA DESPACHADA que ignoró la señal y
    //     reporta un descarte REAL: el aviso se mantiene (PFE congelado).
    await act(async () => {
      gates.get(1)!.resolve({
        data: {
          success: true,
          images: [EXISTING_DRAFTS_URL],
          skippedImages: [{ field: 'characters[0].referenceImage', code: 'FETCH_FAILED' }],
        },
        error: null,
      });
      await yields(60);
    });
    const notice = await screen.findByText('Una foto de referencia no se usó', { timeout: 10000 });
    const box = notice.parentElement!.parentElement!;
    expect(
      within(box).getByText('el personaje 1: no se pudo recuperar; puede que se haya borrado.'),
    ).toBeTruthy();

    // …y su IMAGEN se descarta: las tres escenas siguen sin opciones.
    expect(screen.getByRole('button', { name: /Generar todas las escenas/i })).toBeTruthy();

    // (b) Duplicado exacto ⇒ deduplicado por `field:code` (sigue en 1).
    await act(async () => {
      gates.get(2)!.resolve({
        data: {
          success: true,
          images: [EXISTING_DRAFTS_URL],
          skippedImages: [{ field: 'characters[0].referenceImage', code: 'FETCH_FAILED' }],
        },
        error: null,
      });
      await yields(60);
    });
    await settle(80);
    expect(screen.queryByText('Una foto de referencia no se usó')).toBeTruthy();

    // (c) Un reporte NUEVO acumula sobre el anterior (no reemplaza).
    await act(async () => {
      gates.get(3)!.resolve({
        data: {
          success: true,
          images: [EXISTING_DRAFTS_URL],
          skippedImages: [{ field: 'props[0].referenceImages[0]', code: 'IMAGE_TOO_LARGE' }],
        },
        error: null,
      });
      await yields(60);
    });
    const notice2 = await screen.findByText('2 fotos de referencia no se usaron', {
      timeout: 10000,
    });
    const box2 = notice2.parentElement!.parentElement!;
    expect(
      within(box2).getByText('el personaje 1: no se pudo recuperar; puede que se haya borrado.'),
    ).toBeTruthy();
    expect(within(box2).getByText('el objeto 1, foto 1: pesa más de lo permitido.')).toBeTruthy();
    // Ninguna escena aplicó: el lote sigue completo por generar.
    expect(screen.getByRole('button', { name: /Generar todas las escenas/i })).toBeTruthy();
  }, 50000);

  it('un aborto SIN envelope no inventa ningún aviso', async () => {
    const gates = new Map<number, ReturnType<typeof deferred<BoundaryResult>>>();
    ctl.invokeHandler = async (call) => {
      const d = deferred<BoundaryResult>();
      gates.set(sceneNumberOf(call), d);
      return d.promise;
    };

    render(
      <CuentacuentoEditor
        context={CONTEXT}
        initialStory={makeStory('story-g13b', 'characters-approved', { sceneCount: 2 })}
        onStoryCreated={vi.fn()}
      />,
    );
    await startSceneBatch();
    await settle(700);
    await clickCancelar();

    // La invocación abortada rechaza SIN cuerpo de contrato.
    await act(async () => {
      gates.get(1)!.reject(new DOMException('The operation was aborted', 'AbortError'));
      await yields(60);
    });
    await settle(300);

    expect(
      screen.queryByText(/foto de referencia no se usó|fotos de referencia no se usaron/i),
    ).toBeNull();
    // Y el ítem quedó ocioso/recolectable, no en error.
    expect(screen.getByRole('button', { name: /Generar todas las escenas/i })).toBeTruthy();
  }, 40000);
});
