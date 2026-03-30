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

describe('presentationService custom element decoding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets FlattenedElement.type to custom for custom-{id} tipo rows', async () => {
    setupPresentationQueries({
      elementosData: [
        {
          id: 'el-custom',
          tipo: 'custom-abc123',
          orden: 0,
          titulo: 'Mi Elemento',
          status: 'completed',
          slides: [baseSlide],
          edited_slides: null,
        },
      ],
    });

    const data = await loadLiturgyForPresentation('lit-1');

    expect(data).not.toBeNull();
    expect(data?.elements).toHaveLength(1);
    expect(data?.elements[0].type).toBe('custom');
    expect(data?.elements[0].title).toBe('Mi Elemento');
    expect(data?.slides).toHaveLength(1);
  });

  it('uses Elemento personalizado as fallback label when titulo is null', async () => {
    setupPresentationQueries({
      elementosData: [
        {
          id: 'el-custom-2',
          tipo: 'custom-xyz789',
          orden: 0,
          titulo: null,
          status: 'completed',
          slides: [baseSlide],
          edited_slides: null,
        },
      ],
    });

    const data = await loadLiturgyForPresentation('lit-1');

    expect(data).not.toBeNull();
    expect(data?.elements[0].type).toBe('custom');
    expect(data?.elements[0].title).toBe('Elemento personalizado');
  });

  it('preserves correct slide ordering with mixed custom and standard elements', async () => {
    const slide1: Slide = { ...baseSlide, id: 'slide-1', content: { primary: 'Portada' } };
    const slide2: Slide = { ...baseSlide, id: 'slide-2', content: { primary: 'Custom' } };
    const slide3: Slide = { ...baseSlide, id: 'slide-3', content: { primary: 'Lectura' } };

    setupPresentationQueries({
      elementosData: [
        {
          id: 'el-1',
          tipo: 'portada-principal',
          orden: 0,
          titulo: 'Portada',
          status: 'completed',
          slides: [slide1],
          edited_slides: null,
        },
        {
          id: 'el-2',
          tipo: 'custom-abc123',
          orden: 1,
          titulo: 'Mi Custom',
          status: 'completed',
          slides: [slide2],
          edited_slides: null,
        },
        {
          id: 'el-3',
          tipo: 'lectura-biblica',
          orden: 2,
          titulo: 'Lectura',
          status: 'completed',
          slides: [slide3],
          edited_slides: null,
        },
      ],
    });

    const data = await loadLiturgyForPresentation('lit-1');

    expect(data).not.toBeNull();
    expect(data?.elements).toHaveLength(3);
    // Verify order and types
    expect(data?.elements[0].type).toBe('portada-principal');
    expect(data?.elements[0].startSlideIndex).toBe(0);
    expect(data?.elements[1].type).toBe('custom');
    expect(data?.elements[1].startSlideIndex).toBe(1);
    expect(data?.elements[2].type).toBe('lectura-biblica');
    expect(data?.elements[2].startSlideIndex).toBe(2);
    // Verify slides
    expect(data?.slides).toHaveLength(3);
    expect(data?.slides[0].id).toBe('slide-1');
    expect(data?.slides[1].id).toBe('slide-2');
    expect(data?.slides[2].id).toBe('slide-3');
  });

  it('does not affect non-custom element types', async () => {
    setupPresentationQueries({
      elementosData: [
        {
          id: 'el-std',
          tipo: 'padre-nuestro',
          orden: 0,
          titulo: null,
          status: 'completed',
          slides: [baseSlide],
          edited_slides: null,
        },
      ],
    });

    const data = await loadLiturgyForPresentation('lit-1');

    expect(data).not.toBeNull();
    expect(data?.elements[0].type).toBe('padre-nuestro');
    expect(data?.elements[0].title).toBe('Padre Nuestro');
  });
});

