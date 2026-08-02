/**
 * PH / G5 — La garantía imperativa de concurrencia en portada/fin (T-H.5).
 *
 * `reserveRun` desplaza la corrida GLOBAL: mintea un token nuevo, barre lo
 * `running` a `pending` y ABORTA el controlador anterior
 * (`storyImagePipelineRunner.ts`). Por eso, tras arrancar la portada, el ítem
 * `end` sigue OCIOSO: una guarda por `statusOf(id)` deja pasar el clic que
 * aborta un lote pro ya despachado — y ese gasto no se recupera. La guarda
 * tiene que ser la consulta VIVA `pipeline.isBusy()`.
 *
 * Los selectores de esta suite son AGNÓSTICOS DE COPY a propósito: buscan "el
 * control que arranca un lote de portada/fin", no una etiqueta. Así el mismo
 * gesto de usuario corre contra `8ceec7c` (donde el control dice `Regenerar` /
 * `No me gustan…`) y contra la cabeza, y el base-red mide el DESPLAZAMIENTO
 * real de hoy en vez de la ausencia de un botón nuevo. La copy la fija T-H.4.
 *
 * BARRA G9: editor, hook, runner y factories de PRODUCCIÓN; el único doble es
 * el borde externo compartido (`pbBoundary`) y `fetch`.
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.mock('@/integrations/supabase/client', async () => {
  const { makeSupabaseMock } = await import('@/lib/cuentacuentos/__tests__/pbBoundary');
  return { supabase: makeSupabaseMock() };
});

import {
  ctl,
  resetBoundary,
  type InvokeCall,
  type UpsertCall,
} from '@/lib/cuentacuentos/__tests__/pbBoundary';
import {
  CONTEXT,
  approveScenesIntoCoverStep,
  deferred,
  invokesOfType,
  makeStory,
  okImages,
  settle,
  yields,
  type BoundaryResult,
} from '@/lib/cuentacuentos/__tests__/phFixtures';

// Producción — importada DESPUÉS del mock de borde.
import CuentacuentoEditor from '../CuentacuentoEditor';

const DRAFTS = 'https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-ph/lit-ph';
const img = (name: string) => `${DRAFTS}/${name}.png`;

beforeEach(() => {
  resetBoundary();
  ctl.userId = 'user-ph';
  ctl.draftRow = null;
  ctl.invokeHandler = async (call: InvokeCall) =>
    okImages(img(`${call.body.type}-1`), img(`${call.body.type}-2`));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response));
  vi.useRealTimers();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function panelFor(heading: RegExp): HTMLElement {
  const h = screen.getByRole('heading', { name: heading });
  const panel = h.closest('div.rounded-lg');
  if (!panel) throw new Error(`sin panel para ${heading}`);
  return panel as HTMLElement;
}
const coverPanel = () => panelFor(/Portada/i);
const endPanel = () => panelFor(/Imagen final|Fin/i);

/**
 * El control de HEADER que arranca un lote para esa categoría, en CUALQUIERA
 * de sus estados y en cualquiera de las dos revisiones. Es un solo botón: el
 * texto cambia (`2 más` / `Regenerar` / `Generando...` / `Guardando...` /
 * `Generar portada`), la identidad no. Se afirma unicidad para que el helper
 * no pueda estar leyendo otro control por accidente.
 */
const HEADER_LABELS =
  /^(2 más|Regenerar|Generando\.\.\.|Guardando\.\.\.|Generar portada|Generar "Fin")$/;

function headerControl(panel: HTMLElement): HTMLButtonElement {
  const candidatos = within(panel)
    .getAllByRole('button')
    .filter((b) => HEADER_LABELS.test((b.textContent ?? '').trim()));
  expect(candidatos).toHaveLength(1);
  return candidatos[0] as HTMLButtonElement;
}

const SELECTOR_LABELS =
  /^(Generar 2 opciones adicionales|No me gustan, generar otras opciones)$/;

