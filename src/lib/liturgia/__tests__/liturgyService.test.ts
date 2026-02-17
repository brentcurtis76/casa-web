import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Liturgy } from '@/types/shared/liturgy';
import { saveLiturgy } from '@/lib/liturgia/liturgyService';
import { supabase } from '@/integrations/supabase/client';

type SupabaseMock = {
  from: ReturnType<typeof vi.fn>;
  auth: {
    getUser?: ReturnType<typeof vi.fn>;
  };
};

const supabaseMock = supabase as unknown as SupabaseMock;

function createTestLiturgy(): Liturgy {
  return {
    id: 'lit-1',
    context: {
      id: 'ctx-1',
      date: new Date('2026-02-01T12:00:00.000Z'),
      title: 'Liturgia Test',
      summary: 'Resumen',
      readings: [],
      createdAt: '2026-01-31T00:00:00.000Z',
      updatedAt: '2026-01-31T00:00:00.000Z',
    },
    elements: [
      {
        id: 'el-1',
        type: 'portada-principal',
        order: 0,
        title: 'Portada',
        status: 'completed',
        slides: {
          id: 'group-1',
          type: 'song',
          title: 'Portada',
          metadata: {
            sourceComponent: 'test',
            createdAt: '2026-01-31T00:00:00.000Z',
          },
          slides: [
            {
              id: 'slide-1',
              type: 'title',
              content: { primary: 'Bienvenidos' },
              style: { backgroundColor: '#FFFFFF' },
              metadata: {
                sourceComponent: 'test',
                sourceId: 'el-1',
                order: 1,
                groupTotal: 1,
              },
            },
          ],
        },
      },
    ],
    status: 'in-progress',
    metadata: {
      createdAt: '2026-01-31T00:00:00.000Z',
      updatedAt: '2026-01-31T00:00:00.000Z',
    },
  };
}

function setupBaseSaveMocks(params?: {
  elementosUpsertError?: { message: string } | null;
  cleanupError?: { message: string } | null;
}): {
  deleteSpy: ReturnType<typeof vi.fn>;
} {
  const elementosUpsertError = params?.elementosUpsertError ?? null;
  const cleanupError = params?.cleanupError ?? null;

  const notSpy = vi.fn(async () => ({ error: cleanupError }));
  const eqSpy = vi.fn(() => ({ not: notSpy }));
  const deleteSpy = vi.fn(() => ({ eq: eqSpy }));
  const upsertElementosSpy = vi.fn(async () => ({ error: elementosUpsertError }));

  supabaseMock.auth.getUser = vi.fn(async () => ({
    data: { user: { id: 'user-1' } },
    error: null,
  }));

  supabaseMock.from.mockImplementation((table: string) => {
    if (table === 'liturgias') {
      return {
        upsert: () => ({
          select: () => ({
            single: async () => ({
              data: { id: 'lit-1', fecha: '2026-02-01' },
              error: null,
            }),
          }),
        }),
      };
    }

    if (table === 'liturgia_elementos') {
      return {
        upsert: upsertElementosSpy,
        delete: deleteSpy,
      };
    }

    throw new Error(`Unexpected table in test: ${table}`);
  });

  return { deleteSpy };
}

describe('saveLiturgy failure paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns failure when liturgia_elementos upsert fails', async () => {
    const { deleteSpy } = setupBaseSaveMocks({
      elementosUpsertError: { message: 'upsert failed' },
    });

    const result = await saveLiturgy(createTestLiturgy());

    expect(result.success).toBe(false);
    expect(result.error).toContain('upsert failed');
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('returns failure when orphan cleanup fails after successful upsert', async () => {
    setupBaseSaveMocks({
      cleanupError: { message: 'cleanup failed' },
    });

    const result = await saveLiturgy(createTestLiturgy());

    expect(result.success).toBe(false);
    expect(result.error).toContain('cleanup failed');
  });
});

