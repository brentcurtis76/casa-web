/**
 * T-E (A9a) — Auto-arranque por intención explícita, nivel editor.
 *
 * El auto-arranque legado se INFERÍA de una transición `prevStep→currentStep`.
 * Ese mismo par lo producen caminos que NO deben generar nada, así que la
 * inferencia disparaba de más. A9a lo reemplaza por un intent que SÓLO arma la
 * aprobación ya persistida, más una aceptación atómica del runner.
 *
 *   T-E.2 — recuperar un borrador un paso más adelante ⇒ 0 generaciones.
 *   T-E.3 — `handleEditStory` (volver a editar) ⇒ 0 generaciones.
 *   T-E.4 — aprobación OK ⇒ dispara; aprobación FALLIDA ⇒ 0 generaciones.
 *   T-E.6 — la intención no sobrevive a un cambio de época (lifecycle).
 *
 * Editor REAL + hooks REALES; sólo bordes externos mockeados. La señal medida
 * es `functions.invoke` — las llamadas de generación REALES al borde.
 *
 * HONESTIDAD SOBRE BASE-RED: estos cinco casos pasan TAMBIÉN contra la
 * implementación legada (inferencia por pares), y por tanto NO discriminan el
 * cambio. Se conservan como invariantes que deben seguir valiendo antes y
 * después — mismo criterio que los casos 1 y 4–10 de la suite f4 — no como
 * prueba del arreglo.
 *
 * Lo que SÍ discrimina A9a es la aceptación atómica del runner (`tryStart`:
 * ocupado ⇒ rechazo sin efectos, intención conservada, reintento al quedar
 * idle) y la decisión pura `shouldAutoKick`. Ambas están cubiertas, y son
 * base-red, en `src/hooks/__tests__/autoKickTryStart.e.test.ts`.
 *
 * La ventana "runner ocupado en el momento de aprobar" no es alcanzable desde
 * la UI porque el botón de aprobar está gateado por `pipeline.isRunning` (F2),
 * así que no existe un caso de editor que la ejercite honestamente; forzarlo
 * exigiría mockear el hook bajo prueba, que es justo lo que estas suites
 * prohíben.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import type { Story } from '@/types/shared/story';
import type { LiturgyContext } from '@/types/shared/liturgy';

type UpsertPayload = Record<string, unknown>;
const upsertCalls: Array<{ payload: UpsertPayload }> = [];
let upsertDefaultError: { message: string } | null = null;
/** Llamadas de GENERACIÓN al borde (excluye refine-story). */
const invokeCalls: Array<{ fn: string }> = [];
let mockUserId: string | null = 'user-e';
let mockDraftRow: Record<string, unknown> | null = null;

vi.mock('@/integrations/supabase/client', () => {
  let seq = 0;
  const nextUpdatedAt = () => {
    seq += 1;
    return `2026-05-01T00:00:${String(seq).padStart(2, '0')}.000Z`;
  };
  const makeDeleteChain = () => {
    const chain = {
      eq: () => chain,
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve({ error: null, data: [{ id: 'row' }] }).then(res as never, rej as never),
      select: () => ({
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
          Promise.resolve({ error: null, data: [{ id: 'row' }] }).then(res as never, rej as never),
      }),
    };
    return chain;
  };
  const upsertBuilder = (payload: UpsertPayload) => {
    const promise = (async () => {
      upsertCalls.push({ payload });
      return { error: upsertDefaultError };
    })();
    const rowResult = async () => {
      const r = await promise;
      if (r.error) return { data: null, error: r.error };
      return { data: { updated_at: nextUpdatedAt() }, error: null };
    };
    return {
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        promise.then(res as never, rej as never),
      select: () => ({
        maybeSingle: rowResult,
        single: rowResult,
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
          rowResult().then(res as never, rej as never),
      }),
    };
  };

  const tableApi = (tableName: string) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockImplementation(async () => ({
      data: tableName === 'cuentacuentos_drafts' ? mockDraftRow : null,
      error: null,
    })),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    upsert: vi.fn().mockImplementation((payload: UpsertPayload) => upsertBuilder(payload)),
    delete: vi.fn().mockImplementation(() => makeDeleteChain()),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
  });

  const storageApi = () => ({
    upload: vi.fn().mockImplementation(async (path: string) => ({ data: { path }, error: null })),
    getPublicUrl: vi.fn().mockImplementation((path: string) => ({
      data: { publicUrl: `https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/${path}` },
    })),
    remove: vi.fn().mockResolvedValue({ error: null }),
    list: vi.fn().mockResolvedValue({ data: [], error: null }),
    download: vi.fn().mockResolvedValue({ data: null, error: null }),
  });

  return {
    supabase: {
      from: vi.fn((table: string) => tableApi(table)),
      storage: { from: vi.fn(() => storageApi()) },
      functions: {
        invoke: vi.fn().mockImplementation(async (fn: string) => {
          invokeCalls.push({ fn });
          return {
            data: { success: true, images: ['data:image/png;base64,iVBORw0KGgoAAA='] },
            error: null,
          };
        }),
      },
      auth: {
        getUser: vi.fn().mockImplementation(async () => ({
          data: { user: mockUserId ? { id: mockUserId } : null },
        })),
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
        signUp: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
      },
    },
  };
});

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