/** El control de regenerar DENTRO del `ImageSelector`, o `null` si no está. */
function selectorControlOrNull(panel: HTMLElement): HTMLButtonElement | null {
  const candidatos = within(panel)
    .queryAllByRole('button')
    .filter((b) => SELECTOR_LABELS.test((b.textContent ?? '').trim()));
  return (candidatos[0] as HTMLButtonElement) ?? null;
}

function selectorControl(panel: HTMLElement): HTMLButtonElement {
  const control = selectorControlOrNull(panel);
  if (!control) throw new Error('sin control de regenerar en el ImageSelector');
  return control;
}

async function renderWithFirstBatch(id: string) {
  render(
    <CuentacuentoEditor
      context={CONTEXT}
      initialStory={makeStory(id)}
      onStoryCreated={vi.fn()}
    />,
  );
  await approveScenesIntoCoverStep();
  await waitFor(() => expect(invokesOfType('cover')).toHaveLength(1), { timeout: 10000 });
  await waitFor(() => expect(invokesOfType('end')).toHaveLength(1), { timeout: 10000 });
  await settle(600);
}

/** Deja el borde pagado PARQUEADO: todo lote siguiente queda en vuelo. */
function parkProvider() {
  ctl.invokeHandler = () => new Promise<BoundaryResult>(() => {});
}

/** Dos clics en el MISMO tick: sin ceder el hilo entre uno y otro. */
async function doubleClickSameTick(getButton: () => Element) {
  await act(async () => {
    fireEvent.click(getButton());
    fireEvent.click(getButton());
    await yields(40);
  });
}

const SURFACES = [
  { nombre: 'header portada', panel: coverPanel, control: headerControl, tipo: 'cover' },
  { nombre: 'header fin', panel: endPanel, control: headerControl, tipo: 'end' },
  { nombre: 'ImageSelector portada', panel: coverPanel, control: selectorControl, tipo: 'cover' },
  { nombre: 'ImageSelector fin', panel: endPanel, control: selectorControl, tipo: 'end' },
];

// =============================================================================
// T-H.5 (a) — Doble clic en la MISMA superficie
// =============================================================================

describe('T-H.5 — dos clics en el mismo control producen UNA sola corrida', () => {
  it.each(SURFACES)(
    '$nombre: el segundo clic no despacha ni aborta el lote en vuelo',
    async ({ panel, control, tipo }) => {
      await renderWithFirstBatch(`ph-h5-doble-${tipo}`);
      const antes = invokesOfType(tipo).length;
      parkProvider();

      await doubleClickSameTick(() => control(panel()));
      await settle(600);

      const despues = invokesOfType(tipo);
      // UN solo despacho nuevo: el segundo clic se topa con la guarda viva.
      expect(despues.length - antes).toBe(1);
      // Y CERO desplazamiento: la señal del lote en vuelo sigue viva. Sin la
      // guarda, `reserveRun` del segundo clic habría abortado ésta.
      expect(despues[despues.length - 1].signal!.aborted).toBe(false);
    },
    60000,
  );
});

// =============================================================================
// T-H.5 (b) — La carrera cover↔end, que una guarda por ítem NO cierra
// =============================================================================

describe('T-H.5 — la secuencia cover↔end en el mismo tick no desplaza la corrida global', () => {
  it.each([
    { primero: 'cover' as const, segundo: 'end' as const },
    { primero: 'end' as const, segundo: 'cover' as const },
  ])(
    '$primero → $segundo: sólo el primero despacha, y su señal NO queda abortada',
    async ({ primero, segundo }) => {
      await renderWithFirstBatch(`ph-h5-carrera-${primero}`);
      const antesCover = invokesOfType('cover').length;
      const antesEnd = invokesOfType('end').length;
      parkProvider();

      const panelDe = (t: 'cover' | 'end') => (t === 'cover' ? coverPanel() : endPanel());
      // Mismo tick: el usuario alcanza el segundo control antes de que el
      // primero llegue a re-renderizar como deshabilitado.
      await act(async () => {
        fireEvent.click(headerControl(panelDe(primero)));
        fireEvent.click(headerControl(panelDe(segundo)));
        await yields(40);
      });
      await settle(800);

      const cover = invokesOfType('cover');
      const end = invokesOfType('end');
      const nuevosCover = cover.length - antesCover;
      const nuevosEnd = end.length - antesEnd;

      // UNA sola invocación en total: la del control que llegó primero.
      expect(nuevosCover + nuevosEnd).toBe(1);
      expect(primero === 'cover' ? nuevosCover : nuevosEnd).toBe(1);
      expect(segundo === 'cover' ? nuevosCover : nuevosEnd).toBe(0);

      // El lote que SÍ salió no fue abortado por el segundo clic. Éste es el
      // gasto pro que la guarda por ítem tiraba a la basura.
      const enVuelo = primero === 'cover' ? cover[cover.length - 1] : end[end.length - 1];
      expect(enVuelo.signal!.aborted).toBe(false);
    },
    60000,
  );
});

