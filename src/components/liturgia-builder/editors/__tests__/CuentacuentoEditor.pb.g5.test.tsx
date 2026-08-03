/**
 * PB / G5 — T-B.9: FINALIZACIÓN INMUTABLE + B1 COMPARE-AND-DELETE.
 *
 * La tesis de G5 es que los hashes de contenido NO se convierten en tokens de
 * finalización. El testigo del borrado sigue siendo `story.id` + `updated_at`,
 * y re-finalizar bytes distintos escribe un path de hash NUEVO y un
 * `updated_at` NUEVO — de modo que un acuse VIEJO borra CERO filas aunque su
 * objeto viejo siga existiendo.
 *
 * Prueba de cinco pasos, tal cual la pide G5:
 *
 *   1. Finalizar A con bytes/hash H1 y capturar cierre/testigo T1.
 *   2. Antes de invocarlo, cambiar los bytes y re-finalizar la MISMA historia,
 *      produciendo H2 y T2.
 *   3. Invocar el cierre T1: el compare-and-delete borra CERO filas; el
 *      borrador T2 y la referencia H2 sobreviven.
 *   4. Guardar el padre con éxito: el payload de `liturgia_elementos` lleva la
 *      URL pública de H2 — no la de H1, y nada de base64 — y SÓLO ENTONCES el
 *      cierre T2 puede borrar la fila.
 *   5. Repetir el guardado con un fallo NO-409 de imagen final: sin upsert de
 *      elemento, sin llamada de confirmación, y el borrador sobrevive.
 *
 * TOPOLOGÍA DE PRODUCCIÓN (nada re-implementado):
 *
 *   - Pasos 1–3 usan el `CuentacuentoEditor` de producción montado con la
 *     MISMA firma de props con que lo monta el constructor (`onStoryCreated`
 *     recibe `(story, slides, confirmFinalization)`), porque el escenario
 *     necesita retener el cierre VIEJO — algo que el padre, por diseño,
 *     descarta al recibir el nuevo (`ConstructorLiturgias` :1145).
 *   - Pasos 4–5 usan el `ConstructorLiturgias` de PRODUCCIÓN: su `handleSave`
 *     real (:990-1034) es el que hace `await onSave(...)` y sólo después
 *     consume el cierre. `onSave` es el adaptador de la página, cuyo contrato
 *     —lanzar cuando `result.success` es falso— está transcrito literal de
 *     `ConstructorLiturgiasPage.tsx` :177-181; debajo de él corre el
 *     `saveLiturgy` de producción.
 *
 * Sólo se mockean bordes externos: cliente Supabase, funciones pagas,
 * `use-toast`, `fetch` y el input de archivo del navegador.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act, fireEvent, cleanup } from '@testing-library/react';
import { createHash } from 'node:crypto';
import type { Story } from '@/types/shared/story';
import type { Liturgy, LiturgyContext } from '@/types/shared/liturgy';

import {
  PNG_A_B64,
  PNG_B_B64,
  EXISTING_DRAFTS_URL,
} from '@/lib/cuentacuentos/__tests__/pbImageFixtures';

vi.mock('@/integrations/supabase/client', async () => {
  const { makeSupabaseMock } = await import('@/lib/cuentacuentos/__tests__/pbBoundary');
  return { supabase: makeSupabaseMock() };
});
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
  toast: vi.fn(),
}));

import {
  ctl,
  deletes,
  sim,
  draftUploads,
  finalUploads,
  upsertsTo,
  resetBoundary,
} from '@/lib/cuentacuentos/__tests__/pbBoundary';

// Producción — importada DESPUÉS de los mocks de borde.
import CuentacuentoEditor from '../CuentacuentoEditor';
import ConstructorLiturgias from '@/components/liturgia-builder/ConstructorLiturgias';
import { saveLiturgy } from '@/lib/liturgia/liturgyService';

// ---------------------------------------------------------------------------

const USER_ID = 'user-pb';
const LITURGY_ID = 'lit-pb';
const STORY_ID = 'story-g5';

/** SHA-256 de los bytes decodificados — calculado sin tocar producción. */
function hash32(base64: string): string {
  return createHash('sha256').update(Buffer.from(base64, 'base64')).digest('hex').slice(0, 32);
}