import CuentacuentoEditor from '../CuentacuentoEditor';

const baseContext: LiturgyContext = {
  id: 'lit-e',
  date: new Date('2026-05-10'),
  title: 'Test Liturgy E',
  readings: [],
  summary: '',
  preacher: 'Pastor Test',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
};

function makeStory(id: string, status: string, withSheets = false): Story {
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
        ...(withSheets ? { characterSheetUrl: 'https://mock/char-1.png' } : {}),
      } as unknown as Story['characters'][number],
    ],
    scenes: [
      { number: 1, text: 'Escena de apertura', visualDescription: 'plaza soleada' } as unknown as Story['scenes'][number],
    ],
    props: [] as unknown as Story['props'],
    spiritualConnection: 'Esperanza',
    metadata: { createdAt: '', updatedAt: '', status: status as Story['metadata']['status'] },
  } as unknown as Story;
}

/** Fila de borrador persistida en el paso `characters` (recuperable). */
function draftRowAtCharacters(storyId: string) {
  return {
    liturgia_id: 'lit-e',
    user_id: 'user-e',
    current_step: 'characters',
    config: {
      location: 'Jerusalén', customLocation: '', characters: 'María',
      style: 'reflexivo', illustrationStyle: 'ghibli', additionalNotes: '',
    },
    story: {
      id: storyId,
      title: 'Cuento recuperado',
      summary: 'Resumen',
      characters: [
        { id: 'char-1', name: 'María', role: 'protagonist', description: 'Niña', visualDescription: 'niña con vestido azul' },
      ],
      scenes: [{ number: 1, text: 'Escena', visualDescription: 'plaza' }],
      props: [],
      metadata: { createdAt: '', updatedAt: '', status: 'characters-pending' },
    },
    selected_character_sheets: {},
    selected_scene_images: {},
    selected_cover: null,
    selected_end: null,
    image_paths: {},
    updated_at: '2026-05-01T00:00:00Z',
  };
}

beforeEach(() => {
  upsertCalls.length = 0;
  invokeCalls.length = 0;
  upsertDefaultError = null;
  mockUserId = 'user-e';
  mockDraftRow = null;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ error: null }) } as unknown as Response));
  vi.useRealTimers();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function yields(n: number) {
  for (let i = 0; i < n; i++) await Promise.resolve();
}

const generationInvokes = () => invokeCalls.filter((c) => c.fn !== 'refine-story');

