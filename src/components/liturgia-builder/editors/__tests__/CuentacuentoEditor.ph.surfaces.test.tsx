/**
 * PH / G3 + G4 + G7 — Las cuatro superficies productivas de portada/fin, el
 * colector, el lote parcial y la contabilidad de invocaciones
 * (T-H.3, T-H.4, T-H.6, T-H.8).
 *
 * BARRA G9: se renderiza el `CuentacuentoEditor` de PRODUCCIÓN con el hook, el
 * runner, las nueve factories, el parser/toast y el `ImageSelector` reales.
 * El único doble es el BORDE externo compartido de la fase (`pbBoundary`:
 * Supabase auth/tablas/storage y `functions.invoke`) más `fetch`. No se mockea
 * el hook ni las factories, no se llaman callbacks extraídos y no hay
 * aserciones sobre el texto del fuente.
 *
 * BASE-RED en `8ceec7c`: allá las cuatro superficies REEMPLAZAN (el header dice
 * `Regenerar`, el `ImageSelector` dice `No me gustan…`, y ambos pisan el array),
 * así que toda aserción de acumulación y de copy observa la conducta vieja.
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';

vi.mock('@/integrations/supabase/client', async () => {
  const { makeSupabaseMock } = await import('@/lib/cuentacuentos/__tests__/pbBoundary');
  return { supabase: makeSupabaseMock() };
});

import { ctl, invokes, resetBoundary, type InvokeCall } from '@/lib/cuentacuentos/__tests__/pbBoundary';
import {
  CONTEXT,
  approveScenesIntoCoverStep,
  click,
  invokesOfType,
  makeStory,
  okImages,
  settle,
  type BoundaryResult,
} from '@/lib/cuentacuentos/__tests__/phFixtures';

// Producción — importada DESPUÉS del mock de borde.
import CuentacuentoEditor from '../CuentacuentoEditor';

const DRAFTS = 'https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-ph/lit-ph';
const img = (name: string) => `${DRAFTS}/${name}.png`;

/** Sirve imágenes distinguibles por tipo y por tanda, para poder leer el orden. */
function serveDistinctBatches() {
  const seen: Record<string, number> = { cover: 0, end: 0 };
  ctl.invokeHandler = async (call: InvokeCall) => {
    const type = String(call.body.type);
    if (type !== 'cover' && type !== 'end') return okImages(img('otro'));
    const batch = ++seen[type];
    return okImages(img(`${type}-b${batch}-1`), img(`${type}-b${batch}-2`));
  };
}

beforeEach(() => {
  resetBoundary();
  ctl.userId = 'user-ph';
  ctl.draftRow = null;
  serveDistinctBatches();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response));
  vi.useRealTimers();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Renderiza y deja el primer lote portada+fin ya aplicado (2 + 2 options). */
async function renderWithFirstBatch(id: string) {
  render(
    <CuentacuentoEditor
      context={CONTEXT}
      initialStory={makeStory(id)}
      onStoryCreated={vi.fn()}
    />,
  );
  await approveScenesIntoCoverStep();
  // El auto-arranque encola portada + fin (el fin arranca tras su stagger).
  await waitFor(() => expect(invokesOfType('cover')).toHaveLength(1), { timeout: 10000 });
  await waitFor(() => expect(invokesOfType('end')).toHaveLength(1), { timeout: 10000 });
  await settle(600);
}

/** El panel (tarjeta) que contiene un encabezado dado. */
function panelFor(heading: RegExp): HTMLElement {
  const h = screen.getByRole('heading', { name: heading });
  const panel = h.closest('div.rounded-lg');
  if (!panel) throw new Error(`sin panel para ${heading}`);
  return panel as HTMLElement;
}

const coverPanel = () => panelFor(/Portada/i);
const endPanel = () => panelFor(/Imagen final|Fin/i);

/** Las miniaturas de opción de un panel (`Opción N` es su alt). */
const optionCount = (panel: HTMLElement) =>
  within(panel).queryAllByRole('img', { name: /^Opción \d+$/ }).length;

