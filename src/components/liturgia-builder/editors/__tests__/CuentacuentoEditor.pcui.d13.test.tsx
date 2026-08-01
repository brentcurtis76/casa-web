/**
 * PC-UI / T-D.13 — `landmarkVisible` de la RESPUESTA hasta la PETICIÓN de
 * imágenes, atravesando la persistencia real.
 *
 * El primer eslabón faltaba: el mapper de `data.scenes` construía
 * `{number, text, visualDescription}` y TIRABA `landmarkVisible`, aunque el
 * esquema estricto del borde lo emite y el constructor de peticiones de escena
 * ya lo reenviaba. El campo existía a los dos extremos y no llegaba nunca.
 *
 * BARRA DE INTEGRACIÓN (G7/G10). Un solo caso recorre la cadena COMPLETA con
 * código de producción:
 *
 *   respuesta mockeada válida por contrato
 *     → mapper de respuesta de producción
 *     → `Story` de producción
 *     → escritura de borrador del hook de producción   (observada en el upsert)
 *     → DESMONTAJE y REMONTAJE reales
 *     → recuperación real del borrador                 (sin atajo `initialStory`)
 *     → acción real del editor que invoca `generate-scene-images`
 *     → los booleanos se observan en el CUERPO de la petición, en el borde.
 *
 * La fila que se recarga NO la redacta este test: `ctl.persistDraftRow` hace
 * que el borde guarde el payload que escribió producción y lo devuelva clonado
 * por JSON, como una columna `jsonb`. Si producción no escribiera el campo, no
 * habría de dónde sacarlo al recargar.
 *
 * `true` y `false` viajan los dos: `false` es el caso que un `if (x)` ingenuo
 * pierde, y es el que le dice al backend "este landmark NO va en esta escena".
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act, fireEvent, cleanup } from '@testing-library/react';
import type { LiturgyContext } from '@/types/shared/liturgy';

vi.mock('@/integrations/supabase/client', async () => {
  const { makeSupabaseMock } = await import('@/lib/cuentacuentos/__tests__/pbBoundary');
  return { supabase: makeSupabaseMock() };
});

import {
  ctl,
  invokes,
  upserts,
  resetBoundary,
  type InvokeCall,
} from '@/lib/cuentacuentos/__tests__/pbBoundary';
import { storySuccessBody, type EdgeScene } from '@/lib/cuentacuentos/__tests__/pcuiWarningFixtures';
// Bytes PNG REALES: el camino de persistencia inmutable los decodifica y sube,
// así que un base64 de juguete deja la aprobación bloqueada en "sin guardar".
import { PNG_A_B64, PNG_B_B64 } from '@/lib/cuentacuentos/__tests__/pbImageFixtures';

const OPCION_1 = `data:image/png;base64,${PNG_A_B64}`;
const OPCION_2 = `data:image/png;base64,${PNG_B_B64}`;

// Producción — importada DESPUÉS del mock de borde.
import CuentacuentoEditor from '../CuentacuentoEditor';

// ---------------------------------------------------------------------------

const baseContext: LiturgyContext = {
  id: 'lit-d13',
  date: new Date('2026-05-10'),
  title: 'Liturgia T-D.13',
  readings: [],
  summary: '',
  preacher: 'Pastor Test',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
};

/**
 * Una escena con el landmark VISIBLE y otra con el landmark EXPLÍCITAMENTE no
 * visible. La tercera lo omite: un valor ausente no debe inventarse.
 */
const SCENES: EdgeScene[] = [
  { number: 1, text: 'La plaza al amanecer', visualDescription: 'plaza', landmarkVisible: true },
  { number: 2, text: 'Adentro de la casa', visualDescription: 'cocina', landmarkVisible: false },
  { number: 3, text: 'De vuelta al camino', visualDescription: 'camino' },
];

async function yields(n: number) {
  for (let i = 0; i < n; i++) await Promise.resolve();
}

/** Peticiones de ESCENA en el borde pagado (las hojas de personaje no lo son). */
function sceneRequests(): Array<{ number: unknown; scene: Record<string, unknown> }> {
  return invokes
    .filter((i) => i.fn === 'generate-scene-images' && i.body.type === 'scene')
    .map((i) => ({
      number: (i.body.scene as Record<string, unknown>)?.text,
      scene: i.body.scene as Record<string, unknown>,
    }));
}

/** El `story` del último upsert de borrador — lo que producción PERSISTIÓ. */
function persistedStory(): Record<string, unknown> | null {
  const rows = upserts.filter((u) => u.table === 'cuentacuentos_drafts');
  if (rows.length === 0) return null;
  const payload = rows[rows.length - 1].payload as Record<string, unknown>;
  return (payload.story as Record<string, unknown>) ?? null;
}

function persistedScenes(): Array<Record<string, unknown>> {
  const story = persistedStory();
  return (story?.scenes as Array<Record<string, unknown>>) ?? [];
}

/** El borde pagado: éxito para imágenes, la historia según lo pedido. */
function answerAll() {
  ctl.invokeHandler = async (call: InvokeCall) => {
    if (call.fn === 'generate-story') {
      return { data: storySuccessBody({ scenes: SCENES }), error: null };
    }
    return {
      data: {
        success: true,
        images: [OPCION_1, OPCION_2],
        skippedImages: [],
      },
      error: null,
    };
  };
}