const H1 = hash32(PNG_A_B64);
const H2 = hash32(PNG_B_B64);

/** Path de borrador esperado para una portada con esos bytes. */
const draftCoverPath = (h: string) => `${USER_ID}/${LITURGY_ID}/cover/cover_${h}.png`;
/** Path FINALIZADO (bucket `liturgia-images`) para una portada con esos bytes. */
const finalCoverPath = (h: string) =>
  `liturgias/${LITURGY_ID}/cuentacuentos/cover/cover_${h}.png`;
const finalCoverUrl = (h: string) =>
  `https://mock.supabase.co/storage/v1/object/public/liturgia-images/${finalCoverPath(h)}`;

const baseContext: LiturgyContext = {
  id: LITURGY_ID,
  date: new Date('2026-05-10'),
  title: 'Liturgia PB',
  readings: [],
  summary: '',
  preacher: 'Pastor Test',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
};

/** Historia lista para "Aprobar escenas" → paso portada → "Finalizar cuento". */
function scenesPendingStory(coverBytes: string): Story {
  return {
    id: STORY_ID,
    title: 'Cuento G5',
    summary: 'Resumen',
    location: { name: 'Jerusalén' } as unknown as Story['location'],
    illustrationStyle: 'ghibli',
    characters: [
      {
        id: 'char1',
        name: 'María',
        role: 'protagonist',
        description: 'd',
        visualDescription: 'v',
        characterSheetUrl: EXISTING_DRAFTS_URL,
      } as unknown as Story['characters'][number],
    ],
    scenes: [
      {
        number: 1,
        text: 'Escena 1',
        visualDescription: 'plaza',
        selectedImageUrl: EXISTING_DRAFTS_URL,
      } as unknown as Story['scenes'][number],
    ],
    props: [],
    spiritualConnection: 'Esperanza',
    coverImageUrl: coverBytes,
    endImageUrl: EXISTING_DRAFTS_URL,
    metadata: {
      createdAt: '',
      updatedAt: '',
      status: 'scenes-pending' as Story['metadata']['status'],
    },
  } as unknown as Story;
}

async function yields(n: number) {
  for (let i = 0; i < n; i++) await Promise.resolve();
}

/** Aprueba escenas y finaliza. Devuelve el cierre entregado al padre. */
async function finalizeWith(coverBytes: string): Promise<{
  confirmFinalization: () => Promise<void>;
  committedStory: Story;
  view: ReturnType<typeof render>;
}> {
  const onStoryCreated = vi.fn();
  const view = render(
    <CuentacuentoEditor
      context={baseContext}
      initialStory={scenesPendingStory(coverBytes)}
      onStoryCreated={onStoryCreated}
    />
  );

  const approve = await waitFor(
    () => screen.getByRole('button', { name: /Aprobar escenas/i }),
    { timeout: 10000 }
  );
  await act(async () => {
    fireEvent.click(approve);
    await yields(25);
  });

  const finalize = await waitFor(
    () => screen.getByRole('button', { name: /Finalizar cuento/i }),
    { timeout: 10000 }
  );
  await act(async () => {
    fireEvent.click(finalize);
    await yields(30);
  });

  await waitFor(() => expect(onStoryCreated).toHaveBeenCalledTimes(1), { timeout: 10000 });
  const [committedStory, , confirmFinalization] = onStoryCreated.mock.calls[0] as [
    Story,
    unknown,
    (() => Promise<void>) | undefined,
  ];
  expect(typeof confirmFinalization).toBe('function');
  return { confirmFinalization: confirmFinalization!, committedStory, view };
}