// =============================================================================
// T-H.4 — Las cuatro superficies UI
// =============================================================================

describe('T-H.4 — las cuatro superficies de portada/fin agregan, con copy exacta', () => {
  it('con options ya generadas, el header dice exactamente "2 más" y anuncia que no descarta nada', async () => {
    await renderWithFirstBatch('ph-h4-header');

    for (const panel of [coverPanel(), endPanel()]) {
      const boton = within(panel).getByRole('button', { name: /2 más/ });
      // Copy EXACTA (D8): sin sufijos, sin "Regenerar" sobreviviente. El
      // `trim` sólo come el espacio que JSX deja tras el icono — la misma
      // forma que ya tienen los botones "2 más" de sheets/scenes.
      expect(boton.textContent?.trim()).toBe('2 más');
      expect(boton.getAttribute('title')).toBe(
        'Genera 2 opciones adicionales sin descartar las existentes',
      );
      // Ya no queda una superficie de reemplazo de lote.
      expect(within(panel).queryByRole('button', { name: /^Regenerar$/ })).toBeNull();
    }
  }, 60000);

  it('el botón de regenerar del ImageSelector de portada/fin anuncia que AGREGA', async () => {
    await renderWithFirstBatch('ph-h4-selector');

    for (const panel of [coverPanel(), endPanel()]) {
      const boton = within(panel).getByRole('button', { name: /Generar 2 opciones adicionales/ });
      expect(boton.textContent).toBe('Generar 2 opciones adicionales');
      expect(
        within(panel).queryByRole('button', { name: /No me gustan, generar otras opciones/ }),
      ).toBeNull();
    }
  }, 60000);

  it('el header "2 más" de la portada AGREGA: 2 → 4 opciones, en orden, sin descartar', async () => {
    await renderWithFirstBatch('ph-h4-append-cover');
    expect(optionCount(coverPanel())).toBe(2);

    await click(within(coverPanel()).getByRole('button', { name: /2 más/ }));
    await settle(800);

    expect(optionCount(coverPanel())).toBe(4);
    const srcs = within(coverPanel())
      .getAllByRole('img', { name: /^Opción \d+$/ })
      .map((n) => n.getAttribute('src'));
    expect(srcs).toEqual([
      img('cover-b1-1'),
      img('cover-b1-2'),
      img('cover-b2-1'),
      img('cover-b2-2'),
    ]);
    // El fin no se movió.
    expect(optionCount(endPanel())).toBe(2);
  }, 60000);

  it('el regenerar del ImageSelector del fin AGREGA: 2 → 4 opciones, en orden', async () => {
    await renderWithFirstBatch('ph-h4-append-end');
    expect(optionCount(endPanel())).toBe(2);

    await click(
      within(endPanel()).getByRole('button', { name: /Generar 2 opciones adicionales/ }),
    );
    await settle(800);

    expect(optionCount(endPanel())).toBe(4);
    const srcs = within(endPanel())
      .getAllByRole('img', { name: /^Opción \d+$/ })
      .map((n) => n.getAttribute('src'));
    expect(srcs).toEqual([img('end-b1-1'), img('end-b1-2'), img('end-b2-1'), img('end-b2-2')]);
    expect(optionCount(coverPanel())).toBe(2);
  }, 60000);

  it('el append PRESERVA la selección: el índice elegido sigue mostrando la MISMA imagen', async () => {
    await renderWithFirstBatch('ph-h4-seleccion');

    // El usuario elige la SEGUNDA opción de portada.
    const antes = within(coverPanel()).getAllByRole('img', { name: /^Opción \d+$/ });
    const elegida = antes[1].getAttribute('src');
    await click(antes[1].closest('button')!);

    await click(within(coverPanel()).getByRole('button', { name: /2 más/ }));
    await settle(800);

    const despues = within(coverPanel()).getAllByRole('img', { name: /^Opción \d+$/ });
    expect(despues).toHaveLength(4);
    // Misma posición, misma imagen: agregar por la derecha no reindexa nada.
    expect(despues[1].getAttribute('src')).toBe(elegida);
    // Y sigue marcada: el botón de guardar selección continúa disponible.
    expect(
      within(coverPanel()).getByRole('button', { name: /Guardar selección/ }),
    ).toBeTruthy();
  }, 60000);

  it('los labels de estado VACÍO no cambian', async () => {
    // Sin respuesta del borde, el primer lote queda en vuelo y luego se cancela:
    // lo que importa acá es el label del control cuando NO hay options.
    ctl.invokeHandler = () => new Promise<BoundaryResult>(() => {});
    render(
      <CuentacuentoEditor
        context={CONTEXT}
        initialStory={makeStory('ph-h4-vacio')}
        onStoryCreated={vi.fn()}
      />,
    );
    await approveScenesIntoCoverStep();
    await waitFor(() => expect(invokesOfType('cover')).toHaveLength(1), { timeout: 10000 });

    await click(screen.getAllByRole('button', { name: 'Cancelar' })[0]);
    await settle(200);

    expect(screen.getByRole('button', { name: /Generar portada/ }).textContent?.trim()).toBe(
      'Generar portada',
    );
    expect(screen.getByRole('button', { name: /Generar "Fin"/ }).textContent?.trim()).toBe(
      'Generar "Fin"',
    );
    // En vacío el header no promete opciones adicionales.
    expect(screen.getByRole('button', { name: /Generar portada/ }).getAttribute('title')).toBeNull();
  }, 60000);

  it('el ImageSelector de ESCENAS conserva la copy de reemplazo por defecto', async () => {
    // La escena 1 llega ilustrada: su panel se renderiza en el paso `scenes`,
    // ANTES de aprobar. Sheets/scenes no pasan la prop nueva.
    render(
      <CuentacuentoEditor
        context={CONTEXT}
        initialStory={makeStory('ph-h4-escenas')}
        onStoryCreated={vi.fn()}
      />,
    );
    await settle(400);

    expect(
      await screen.findByRole('button', { name: /No me gustan, generar otras opciones/ }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /Generar 2 opciones adicionales/ }),
    ).toBeNull();
  }, 60000);
});

