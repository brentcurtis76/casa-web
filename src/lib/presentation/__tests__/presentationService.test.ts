import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Slide } from '@/types/shared/slide';
import { loadLiturgyForPresentation } from '@/lib/presentation/presentationService';
import { supabase } from '@/integrations/supabase/client';

type SupabaseMock = {
  from: ReturnType<typeof vi.fn>;
};

const supabaseMock = supabase as unknown as SupabaseMock;

const baseSlide: Slide = {
  id: 'slide-valid-base',
  type: 'title',
  content: { primary: 'Titulo' },
  style: { backgroundColor: '#FFFFFF' },
  metadata: {
    sourceComponent: 'test',
    sourceId: 'source-1',
    order: 1,
    groupTotal: 1,
  },
};

function setupPresentationQueries(params: {
  liturgiaId?: string;
  elementosData: unknown[];
  elementosError?: unknown;
}): void {
  const liturgiaId = params.liturgiaId ?? 'lit-1';

  supabaseMock.from.mockImplementation((table: string) => {
    if (table === 'liturgias') {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: {
                id: liturgiaId,
                titulo: 'Liturgia Test',
                fecha: '2026-02-01',
                portadas_config: null,
              },
              error: null,
            }),
          }),
        }),
      };
    }

    if (table === 'liturgia_elementos') {
      return {
        select: () => ({
          eq: () => ({
            order: async () => ({
              data: params.elementosData,
              error: params.elementosError ?? null,
            }),
          }),
        }),
      };
    }

    throw new Error(`Unexpected table in test: ${table}`);
  });
}

describe('presentationService slide extraction guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls back to slides when edited_slides is malformed', async () => {
    setupPresentationQueries({
      elementosData: [
        {
          id: 'el-1',
          tipo: 'portada-principal',
          orden: 0,
          titulo: 'Portada',
          status: 'completed',
          slides: {
            id: 'group-1',
            type: 'song',
            title: 'Group',
            metadata: { sourceComponent: 'test', createdAt: '2026-02-01T00:00:00Z' },
            slides: [baseSlide],
          },
          edited_slides: [{}], // invalid shape should not shadow valid slides
        },
      ],
    });

    const data = await loadLiturgyForPresentation('lit-1');

    expect(data).not.toBeNull();
    expect(data?.slides).toHaveLength(1);
    expect(data?.slides[0].id).toBe('slide-valid-base');
    expect(data?.slides[0].type).toBe('title');
  });

  it('uses valid edited slides and filters out invalid entries', async () => {
    const editedValid: Slide = {
      ...baseSlide,
      id: 'slide-edited-valid',
      content: { primary: 'Editado' },
    };

    setupPresentationQueries({
      elementosData: [
        {
          id: 'el-1',
          tipo: 'portada-principal',
          orden: 0,
          titulo: 'Portada',
          status: 'completed',
          slides: {
            id: 'group-fallback',
            type: 'song',
            title: 'Fallback',
            metadata: { sourceComponent: 'test', createdAt: '2026-02-01T00:00:00Z' },
            slides: [{ ...baseSlide, id: 'slide-fallback' }],
          },
          edited_slides: [{ bad: true }, editedValid], // one invalid + one valid
        },
      ],
    });

    const data = await loadLiturgyForPresentation('lit-1');

    expect(data).not.toBeNull();
    expect(data?.slides).toHaveLength(1);
    expect(data?.slides[0].id).toBe('slide-edited-valid');
    expect(data?.slides[0].content.primary).toBe('Editado');
  });
});