beforeEach(() => {
  resetBoundary();
  ctl.draftRow = null;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response));
  vi.useRealTimers();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Pasos 1–3
// ---------------------------------------------------------------------------

describe('PB G5/T-B.9 — pasos 1-3: re-finalización con bytes cambiados y acuse obsoleto', () => {
  it('el acuse T1 borra CERO filas; el borrador T2 y la referencia H2 sobreviven', async () => {
    // --- Paso 1: finalizar A con H1, capturar T1 --------------------------
    const first = await finalizeWith(PNG_A_B64);
    const t1Row = sim.row;
    expect(t1Row, 'la finalización debió dejar una fila de borrador').not.toBeNull();
    const t1UpdatedAt = t1Row!.updated_at;

    // H1 se escribió en el bucket de borradores como objeto inmutable.
    expect(draftUploads().map((u) => u.path)).toContain(draftCoverPath(H1));
    expect(draftUploads().every((u) => u.upsert === false)).toBe(true);

    // Finalizar por sí solo NO borra nada: el borrador sigue recuperable.
    expect(deletes.filter((d) => d.table === 'cuentacuentos_drafts')).toEqual([]);

    // --- Paso 2: cambiar los bytes y re-finalizar la MISMA historia -------
    first.view.unmount();
    await act(async () => { await yields(5); });
    cleanup();

    const second = await finalizeWith(PNG_B_B64);
    const t2Row = sim.row;
    expect(t2Row).not.toBeNull();
    const t2UpdatedAt = t2Row!.updated_at;

    // Misma historia, testigo NUEVO: el hash no es el testigo, `updated_at` sí.
    expect(t2Row!.story_id).toBe(STORY_ID);
    expect(t1Row!.story_id).toBe(STORY_ID);
    expect(t2UpdatedAt).not.toBe(t1UpdatedAt);

    // Bytes distintos ⇒ objeto distinto. H1 nunca fue sobrescrito.
    expect(H2).not.toBe(H1);
    expect(draftUploads().map((u) => u.path)).toContain(draftCoverPath(H2));
    const coverWrites = draftUploads().filter((u) => u.path.includes('/cover/'));
    expect(coverWrites.every((u) => u.upsert === false)).toBe(true);

    // --- Paso 3: invocar el cierre VIEJO ----------------------------------
    await act(async () => {
      await first.confirmFinalization();
      await yields(10);
    });

    const staleAck = deletes.filter((d) => d.table === 'cuentacuentos_drafts').at(-1);
    expect(staleAck, 'el acuse obsoleto debió emitir su DELETE').toBeDefined();
    // Lo primero es la CONSECUENCIA: cero filas borradas, porque el borrador
    // vivo ya es el de T2. (Se afirma antes que los filtros para que una
    // mutación del testigo falle por su daño real, no por su forma.)
    expect(staleAck!.deleted).toBe(0);
    // Y el testigo que viajó es el de la finalización VIEJA: historia +
    // `updated_at`, nunca un hash ni un path.
    expect(staleAck!.filters['story->>id']).toBe(STORY_ID);
    expect(staleAck!.filters['updated_at']).toBe(t1UpdatedAt);

    // El borrador T2 sobrevive intacto, con la referencia H2 persistida.
    expect(sim.row).toEqual(t2Row);
    const lastDraftUpsert = upsertsTo('cuentacuentos_drafts').at(-1);
    const imagePaths = (lastDraftUpsert!.payload as { image_paths?: { coverPaths?: string[] } })
      .image_paths;
    expect(imagePaths?.coverPaths).toContain(draftCoverPath(H2));
    expect(imagePaths?.coverPaths ?? []).not.toContain(draftCoverPath(H1));

    // El cierre FRESCO sí borra: es el que corresponde a la fila viva.
    await act(async () => {
      await second.confirmFinalization();
      await yields(10);
    });
    const freshAck = deletes.filter((d) => d.table === 'cuentacuentos_drafts').at(-1);
    expect(freshAck!.filters['updated_at']).toBe(t2UpdatedAt);
    expect(freshAck!.deleted).toBe(1);
    expect(sim.row).toBeNull();
  }, 120_000);

  it('nunca se borra un objeto de Storage: PB no compensa con `remove`', async () => {
    const first = await finalizeWith(PNG_A_B64);
    first.view.unmount();
    cleanup();
    await finalizeWith(PNG_B_B64);
    await act(async () => {
      await first.confirmFinalization();
      await yields(10);
    });
    // El objeto H1 quedó huérfano PERMITIDO. Ni la re-finalización ni el acuse
    // obsoleto tocan bytes.
    const { cuentacuentosRemovals } = await import('@/lib/cuentacuentos/__tests__/pbBoundary');
    expect(cuentacuentosRemovals()).toEqual([]);
  }, 120_000);
});