async function mountAndGenerate() {
  const view = render(<CuentacuentoEditor context={baseContext} onStoryCreated={vi.fn()} />);
  await screen.findByRole('button', { name: /Generar cuento con IA/i }, { timeout: 10000 });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Santiago/i }));
    await yields(5);
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Generar cuento con IA/i }));
    await yields(60);
  });
  return view;
}

/**
 * Click + drenaje de microtareas. ESPERA a que el botón esté HABILITADO: un
 * `fireEvent.click` sobre un botón deshabilitado no lanza, y sin esto un gate
 * cerrado se leería como un paso que ocurrió.
 */
async function click(name: RegExp, ticks = 60) {
  const btn = await waitFor(
    () => {
      const b = screen.getByRole('button', { name }) as HTMLButtonElement;
      expect(b.disabled).toBe(false);
      return b;
    },
    { timeout: 15000 },
  );
  await act(async () => {
    fireEvent.click(btn);
    await yields(ticks);
  });
}

beforeEach(() => {
  resetBoundary();
  ctl.userId = 'user-d13';
  // Fidelidad de ida y vuelta: la lectura devuelve lo que producción escribió.
  ctl.persistDraftRow = true;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response));
  vi.useRealTimers();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------

describe('T-U.9 — la cadena completa en el editor real', () => {
  it('respuesta → Story → borrador persistido → remontaje + recuperación → petición de escena', async () => {
    answerAll();

    // --- 1. Generación: la respuesta atraviesa el mapper de producción. ------
    const first = await mountAndGenerate();
    await waitFor(
      () => expect(screen.queryByRole('button', { name: /Generar cuento con IA/i })).toBeNull(),
      { timeout: 10000 },
    );

    // --- 2. Aprobaciones REALES: son las que persisten la historia. ----------
    // El auto-persist del editor sólo escribe buffers; la historia la escribe
    // la aprobación autoritativa (flush + drain + `enqueueDraftWrite`).
    await click(/Aprobar cuento y generar imágenes/i, 120);
    // El sheet del único personaje se generó; se elige una opción.
    await click(/Opción 1/i, 40);
    await click(/Aprobar personajes/i, 120);
    // La aprobación DEBE haber avanzado el paso; si el gate quedó cerrado, esto
    // falla acá y no más adelante con un síntoma confuso.
    await screen.findByRole('button', { name: /Aprobar escenas/i }, { timeout: 15000 });

    // El paso viaja por el auto-persist DEBOUNCEADO (2 s), no por la escritura
    // autoritativa: se espera el debounce real en vez de falsear el reloj, para
    // que la fila recargada traiga el paso `scenes` como le llegaría a un
    // usuario que se va a otra pestaña.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 2500));
      await yields(80);
    });

    // --- 3. El hook de producción PERSISTIÓ los booleanos. -------------------
    await waitFor(() => expect(persistedScenes()).toHaveLength(3), { timeout: 15000 });
    const guardadas = persistedScenes();
    expect(guardadas[0].landmarkVisible).toBe(true);
    expect(guardadas[1].landmarkVisible).toBe(false);
    // Un valor ausente no se inventa.
    expect('landmarkVisible' in guardadas[2]).toBe(false);

    // --- 4. Desmontaje REAL: se pierde todo el estado en memoria. ------------
    first.unmount();
    await act(async () => { await yields(10); });
    invokes.length = 0;

    // --- 5. Remontaje SIN `initialStory`: la única fuente es la fila. --------
    render(<CuentacuentoEditor context={baseContext} onStoryCreated={vi.fn()} />);
    await click(/Recuperar borrador/i, 60);

    // El cuento volvió DESDE LA BASE, no desde una prop, y en el paso que se
    // había persistido.
    await waitFor(
      () => expect(screen.getByText(/La plaza al amanecer/)).toBeTruthy(),
      { timeout: 15000 },
    );

    // --- 6. Acciones REALES del editor que invocan `generate-scene-images`. --
    // Una por escena, por el camino NORMAL del constructor de peticiones (sin
    // prompt personalizado). El guard de producción ignora el click mientras el
    // pipeline corre, así que se espera a que cada una despache.
    for (let i = 0; i < 3; i++) {
      const antes = sceneRequests().length;
      await waitFor(
        () => {
          const botones = screen.getAllByRole('button', { name: /^Regenerar$/i });
          expect(botones.length).toBe(3);
          const b = botones[i] as HTMLButtonElement;
          expect(b.disabled).toBe(false);
          fireEvent.click(b);
          expect(sceneRequests().length).toBeGreaterThan(antes);
        },
        { timeout: 20000 },
      );
      await act(async () => { await yields(120); });
    }

    // --- 7. Los booleanos se observan EN EL BORDE, en el cuerpo enviado. -----
    await waitFor(() => expect(sceneRequests().length).toBeGreaterThanOrEqual(3), { timeout: 20000 });

    const porTexto = new Map(sceneRequests().map((r) => [String(r.number), r.scene]));
    expect(porTexto.get('La plaza al amanecer')?.landmarkVisible).toBe(true);
    expect(porTexto.get('Adentro de la casa')?.landmarkVisible).toBe(false);
    expect('landmarkVisible' in (porTexto.get('De vuelta al camino') ?? {})).toBe(false);
  }, 120000);
});
