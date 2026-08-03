/**
 * PH / G8 — La ÚNICA frontera nueva que el append introduce: cancelar un lote
 * `append:true` que ya fue despachado, y que el proveedor resuelve TARDE
 * ignorando el abort (T-H.9).
 *
 * PG sigue congelado: acá NO se re-deriva su matriz T-G.1–T-G.13
 * (pre-attempt / stagger / backoff / persisting). Se prueba una sola cosa, en
 * las dos categorías: que un resultado que llega DESPUÉS del cancel no se
 * aplica, no se persiste, no se encola y no vuelve a despachar — y que las
 * opciones y la selección que el usuario ya tenía quedan idénticas.
 *
 * Honestidad (PG/G4): cancelar aborta la petición del cliente y prohíbe
 * despachos futuros; NO revoca la petición ya despachada al edge ni recupera
 * su gasto. Por eso el proveedor de esta suite IGNORA la señal y resuelve
 * igual: es el caso pesimista real.
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

import { ctl, resetBoundary, upserts, type InvokeCall } from '@/lib/cuentacuentos/__tests__/pbBoundary';
import {
  CONTEXT,
  approveScenesIntoCoverStep,
  click,
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
const panelDe = (tipo: 'cover' | 'end') =>
  tipo === 'cover' ? panelFor(/Portada/i) : panelFor(/Imagen final|Fin/i);

const srcsDe = (panel: HTMLElement) =>
  within(panel)
    .getAllByRole('img', { name: /^Opción \d+$/ })
    .map((n) => n.getAttribute('src') ?? '');

function selectedIndexDe(panel: HTMLElement): number {
  return within(panel)
    .getAllByRole('img', { name: /^Opción \d+$/ })
    .map((n) => n.closest('button')!)
    .findIndex((b) => b.className.includes('ring-4'));
}

const HEADER_LABELS =
  /^(2 más|Regenerar|Generando\.\.\.|Guardando\.\.\.|Generar portada|Generar "Fin")$/;
function headerControl(panel: HTMLElement): HTMLButtonElement {
  const candidatos = within(panel)
    .getAllByRole('button')
    .filter((b) => HEADER_LABELS.test((b.textContent ?? '').trim()));
  expect(candidatos).toHaveLength(1);
  return candidatos[0] as HTMLButtonElement;
}

const draftUpserts = () => upserts.filter((u) => u.table === 'cuentacuentos_drafts');

/**
 * ¿Alguna escritura de borrador a partir de `desde` menciona este contenido?
 *
 * Se mira el CONTENIDO y no el número de upserts: el editor tiene un
 * auto-persist debounceado de buffers que puede escribir por motivos ajenos
 * (elegir una opción, el paso). Lo que el criterio prohíbe es que el resultado
 * CANCELADO llegue a la fila, y eso es exactamente lo que se afirma acá.
 */
function algunaEscrituraMenciona(desde: number, marcador: string): boolean {
  return draftUpserts()
    .slice(desde)
    .some((u) => JSON.stringify(u.payload ?? {}).includes(marcador));
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

describe('T-H.9 — cancelar un append despachado descarta el resultado tardío', () => {
  it.each([{ tipo: 'cover' as const }, { tipo: 'end' as const }])(
    '$tipo: con options y selección presentes, el resultado que llega tras el cancel no se aplica, no se persiste y no re-despacha',
    async ({ tipo }) => {
      await renderWithFirstBatch(`ph-h9-${tipo}`);

      // Estado de partida: dos opciones y una selección REAL del usuario.
      const panel0 = panelDe(tipo);
      await click(
        within(panel0).getAllByRole('img', { name: /^Opción \d+$/ })[1].closest('button')!,
      );
      const optionsAntes = srcsDe(panelDe(tipo));
      const seleccionAntes = selectedIndexDe(panelDe(tipo));
      expect(optionsAntes).toHaveLength(2);
      expect(seleccionAntes).toBe(1);

      // Proveedor que IGNORA el abort y resuelve cuando nosotros queramos.
      const tardio = deferred<BoundaryResult>();
      ctl.invokeHandler = () => tardio.promise;

      // Se pide el append y se DESPACHA.
      const invocacionesAntes = invokesOfType(tipo).length;
      await click(headerControl(panelDe(tipo)));
      await settle(300);
      expect(invokesOfType(tipo)).toHaveLength(invocacionesAntes + 1);
      const señal = invokesOfType(tipo)[invocacionesAntes].signal!;

      const upsertsAntes = draftUpserts().length;

      // Cancelar DESPUÉS del despacho.
      const cancelar = screen.getAllByRole('button', { name: 'Cancelar' });
      expect(cancelar).toHaveLength(1);
      await click(cancelar[0]);
      await settle(200);
      // El cancel real abortó la petición del cliente…
      expect(señal.aborted).toBe(true);

      // …y AHORA el borde responde igual, tarde y con imágenes válidas.
      const marcador = `${tipo}-tardia`;
      tardio.resolve(okImages(img(`${marcador}-1`), img(`${marcador}-2`)));
      await settle(900);

      // CERO apply: las opciones son exactamente las de antes.
      expect(srcsDe(panelDe(tipo))).toEqual(optionsAntes);
      // CERO pérdida de selección.
      expect(selectedIndexDe(panelDe(tipo))).toBe(seleccionAntes);
      // CERO persist/enqueue del resultado descartado: ninguna escritura de
      // borrador posterior al cancel lo menciona siquiera.
      expect(algunaEscrituraMenciona(upsertsAntes, marcador)).toBe(false);
      // CERO despacho posterior.
      expect(invokesOfType(tipo)).toHaveLength(invocacionesAntes + 1);

      // El ítem quedó recolectable (pending), no colgado: sin spinner, sin
      // control de cancelación, y el control de lote vuelve a estar disponible.
      expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull();
      expect(
        within(panelDe(tipo)).queryByRole('button', { name: /Generando\.\.\./ }),
      ).toBeNull();
      expect(headerControl(panelDe(tipo)).disabled).toBe(false);
    },
    90000,
  );

  it('un append cancelado NO se re-ofrece solo: el colector no re-encola una categoría no vacía', async () => {
    await renderWithFirstBatch('ph-h9-sin-reoferta');

    const tardio = deferred<BoundaryResult>();
    ctl.invokeHandler = () => tardio.promise;
    const antes = invokesOfType('cover').length;

    await click(headerControl(panelDe('cover')));
    await settle(300);
    await click(screen.getAllByRole('button', { name: 'Cancelar' })[0]);
    tardio.resolve(okImages(img('cover-tardia')));

    // Se deja correr bastante más que cualquier stagger/backoff: nada vuelve a
    // salir solo. Reintentar cuesta otro clic — y otro gasto.
    await settle(3000);
    expect(invokesOfType('cover')).toHaveLength(antes + 1);
  }, 90000);
});