// ---------------------------------------------------------------------------
// Pasos 4–5, con el PADRE de producción
// ---------------------------------------------------------------------------

/**
 * Adaptador `onSave` de la página. Transcrito de
 * `ConstructorLiturgiasPage.tsx` :177-181: llama al `saveLiturgy` de
 * producción y LANZA cuando el resultado no es exitoso. Ése es el contrato que
 * hace que `ConstructorLiturgias.handleSave` no llegue nunca a consumir el
 * cierre de confirmación tras un guardado fallido.
 */
function makePageOnSave(record: { results: Array<{ success: boolean; error?: string }> }) {
  return async (liturgy: Liturgy) => {
    const result = await saveLiturgy(liturgy);
    record.results.push(result);
    if (!result.success) {
      throw new Error(result.error || 'Error desconocido guardando liturgia');
    }
  };
}

function initialLiturgy(): Liturgy {
  return {
    id: LITURGY_ID,
    context: baseContext,
    elements: [],
    status: 'in-progress',
    metadata: { createdAt: '2026-05-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z' },
  } as unknown as Liturgy;
}

describe('PB G5/T-B.9 — pasos 4-5: el padre de producción guarda y sólo entonces confirma', () => {
  /**
   * Monta el constructor REAL, abre el elemento cuentacuentos, sustituye la
   * portada por bytes nuevos (input de archivo real) y finaliza. Devuelve la
   * función que dispara el guardado del padre.
   */
  async function mountAndFinalize(record: { results: Array<{ success: boolean; error?: string }> }) {
    const liturgy = initialLiturgy();
    (liturgy.elements as unknown[]).push({
      id: 'el-cuento',
      type: 'cuentacuentos',
      order: 0,
      title: 'Cuentacuentos',
      status: 'pending',
      config: { storyData: scenesPendingStory(PNG_A_B64) },
    });

    render(<ConstructorLiturgias initialLiturgy={liturgy} onSave={makePageOnSave(record)} />);

    // El constructor abre en la pestaña "Contexto": navegar a "Elementos" y
    // abrir el cuentacuentos, igual que el usuario.
    const elementsTab = await waitFor(
      () => screen.getByRole('button', { name: /^Elementos$/i }),
      { timeout: 10000 }
    );
    await act(async () => {
      fireEvent.click(elementsTab);
      await yields(20);
    });

    const opener = await waitFor(
      () => screen.getByRole('button', { name: /Cuentacuento/i }),
      { timeout: 10000 }
    );
    await act(async () => {
      fireEvent.click(opener);
      await yields(20);
    });

    // Aprobar escenas → paso portada.
    const approve = await waitFor(
      () => screen.getByRole('button', { name: /Aprobar escenas/i }),
      { timeout: 10000 }
    );
    await act(async () => {
      fireEvent.click(approve);
      await yields(25);
    });

    // Cambiar los bytes seleccionados: subida MANUAL de una portada nueva por
    // el input de archivo del navegador (borde externo), acción real del
    // usuario. `handleUploadCover` la agrega y la deja seleccionada.
    const fileInputs = await waitFor(
      () => {
        const found = document.querySelectorAll('input[type="file"]');
        if (found.length === 0) throw new Error('todavía no hay input de archivo');
        return found;
      },
      { timeout: 10000 }
    );
    const coverInput = fileInputs[0] as HTMLInputElement;
    const file = new File([Buffer.from(PNG_B_B64, 'base64')], 'portada.png', {
      type: 'image/png',
    });
    await act(async () => {
      fireEvent.change(coverInput, { target: { files: [file] } });
      await new Promise((r) => setTimeout(r, 50));
      await yields(30);
    });

    const finalize = await waitFor(
      () => screen.getByRole('button', { name: /Finalizar cuento/i }),
      { timeout: 10000 }
    );
    await act(async () => {
      fireEvent.click(finalize);
      await yields(40);
    });

    // El padre ya tiene la historia y el cierre.
    await waitFor(() => expect(sim.row).not.toBeNull(), { timeout: 10000 });

    return async () => {
      const save = await waitFor(() => screen.getByRole('button', { name: /^Guardar$/i }), {
        timeout: 10000,
      });
      await act(async () => {
        fireEvent.click(save);
        await yields(40);
      });
      await waitFor(() => expect(record.results.length).toBeGreaterThan(0), { timeout: 10000 });
      await act(async () => { await yields(20); });
    };
  }

  it('paso 4 — el elemento guardado lleva la URL pública de H2, y sólo después se borra el borrador', async () => {
    const record = { results: [] as Array<{ success: boolean; error?: string }> };
    const triggerSave = await mountAndFinalize(record);

    const rowBeforeSave = sim.row;
    expect(rowBeforeSave).not.toBeNull();
    expect(upsertsTo('liturgia_elementos')).toEqual([]);

    await triggerSave();

    expect(record.results[0]?.success).toBe(true);

    // La imagen finalizada se escribió inmutable en `liturgia-images`.
    const finalCover = finalUploads().filter((u) => u.path.includes('/cover/'));
    expect(finalCover.map((u) => u.path)).toEqual([finalCoverPath(H2)]);
    expect(finalCover[0].upsert).toBe(false);
    expect(finalCover[0].contentType).toBe('image/png');

    // El elemento persistido lleva la URL de H2 — nunca la de H1.
    const elementUpserts = upsertsTo('liturgia_elementos');
    expect(elementUpserts).toHaveLength(1);
    const rows = elementUpserts[0].payload as Array<Record<string, unknown>>;
    const cuento = rows.find((r) => r['tipo'] === 'cuentacuentos');
    expect(cuento, 'el elemento cuentacuentos debió persistirse').toBeDefined();
    const storyData = (cuento!['config'] as { storyData: Record<string, unknown> }).storyData;

    expect(storyData['coverImageUrl']).toBe(finalCoverUrl(H2));
    expect(JSON.stringify(elementUpserts[0].payload)).not.toContain(H1);

    // TODA referencia de imagen del elemento es una URL: el fallback a base64
    // —el bug de G4, en el que una subida fallida devolvía `null` y
    // `updateStoryWithImageUrls` caía al campo original— no llega a la base.
    const referenceFields: Array<[string, unknown]> = [
      ['coverImageUrl', storyData['coverImageUrl']],
      ['endImageUrl', storyData['endImageUrl']],
      ...(storyData['characters'] as Array<Record<string, unknown>>).map(
        (c, i) => [`characters[${i}].characterSheetUrl`, c['characterSheetUrl']] as [string, unknown]
      ),
      ...(storyData['scenes'] as Array<Record<string, unknown>>).map(
        (s, i) => [`scenes[${i}].selectedImageUrl`, s['selectedImageUrl']] as [string, unknown]
      ),
    ];
    for (const [name, value] of referenceFields) {
      expect(typeof value, `${name} debe ser una referencia`).toBe('string');
      expect(String(value).startsWith('http'), `${name} no es una URL: ${String(value).slice(0, 60)}`).toBe(true);
    }

    // [B1] — RECORRIDO COMPLETO del `storyData` persistido: CERO campos con
    // imagen inline, en ningún lado del árbol.
    //
    // Antes acá se PINEABA `['storyData.coverImageOptions[]']` como leak
    // aceptado (el ex-hallazgo PB-F7). Eso contradecía el propio contrato de
    // G5 paso 4 ("nada de base64") y T-B.9 ("sólo la URL pública nueva"): la
    // finalización copia las opciones TAL CUAL y `updateStoryWithImageUrls`
    // sólo reescribía el campo seleccionado, así que una opción no guardada
    // viajaba cruda a `liturgia_elementos`. La aserción ahora exige el
    // invariante entero en vez de describir la fuga.
    const inlineFields: string[] = [];
    const walk = (node: unknown, pathStr: string) => {
      if (typeof node === 'string') {
        if (node.startsWith('data:') || (node.length > 40 && /^[A-Za-z0-9+/]+={0,2}$/.test(node))) {
          inlineFields.push(pathStr);
        }
        return;
      }
      if (Array.isArray(node)) {
        node.forEach((v, i) => walk(v, `${pathStr}[${i}]`));
        return;
      }
      if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node as Record<string, unknown>)) walk(v, `${pathStr}.${k}`);
      }
    };
    walk(storyData, 'storyData');
    expect(
      inlineFields,
      `el elemento persistido lleva bytes inline en: ${inlineFields.join(', ')}`
    ).toEqual([]);

    // La representación LIMPIA de las opciones, campo por campo:
    //
    //  - la opción inline SELECCIONADA se conserva como su URL final H2 (no se
    //    descarta la referencia seleccionada);
    //  - la opción inline NO seleccionada (H1, que nunca se subió a
    //    `liturgia-images`) desaparece;
    //  - las opciones HTTP(S) ya persistidas pasan intactas.
    expect(storyData['coverImageOptions']).toEqual([finalCoverUrl(H2)]);
    expect(storyData['endImageOptions']).toEqual([EXISTING_DRAFTS_URL]);
    expect(
      (storyData['characters'] as Array<Record<string, unknown>>)[0]['characterSheetOptions']
    ).toEqual([EXISTING_DRAFTS_URL]);
    expect(
      (storyData['scenes'] as Array<Record<string, unknown>>)[0]['imageOptions']
    ).toEqual([EXISTING_DRAFTS_URL]);

    // Y SÓLO ENTONCES el cierre borró la fila: el DELETE es posterior, en la
    // secuencia global de operaciones, al upsert del elemento.
    const ack = deletes.filter((d) => d.table === 'cuentacuentos_drafts').at(-1);
    expect(ack, 'el padre debió consumir el cierre tras el guardado').toBeDefined();
    expect(ack!.deleted).toBe(1);
    expect(ack!.filters['updated_at']).toBe(rowBeforeSave!.updated_at);
    expect(ack!.seq).toBeGreaterThan(elementUpserts[0].seq);
    expect(sim.row).toBeNull();
  }, 180_000);

  it('[B1] reopen — la representación limpia de opciones no rompe la portada/fin seleccionadas', async () => {
    const record = { results: [] as Array<{ success: boolean; error?: string }> };
    const triggerSave = await mountAndFinalize(record);
    await triggerSave();
    expect(record.results[0]?.success).toBe(true);

    // El `storyData` REAL que quedó en `liturgia_elementos` — el mismo objeto
    // que producción vuelve a pasar como `initialStory` al reabrir el elemento
    // guardado (`loadLiturgy` → config.storyData → `<CuentacuentoEditor
    // initialStory={...}>`).
    const rows = upsertsTo('liturgia_elementos')[0].payload as Array<Record<string, unknown>>;
    const persisted = (rows.find((r) => r['tipo'] === 'cuentacuentos')!['config'] as {
      storyData: Story;
    }).storyData;

    // Desmontar el constructor y REABRIR con el editor de producción.
    cleanup();
    resetBoundary();
    ctl.draftRow = null;

    render(
      <CuentacuentoEditor
        context={baseContext}
        initialStory={persisted}
        onStoryCreated={vi.fn()}
      />
    );
    await act(async () => { await yields(30); });

    /** `src` de todas las imágenes que el editor real está mostrando. */
    const srcs = () =>
      screen.queryAllByRole('img').map((el) => el.getAttribute('src') ?? '').filter(Boolean);

    // 1. La vista finalizada muestra la portada H2 y la imagen de fin. La
    //    referencia seleccionada sobrevivió al saneo.
    await waitFor(() => expect(srcs().some((s) => s.startsWith(finalCoverUrl(H2)))).toBe(true), {
      timeout: 10000,
    });
    expect(srcs().some((s) => s.startsWith(EXISTING_DRAFTS_URL))).toBe(true);
    expect(srcs().filter((s) => s.startsWith('data:'))).toEqual([]);

    // 2. Y el estado de selección sigue vivo camino adentro: "Editar cuento" →
    //    "Aprobar escenas" llega al paso de portada, donde el editor siembra
    //    sus opciones de portada/fin desde los campos seleccionados. Ambos
    //    selectores muestran la referencia correcta y NINGUNA opción inline.
    const edit = await waitFor(() => screen.getByRole('button', { name: /Editar cuento/i }), {
      timeout: 10000,
    });
    await act(async () => {
      fireEvent.click(edit);
      await yields(25);
    });
    const approve = await waitFor(
      () => screen.getByRole('button', { name: /Aprobar escenas/i }),
      { timeout: 10000 }
    );
    await act(async () => {
      fireEvent.click(approve);
      await yields(30);
    });

    await waitFor(() => expect(srcs().some((s) => s.startsWith(finalCoverUrl(H2)))).toBe(true), {
      timeout: 10000,
    });
    expect(srcs().some((s) => s.startsWith(EXISTING_DRAFTS_URL))).toBe(true);
    expect(srcs().filter((s) => s.startsWith('data:'))).toEqual([]);
  }, 180_000);

  it('paso 5 — un fallo NO-409 de imagen final: sin upsert de elemento, sin confirmación, el borrador vive', async () => {
    const record = { results: [] as Array<{ success: boolean; error?: string }> };
    const triggerSave = await mountAndFinalize(record);

    const rowBeforeSave = sim.row;
    expect(rowBeforeSave).not.toBeNull();

    // Falla SÓLO la subida al bucket finalizado (los paths finalizados
    // empiezan con `liturgias/`; los de borrador, con el userId).
    ctl.failUploadWhenPathIncludes = 'liturgias/';
    const deletesBefore = deletes.filter((d) => d.table === 'cuentacuentos_drafts').length;

    await triggerSave();

    // El guardado falló de forma explícita, no silenciosa.
    expect(record.results[0]?.success).toBe(false);
    expect(record.results[0]?.error).toMatch(/No se pudieron guardar las imágenes del cuento/);

    // Cero upserts de elemento: se abortó ANTES de tocar `liturgia_elementos`.
    expect(upsertsTo('liturgia_elementos')).toEqual([]);

    // Cero llamadas de confirmación: el padre nunca llegó al cierre.
    expect(deletes.filter((d) => d.table === 'cuentacuentos_drafts')).toHaveLength(deletesBefore);

    // El borrador sobrevive, recuperable.
    expect(sim.row).toEqual(rowBeforeSave);

    // Y no se compensó con borrados de objetos.
    const { cuentacuentosRemovals } = await import('@/lib/cuentacuentos/__tests__/pbBoundary');
    expect(cuentacuentosRemovals()).toEqual([]);
  }, 180_000);
});