describe('T-E.2 — recuperar un borrador un paso más adelante NO genera', () => {
  it('aceptar la recuperación en el paso characters hace 0 generaciones', async () => {
    mockDraftRow = draftRowAtCharacters('story-e2');
    render(<CuentacuentoEditor context={baseContext} onStoryCreated={vi.fn()} />);

    const recover = await screen.findByRole('button', { name: /Recuperar borrador/i }, { timeout: 5000 });
    invokeCalls.length = 0;

    await act(async () => {
      fireEvent.click(recover);
      await yields(40);
    });
    // Margen amplio: si algún efecto disparara tarde, aparecería acá.
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); await yields(20); });

    // La restauración aterriza en `characters` (el mismo par de pasos que la
    // inferencia legada trataba como avance) pero NADIE aprobó nada.
    expect(generationInvokes()).toEqual([]);
  });
});

describe('T-E.3 — volver a editar un cuento existente NO genera', () => {
  it('handleEditStory no dispara ninguna generación', async () => {
    render(
      <CuentacuentoEditor
        context={baseContext}
        initialStory={makeStory('story-e3', 'ready', true)}
        onStoryCreated={vi.fn()}
      />
    );

    // El cuento llega `ready` ⇒ paso `complete`, con la opción de editarlo.
    const edit = await screen.findByRole('button', { name: /Editar cuento/i }, { timeout: 5000 });
    invokeCalls.length = 0;

    await act(async () => {
      fireEvent.click(edit);
      await yields(40);
    });
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); await yields(20); });

    expect(generationInvokes()).toEqual([]);
  });
});

describe('T-E.4 — sólo una aprobación PERSISTIDA arma el auto-arranque', () => {
  it('aprobar el cuento con guardado OK dispara la generación de personajes', async () => {
    render(
      <CuentacuentoEditor
        context={baseContext}
        initialStory={makeStory('story-e4ok', 'story-generated')}
        onStoryCreated={vi.fn()}
      />
    );
    const approve = await screen.findByRole('button', { name: /Aprobar cuento y generar imágenes/i }, { timeout: 5000 });
    await act(async () => { await yields(10); });
    invokeCalls.length = 0;

    await act(async () => {
      fireEvent.click(approve);
      await yields(40);
    });

    await waitFor(() => expect(generationInvokes().length).toBeGreaterThan(0), { timeout: 5000 });
  });

  it('si el guardado de la aprobación FALLA no se genera nada', async () => {
    render(
      <CuentacuentoEditor
        context={baseContext}
        initialStory={makeStory('story-e4fail', 'story-generated')}
        onStoryCreated={vi.fn()}
      />
    );
    const approve = await screen.findByRole('button', { name: /Aprobar cuento y generar imágenes/i }, { timeout: 5000 });
    await act(async () => { await yields(10); });
    invokeCalls.length = 0;

    // La escritura autoritativa falla ⇒ no hay commit ⇒ no hay intención.
    upsertDefaultError = { message: 'upsert boom' };
    await act(async () => {
      fireEvent.click(approve);
      await yields(40);
    });
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); await yields(20); });

    expect(generationInvokes()).toEqual([]);
    // Y seguimos en el paso del cuento: no hubo transición.
    expect(screen.queryByRole('button', { name: /Aprobar cuento y generar imágenes/i })).not.toBeNull();
  });
});

describe('T-E.6 — la intención no sobrevive a un cambio de lifecycle', () => {
  it('regenerar tras aprobar no arrastra el auto-arranque de la época anterior', async () => {
    render(
      <CuentacuentoEditor
        context={baseContext}
        initialStory={makeStory('story-e6', 'story-generated')}
        onStoryCreated={vi.fn()}
      />
    );
    const approve = await screen.findByRole('button', { name: /Aprobar cuento y generar imágenes/i }, { timeout: 5000 });
    await act(async () => { await yields(10); });

    await act(async () => {
      fireEvent.click(approve);
      await yields(40);
    });
    await waitFor(() => expect(generationInvokes().length).toBeGreaterThan(0), { timeout: 5000 });

    // El auto-arranque de esta época ya se consumió: no se re-dispara solo.
    const afterKick = generationInvokes().length;
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); await yields(30); });
    expect(generationInvokes().length).toBe(afterKick);
  });
});
