/**
 * T-A6 — Reparación VISIBLE de un borrador roto.
 *
 * Un borrador persistido en un paso avanzado (≠ `config`) sin historia
 * utilizable (`story: null`, o sin `story.id`) no puede restaurarse: el editor
 * quedaría en "generando escenas" sin nada que mostrar. Antes no había ninguna
 * ruta de salida — ni prompt, ni reparación, ni descarte.
 *
 * Contrato A6: se detecta al cargar (`storyMissing`), se avisa, y el usuario
 * elige. NUNCA se reescribe el borrador en silencio.
 *
 *   T-A6.1 — story:null en paso 'characters' ⇒ aparece el prompt reparar/descartar.
 *            Reparar ⇒ paso `config` con la configuración persistida intacta.
 *            Descartar ⇒ se borra la fila.
 *
 * Editor REAL + hooks REALES; sólo bordes externos mockeados.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import type { LiturgyContext } from '@/types/shared/liturgy';

type UpsertPayload = Record<string, unknown>;
const upsertCalls: Array<{ payload: UpsertPayload }> = [];
const deletedDraftRows: Array<{ filters: Record<string, string> }> = [];
let mockUserId: string | null = 'user-a6';
let mockDraftRow: Record<string, unknown> | null = null;

vi.mock('@/integrations/supabase/client', () => {
  let seq = 0;
  const nextUpdatedAt = () => {
    seq += 1;
    return `2026-05-01T00:00:${String(seq).padStart(2, '0')}.000Z`;
  };
  const makeDeleteChain = (tableName: string) => {
    const filters: Record<string, string> = {};
    let recorded = false;
    const run = () => {
      if (!recorded && tableName === 'cuentacuentos_drafts') {
        recorded = true;
        deletedDraftRows.push({ filters: { ...filters } });
      }
      return { error: null, data: [{ id: 'row-1' }] };
    };
    const chain = {
      eq: (col: string, val: unknown) => {
        filters[col] = String(val);
        return chain;
      },
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve(run()).then(res as never, rej as never),
      select: () => ({
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
          Promise.resolve(run()).then(res as never, rej as never),
      }),
    };
    return chain;
  };

  const upsertBuilder = (payload: UpsertPayload) => {
    const promise = (async () => {
      upsertCalls.push({ payload });
      return { error: null };
    })();
    const rowResult = async () => {
      await promise;
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
    delete: vi.fn().mockImplementation(() => makeDeleteChain(tableName)),
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
        invoke: vi.fn().mockImplementation(async () => ({
          data: { success: true, images: ['data:image/png;base64,iVBORw0KGgoAAA='] },
          error: null,
        })),
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
  id: 'lit-a6',
  date: new Date('2026-05-10'),
  title: 'Test Liturgy A6',
  readings: [],
  summary: '',
  preacher: 'Pastor Test',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
};

/** Fila ROTA: paso avanzado, sin historia. */
function brokenRow(step = 'characters', story: unknown = null) {
  return {
    liturgia_id: 'lit-a6',
    user_id: 'user-a6',
    current_step: step,
    config: {
      location: 'Jerusalén',
      customLocation: '',
      characters: 'María, José',
      style: 'reflexivo',
      illustrationStyle: 'acuarela',
      additionalNotes: 'Notas previas del usuario',
    },
    story,
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
  deletedDraftRows.length = 0;
  mockUserId = 'user-a6';
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

describe('T-A6.1 — borrador roto: prompt de reparación visible', () => {
  it('story:null en el paso characters ofrece reparar o descartar', async () => {
    mockDraftRow = brokenRow('characters', null);
    render(<CuentacuentoEditor context={baseContext} onStoryCreated={vi.fn()} />);

    await waitFor(
      () => expect(screen.queryByText(/Borrador incompleto/i)).not.toBeNull(),
      { timeout: 5000 },
    );

    // Es el prompt ESPECÍFICO de reparación, no el de recuperación normal.
    expect(screen.getByRole('button', { name: /Reparar borrador/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Descartar borrador/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Recuperar borrador/i })).toBeNull();
  });

  it('reparar aterriza en config CONSERVANDO la configuración persistida', async () => {
    mockDraftRow = brokenRow('characters', null);
    render(<CuentacuentoEditor context={baseContext} onStoryCreated={vi.fn()} />);

    const repair = await screen.findByRole('button', { name: /Reparar borrador/i }, { timeout: 5000 });
    await act(async () => {
      fireEvent.click(repair);
      await yields(10);
    });

    // El prompt desaparece y estamos en el formulario de configuración.
    expect(screen.queryByText(/Borrador incompleto/i)).toBeNull();
    const generateButton = await screen.findByRole('button', { name: /Generar cuento/i }, { timeout: 5000 });
    expect(generateButton).toBeTruthy();

    // La configuración persistida SOBREVIVE: es el punto de "reparar" frente a
    // "descartar". `characters` y `additionalNotes` son inputs controlados.
    const charactersInput = screen.getByDisplayValue('María, José');
    expect(charactersInput).toBeTruthy();
    expect(screen.getByDisplayValue('Notas previas del usuario')).toBeTruthy();

    // Reparar NO reescribe el borrador por su cuenta.
    expect(deletedDraftRows).toEqual([]);
  });

  it('descartar elimina la fila del borrador', async () => {
    mockDraftRow = brokenRow('scenes', null);
    render(<CuentacuentoEditor context={baseContext} onStoryCreated={vi.fn()} />);

    const discard = await screen.findByRole('button', { name: /Descartar borrador/i }, { timeout: 5000 });
    await act(async () => {
      fireEvent.click(discard);
      await yields(15);
    });

    await waitFor(() => expect(deletedDraftRows.length).toBeGreaterThan(0), { timeout: 5000 });
    expect(deletedDraftRows[0].filters['liturgia_id']).toBe('lit-a6');
    expect(screen.queryByText(/Borrador incompleto/i)).toBeNull();
  });

  it('una story sin id cuenta como rota igual que story:null', async () => {
    mockDraftRow = brokenRow('cover', { title: 'Sin id', characters: [], scenes: [] });
    render(<CuentacuentoEditor context={baseContext} onStoryCreated={vi.fn()} />);

    await waitFor(
      () => expect(screen.queryByText(/Borrador incompleto/i)).not.toBeNull(),
      { timeout: 5000 },
    );
  });

  it('un borrador SANO sigue mostrando el prompt de recuperación normal', async () => {
    // Guardia contra el fallo obvio: marcar todo como roto.
    mockDraftRow = brokenRow('characters', {
      id: 'story-ok',
      title: 'Cuento sano',
      characters: [],
      scenes: [],
      props: [],
      metadata: { createdAt: '', updatedAt: '', status: 'characters-pending' },
    });
    render(<CuentacuentoEditor context={baseContext} onStoryCreated={vi.fn()} />);

    await waitFor(
      () => expect(screen.queryByRole('button', { name: /Recuperar borrador/i })).not.toBeNull(),
      { timeout: 5000 },
    );
    expect(screen.queryByText(/Borrador incompleto/i)).toBeNull();
  });
});