// =============================================================================
// T-H.3 — Colector y alcanzabilidad
// =============================================================================

describe('T-H.3 — el colector sigue siendo vacío-only y NO re-ofrece un append', () => {
  it('con options vacías el auto-arranque genera portada y fin UNA vez; con options ya presentes no vuelve a encolar nada', async () => {
    await renderWithFirstBatch('ph-h3-colector');

    // El primer lote (options vacías) produjo exactamente una tanda por ítem.
    expect(invokesOfType('cover')).toHaveLength(1);
    expect(invokesOfType('end')).toHaveLength(1);

    // Con la categoría ya poblada, ningún efecto de auto-arranque re-encola:
    // volver a generar es un clic manual, y su costo es del usuario.
    await settle(1500);
    expect(invokesOfType('cover')).toHaveLength(1);
    expect(invokesOfType('end')).toHaveLength(1);
  }, 60000);

  it('el lote inicial pide REEMPLAZO (append irrelevante en vacío) y aun así deja 2 opciones', async () => {
    await renderWithFirstBatch('ph-h3-inicial');
    expect(optionCount(coverPanel())).toBe(2);
    expect(optionCount(endPanel())).toBe(2);
  }, 60000);
});

// =============================================================================
// T-H.6 — Lote parcial y las DOS formas de cero imágenes
// =============================================================================

