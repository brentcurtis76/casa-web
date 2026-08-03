/**
 * PH / G6 — El append 2→4 atraviesa la persistencia REAL y sobrevive a una
 * recarga (T-H.7).
 *
 * La cadena completa, con código de producción de punta a punta:
 *
 *   lote inicial (2 opciones)  → factories reales
 *     → append por la superficie real (4 opciones)
 *     → escritura del hook de producción      (observada en el upsert)
 *     → DESMONTAJE y REMONTAJE reales
 *     → recuperación real del borrador        (SIN atajo `initialStory`)
 *     → las cuatro opciones se leen en pantalla, en orden, y la que el
 *       usuario había elegido sigue ELEGIDA.
 *
 * ALCANCE de la selección: se afirma en los DOS tramos. Dentro de la sesión
 * viva el append la preserva (índice 1 antes y después de agregar). A TRAVÉS
 * de la recarga se afirma que la MISMA opción sigue seleccionada en la
 * pantalla recuperada: el patch generado que persiste el array completo lleva
 * también la selección viva, así que la fila la guarda y la recuperación la
 * restituye. Que la imagen siga estando en el mismo índice del array NO
 * sustituye a esa aserción —el orden se conserva aunque el cableado de la
 * selección se corte, así que por sí solo es una aserción que no puede fallar
 * (D7)—; por eso se afirman las dos cosas.
 *
 * Lo que sigue FUERA de alcance (PH-F2, preexistente): elegir una opción y no
 * hacer nada más no encola persistencia. Acá la secuencia es elegir → agregar,
 * y el append sí encola el snapshot generado.
 *
 * La fila que se recarga NO la redacta este test: `ctl.persistDraftRow` hace
 * que el borde guarde el payload que escribió producción y lo devuelva clonado
 * por JSON, como una columna `jsonb`. Si producción no persistiera el array
 * completo, no habría de dónde sacarlo al recargar (precedente PC-UI/T-D.13).
 *
 * Las imágenes son BYTES PNG REALES: así el camino de subida inmutable de PB
 * las decodifica y sube de verdad, y el swap por URL —count-matched— se
 * ejercita con una categoría de CUATRO, no de dos.
 *
 * BASE-RED en `8ceec7c`: allá el segundo lote REEMPLAZA, así que se persisten
 * y se recuperan dos opciones, no cuatro.
 *
 * BASE-RED en `9d96c41`: allá el patch generado sólo lleva `coverOptions`, así
 * que la cola mergea la selección del snapshot anterior —todavía `null`— y la
 * pantalla recuperada muestra las cuatro opciones con NINGUNA elegida
 * (`selectedIndex()` da -1).
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
  invokes,
  resetBoundary,
  upserts,
  type InvokeCall,
} from '@/lib/cuentacuentos/__tests__/pbBoundary';
import {
  PNG_A_B64,
  PNG_B_B64,
  PNG_C_B64,
  PNG_D_B64,
  PNG_E_B64,
} from '@/lib/cuentacuentos/__tests__/pbImageFixtures';
import {
  CONTEXT,
  approveScenesIntoCoverStep,
  click,
  invokesOfType,
  makeStory,
  okImages,
  settle,
  yields,
} from '@/lib/cuentacuentos/__tests__/phFixtures';

// Producción — importada DESPUÉS del mock de borde.
import CuentacuentoEditor from '../CuentacuentoEditor';

const url = (b64: string) => `data:image/png;base64,${b64}`;

/** Primera tanda: A y B para portada, E para el fin. Segunda: C y D. */
function serveBatches() {
  let coverBatch = 0;
  ctl.invokeHandler = async (call: InvokeCall) => {
    if (call.body.type === 'cover') {
      coverBatch++;
      return coverBatch === 1
        ? okImages(url(PNG_A_B64), url(PNG_B_B64))
        : okImages(url(PNG_C_B64), url(PNG_D_B64));
    }
    return okImages(url(PNG_E_B64));
  };
}

/** El último payload de borrador que escribió producción. */
function persistedDraft(): Record<string, unknown> | null {
  const rows = upserts.filter((u) => u.table === 'cuentacuentos_drafts');
  if (rows.length === 0) return null;
  return rows[rows.length - 1].payload as Record<string, unknown>;
}

/**
 * PB guarda la categoría como PATHS direccionados por contenido dentro de
 * `image_paths`; la lectura los reconstruye a URL. Es el array que tiene que
 * crecer a cuatro.
 */
function persistedCoverPaths(): string[] {
  const paths = persistedDraft()?.image_paths as Record<string, unknown> | undefined;
  return (paths?.coverPaths as string[] | undefined) ?? [];
}