// =============================================================================
// T-H.5 (c) — Matriz de inaccesibilidad
// =============================================================================

describe('T-H.5 — las cuatro superficies quedan inaccesibles mientras hay trabajo en curso', () => {
  it('con el lote GENERANDO: el header está deshabilitado y el ImageSelector es un spinner', async () => {
    await renderWithFirstBatch('ph-h5-running');
    parkProvider();

    await act(async () => {
      fireEvent.click(headerControl(coverPanel()));
      await yields(40);
    });
    await settle(200);

    // Header de la categoría en vuelo: deshabilitado.
    expect(headerControl(coverPanel()).disabled).toBe(true);
    // El panel entero del `ImageSelector` es el placeholder de generación: su
    // botón de regenerar ya no existe en el DOM.
    expect(selectorControlOrNull(coverPanel())).toBeNull();
    expect(within(coverPanel()).getByText(/Generando portada/)).toBeTruthy();
  }, 60000);

  it('con el snapshot PERSISTIENDO: el header sigue deshabilitado y el selector sigue siendo placeholder', async () => {
    await renderWithFirstBatch('ph-h5-persisting');

    // El proveedor responde, pero la ESCRITURA del borrador queda parqueada:
    // el ítem se queda en `persisting` de verdad.
    const gate = deferred<void>();
    ctl.invokeHandler = async () => okImages(img('cover-n1'), img('cover-n2'));
    ctl.upsertGate = (call: UpsertCall) =>
      call.table === 'cuentacuentos_drafts' ? gate.promise : undefined;

    await act(async () => {
      fireEvent.click(headerControl(coverPanel()));
      await yields(40);
    });
    await settle(400);

    expect(headerControl(coverPanel()).disabled).toBe(true);
    expect(selectorControlOrNull(coverPanel())).toBeNull();
    expect(within(coverPanel()).getByText(/Guardando portada/)).toBeTruthy();

    gate.resolve();
    await settle(400);
  }, 60000);

  it('con un REFINE en vuelo: el header queda deshabilitado y el panel de opciones no acepta clics', async () => {
    await renderWithFirstBatch('ph-h5-refine');

    // Elegir una opción habilita la caja de refinamiento.
    const opciones = within(coverPanel()).getAllByRole('img', { name: /^Opción \d+$/ });
    await act(async () => {
      fireEvent.click(opciones[0].closest('button')!);
      await yields(20);
    });

    parkProvider();
    const textarea = within(coverPanel()).getByPlaceholderText(/cambia el fondo/i);
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'más luz por favor' } });
      await yields(10);
    });
    await act(async () => {
      fireEvent.click(within(coverPanel()).getByRole('button', { name: /Enviar cambio/ }));
      await yields(40);
    });
    await settle(300);

    // El refine está EN VUELO (el botón de la caja lo reporta)…
    expect(
      within(coverPanel()).getByRole('button', { name: /Enviando\.\.\./ }),
    ).toBeTruthy();
    // …y mientras tanto ninguna de las dos superficies de lote es alcanzable.
    expect(headerControl(coverPanel()).disabled).toBe(true);
    expect(selectorControlOrNull(coverPanel())).toBeNull();
  }, 60000);
});