describe('T-H.6 — lote parcial agrega lo que llegó; cero imágenes no toca nada', () => {
  it('un append que devuelve UNA sola imagen conserva las dos viejas y la selección', async () => {
    await renderWithFirstBatch('ph-h6-parcial');
    const antes = within(coverPanel()).getAllByRole('img', { name: /^Opción \d+$/ });
    const elegida = antes[0].getAttribute('src');
    await click(antes[0].closest('button')!);

    ctl.invokeHandler = async () => okImages(img('cover-parcial'));
    await click(within(coverPanel()).getByRole('button', { name: /2 más/ }));
    await settle(800);

    const srcs = within(coverPanel())
      .getAllByRole('img', { name: /^Opción \d+$/ })
      .map((n) => n.getAttribute('src'));
    // Ni se rellena hasta dos, ni se rechaza por venir incompleto.
    expect(srcs).toEqual([img('cover-b1-1'), img('cover-b1-2'), img('cover-parcial')]);
    expect(srcs[0]).toBe(elegida);
  }, 60000);

  it.each([
    {
      forma: '429/500 con rechazos (FunctionsHttpError)',
      responder: (): BoundaryResult => ({ data: null, error: new Error('429 sin cuota') }),
    },
    {
      forma: '200 con success:false e images:[]',
      responder: (): BoundaryResult => ({
        data: { success: false, images: [], error: 'sin variaciones válidas' },
        error: null,
      }),
    },
  ])('cero imágenes por $forma deja options y selección intactas', async ({ responder }) => {
    await renderWithFirstBatch(`ph-h6-cero`);
    const antes = within(coverPanel())
      .getAllByRole('img', { name: /^Opción \d+$/ })
      .map((n) => n.getAttribute('src'));
    await click(within(coverPanel()).getAllByRole('img', { name: /^Opción \d+$/ })[1].closest('button')!);

    ctl.invokeHandler = async () => responder();
    await click(within(coverPanel()).getByRole('button', { name: /2 más/ }));
    // El runner reintenta una vez (backoff base 2 s); esperamos a que agote.
    await settle(6000);

    const despues = within(coverPanel())
      .getAllByRole('img', { name: /^Opción \d+$/ })
      .map((n) => n.getAttribute('src'));
    // Cero imágenes NUNCA llega a apply: el wrapper FE lo convierte en error.
    expect(despues).toEqual(antes);
    // La selección sobrevive: el guardado de selección sigue ofrecido.
    expect(within(coverPanel()).getByRole('button', { name: /Guardar selección/ })).toBeTruthy();
  }, 90000);
});

// =============================================================================
// T-H.8 — Contabilidad de invocaciones
// =============================================================================

describe('T-H.8 — cada lote aceptado es UNA invocación de borde con count 2', () => {
  it('portada + fin de primer intento = 2 invocaciones, 4 imágenes pro pedidas', async () => {
    await renderWithFirstBatch('ph-h8-inicial');

    const pagados = invokes.filter((c) => c.fn === 'generate-scene-images');
    const coverEnd = pagados.filter((c) => c.body.type === 'cover' || c.body.type === 'end');
    expect(coverEnd).toHaveLength(2);
    for (const call of coverEnd) {
      expect(call.body.count).toBe(2);
      expect(call.body.modelTier).toBe('pro');
    }
    // La suma pedida: 2 invocaciones × count 2 = 4 imágenes pro.
    const pedidas = coverEnd.reduce((n, c) => n + Number(c.body.count), 0);
    expect(pedidas).toBe(4);
  }, 60000);

  it('cada clic de append agrega exactamente UNA invocación más, también con count 2', async () => {
    await renderWithFirstBatch('ph-h8-append');
    expect(invokesOfType('cover')).toHaveLength(1);

    await click(within(coverPanel()).getByRole('button', { name: /2 más/ }));
    await settle(800);

    const cover = invokesOfType('cover');
    expect(cover).toHaveLength(2);
    expect(cover[1].body.count).toBe(2);
    expect(cover[1].body.modelTier).toBe('pro');
    // El append NO manda el array existente al borde: sólo pide dos nuevas.
    expect(cover[1].body).not.toHaveProperty('append');
  }, 60000);
});