beforeEach(() => {
  resetBoundary();
  ctl.userId = 'user-ph';
  // Fidelidad de ida y vuelta: la lectura devuelve lo que producción escribió.
  ctl.persistDraftRow = true;
  serveBatches();
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

const coverSrcs = () =>
  within(coverPanel())
    .getAllByRole('img', { name: /^Opción \d+$/ })
    .map((n) => n.getAttribute('src') ?? '');

/** El índice marcado con el check de selección, o -1. */
function selectedIndex(): number {
  const botones = within(coverPanel())
    .getAllByRole('img', { name: /^Opción \d+$/ })
    .map((n) => n.closest('button')!);
  return botones.findIndex((b) => b.className.includes('ring-4'));
}

describe('T-H.7 — el append persiste y sobrevive a una recarga real', () => {
  it('2 → 4 opciones: el hook escribe el array COMPLETO —las viejas primero— y la selección viva, y el remontaje sin `initialStory` recupera las cuatro en orden con la misma opción elegida', async () => {
    const first = render(
      <CuentacuentoEditor
        context={CONTEXT}
        initialStory={makeStory('ph-h7')}
        onStoryCreated={vi.fn()}
      />,
    );
    await approveScenesIntoCoverStep();
    await waitFor(() => expect(invokesOfType('cover')).toHaveLength(1), { timeout: 15000 });
    await settle(1200);
    expect(coverSrcs()).toHaveLength(2);
    // Lo que la fila tiene tras el PRIMER lote: dos entradas.
    await waitFor(() => expect(persistedCoverPaths()).toHaveLength(2), { timeout: 15000 });
    const pathsAntes = persistedCoverPaths();

    // El usuario elige la SEGUNDA opción…
    await click(
      within(coverPanel()).getAllByRole('img', { name: /^Opción \d+$/ })[1].closest('button')!,
    );
    expect(selectedIndex()).toBe(1);

    // …y pide dos más.
    await click(within(coverPanel()).getByRole('button', { name: /2 más/ }));
    await waitFor(() => expect(coverSrcs()).toHaveLength(4), { timeout: 15000 });
    await settle(1200);

    // Recién aplicadas, las cuatro son todavía los bytes que devolvió el borde
    // (PB las sube y las cambia por URL al persistir).
    expect(new Set(coverSrcs()).size).toBe(4);
    // La selección no se movió al agregar.
    expect(selectedIndex()).toBe(1);

    // El auto-persist va DEBOUNCEADO (2 s): se espera el reloj real, como le
    // pasaría a alguien que se cambia de pestaña.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 2600));
      await yields(80);
    });

    // --- El hook de producción escribió las CUATRO ---------------------------
    await waitFor(() => expect(persistedCoverPaths()).toHaveLength(4), { timeout: 15000 });
    const persistidas = persistedCoverPaths();
    // Cuatro entradas distintas: PB subió la categoría COMPLETA, no el delta,
    // y el direccionamiento por contenido las mantiene separadas.
    expect(new Set(persistidas).size).toBe(4);
    // APPEND en la fila misma: las dos viejas siguen PRIMERO y sin cambiar; las
    // dos nuevas se agregaron detrás. Esto es lo que el reemplazo destruía.
    expect(persistidas.slice(0, 2)).toEqual(pathsAntes);
    // Contrato PB: nada viaja inline.
    for (const v of persistidas) expect(v.startsWith('data:')).toBe(false);
    // La fila guardó también la SELECCIÓN viva. Sin esto la cola mergearía el
    // `selected_cover` del snapshot previo, que sigue en `null`.
    expect(persistedDraft()?.selected_cover).toBe(1);

    // --- Desmontaje REAL: se pierde todo el estado en memoria ---------------
    first.unmount();
    await act(async () => { await yields(10); });
    invokes.length = 0;

    // --- Remontaje SIN `initialStory`: la única fuente es la fila -----------
    render(<CuentacuentoEditor context={CONTEXT} onStoryCreated={vi.fn()} />);
    const recuperar = await screen.findByRole(
      'button',
      { name: /Recuperar borrador/i },
      { timeout: 15000 },
    );
    await act(async () => {
      fireEvent.click(recuperar);
      await yields(80);
    });
    await settle(1200);

    // Las cuatro opciones volvieron DESDE LA BASE, por URL y EN ORDEN: la
    // opción i de la pantalla recargada es la entrada i de la fila, que a su
    // vez conserva las dos primeras del lote inicial.
    await waitFor(() => expect(coverSrcs()).toHaveLength(4), { timeout: 15000 });
    const recargadas = coverSrcs();
    recargadas.forEach((src, i) => {
      expect(src.startsWith('data:')).toBe(false);
      expect(src.endsWith(persistidas[i])).toBe(true);
    });
    // La imagen que el usuario tenía elegida (índice 1) sigue estando en el
    // índice 1: agregar por la derecha no reindexó nada a través de la recarga.
    expect(recargadas[1].endsWith(pathsAntes[1])).toBe(true);
    // Y —lo que el orden NO puede probar— esa misma opción sigue ELEGIDA en la
    // pantalla recuperada. Si el patch generado no llevara la selección viva,
    // acá no habría ninguna marcada y esto daría -1.
    expect(selectedIndex()).toBe(1);

    // Recargar no re-generó nada: cero invocaciones al borde pagado.
    expect(invokes.filter((c) => c.fn === 'generate-scene-images')).toHaveLength(0);
  }, 180000);
});
