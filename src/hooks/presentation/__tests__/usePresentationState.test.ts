import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { usePresentationState } from '../usePresentationState';
import type { PresentationData, FlattenedElement } from '@/lib/presentation/types';
import type { ImageOverlay, TextOverlay } from '@/lib/presentation/types';
import type { Slide } from '@/types/shared/slide';

/**
 * Creates minimal PresentationData for a given liturgy ID.
 */
function makeLiturgyData(liturgyId: string): PresentationData {
  return {
    liturgyId,
    liturgyTitle: `Liturgia ${liturgyId}`,
    liturgyDate: new Date('2026-03-01'),
    slides: [
      {
        id: `slide-${liturgyId}-1`,
        type: 'title',
        content: { primary: 'Test slide' },
        style: { backgroundColor: '#FFFFFF' },
        metadata: { sourceComponent: 'test', sourceId: 'src-1', order: 1, groupTotal: 1 },
      },
    ],
    elements: [
      {
        id: `elem-${liturgyId}-1`,
        type: 'portada-principal',
        title: 'Portada',
        startSlideIndex: 0,
        endSlideIndex: 0,
        slideCount: 1,
      },
    ],
  };
}

function makeImageOverlay(id: string): ImageOverlay {
  return {
    id,
    imageUrl: `https://example.com/${id}.png`,
    position: { x: 50, y: 50 },
    style: { opacity: 1, size: 30 },
    visible: true,
    scope: { type: 'all' },
  };
}

function makeTextOverlay(id: string): TextOverlay {
  return {
    id,
    content: `Overlay ${id}`,
    position: { x: 50, y: 50 },
    style: {
      font: 'body',
      size: 'md',
      color: 'white',
      align: 'center',
    },
    visible: true,
    scope: { type: 'all' },
  };
}

describe('usePresentationState — loadLiturgy state isolation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('resets image overlays when loading a different liturgy', () => {
    const { result } = renderHook(() => usePresentationState());

    act(() => {
      result.current.loadLiturgy(makeLiturgyData('liturgy-a'));
    });

    act(() => {
      result.current.addImageOverlay(makeImageOverlay('img-1'));
    });

    expect(result.current.state.imageOverlayState.overlays).toHaveLength(1);

    // Switch to different liturgy
    act(() => {
      result.current.loadLiturgy(makeLiturgyData('liturgy-b'));
    });

    expect(result.current.state.imageOverlayState.overlays).toHaveLength(0);
    expect(result.current.state.liveImageOverlayState.overlays).toHaveLength(0);
  });

  it('resets text overlays when loading a different liturgy', () => {
    const { result } = renderHook(() => usePresentationState());

    act(() => {
      result.current.loadLiturgy(makeLiturgyData('liturgy-a'));
    });

    act(() => {
      result.current.addTextOverlay(makeTextOverlay('txt-1'));
    });

    expect(result.current.state.textOverlayState.overlays).toHaveLength(1);

    act(() => {
      result.current.loadLiturgy(makeLiturgyData('liturgy-b'));
    });

    expect(result.current.state.textOverlayState.overlays).toHaveLength(0);
    expect(result.current.state.liveTextOverlayState.overlays).toHaveLength(0);
  });

  it('resets style overrides when loading a different liturgy', () => {
    const { result } = renderHook(() => usePresentationState());

    act(() => {
      result.current.loadLiturgy(makeLiturgyData('liturgy-a'));
    });

    act(() => {
      result.current.setStyleState({
        globalStyles: { backgroundColor: '#000' },
        elementStyles: {},
        slideStyles: {},
      });
    });

    expect(result.current.state.styleState.globalStyles).not.toBeNull();

    act(() => {
      result.current.loadLiturgy(makeLiturgyData('liturgy-b'));
    });

    expect(result.current.state.styleState.globalStyles).toBeNull();
    expect(result.current.state.styleState.elementStyles).toEqual({});
    expect(result.current.state.styleState.slideStyles).toEqual({});
  });

  it('resets temp edits when loading a different liturgy', () => {
    const { result } = renderHook(() => usePresentationState());

    act(() => {
      result.current.loadLiturgy(makeLiturgyData('liturgy-a'));
    });

    act(() => {
      result.current.editSlideContent('slide-liturgy-a-1', { primary: 'Edited' });
    });

    expect(Object.keys(result.current.state.tempEdits)).toHaveLength(1);

    act(() => {
      result.current.loadLiturgy(makeLiturgyData('liturgy-b'));
    });

    expect(result.current.state.tempEdits).toEqual({});
    expect(result.current.state.liveTempEdits).toEqual({});
  });

  it('preserves overlays when reloading the same liturgy', () => {
    const { result } = renderHook(() => usePresentationState());

    act(() => {
      result.current.loadLiturgy(makeLiturgyData('liturgy-a'));
    });

    act(() => {
      result.current.addImageOverlay(makeImageOverlay('img-1'));
      result.current.addTextOverlay(makeTextOverlay('txt-1'));
    });

    expect(result.current.state.imageOverlayState.overlays).toHaveLength(1);
    expect(result.current.state.textOverlayState.overlays).toHaveLength(1);

    // Reload SAME liturgy (e.g., session merge with updated slides)
    act(() => {
      result.current.loadLiturgy(makeLiturgyData('liturgy-a'));
    });

    expect(result.current.state.imageOverlayState.overlays).toHaveLength(1);
    expect(result.current.state.textOverlayState.overlays).toHaveLength(1);
  });

  it('preserves logo state when switching liturgies', () => {
    const { result } = renderHook(() => usePresentationState());

    act(() => {
      result.current.loadLiturgy(makeLiturgyData('liturgy-a'));
    });

    act(() => {
      result.current.updateLogo({ visible: true });
    });

    expect(result.current.state.logoState.settings.visible).toBe(true);

    act(() => {
      result.current.loadLiturgy(makeLiturgyData('liturgy-b'));
    });

    // Logo should persist across liturgy switches
    expect(result.current.state.logoState.settings.visible).toBe(true);
  });

  it('replaces slide data when loading any liturgy', () => {
    const { result } = renderHook(() => usePresentationState());

    act(() => {
      result.current.loadLiturgy(makeLiturgyData('liturgy-a'));
    });

    expect(result.current.state.data?.liturgyId).toBe('liturgy-a');
    expect(result.current.state.data?.slides[0].id).toBe('slide-liturgy-a-1');

    act(() => {
      result.current.loadLiturgy(makeLiturgyData('liturgy-b'));
    });

    expect(result.current.state.data?.liturgyId).toBe('liturgy-b');
    expect(result.current.state.data?.slides[0].id).toBe('slide-liturgy-b-1');
  });

  it('resets slide indices when loading any liturgy', () => {
    const { result } = renderHook(() => usePresentationState());

    const dataWithMultipleSlides: PresentationData = {
      ...makeLiturgyData('liturgy-a'),
      slides: [
        { id: 's1', type: 'title', content: { primary: 'A' }, style: { backgroundColor: '#fff' }, metadata: { sourceComponent: 't', sourceId: 's', order: 1, groupTotal: 2 } },
        { id: 's2', type: 'title', content: { primary: 'B' }, style: { backgroundColor: '#fff' }, metadata: { sourceComponent: 't', sourceId: 's', order: 2, groupTotal: 2 } },
      ],
    };

    act(() => {
      result.current.loadLiturgy(dataWithMultipleSlides);
    });

    act(() => {
      result.current.goToSlide(1);
    });

    expect(result.current.state.previewSlideIndex).toBe(1);

    // Load different liturgy — index should reset
    act(() => {
      result.current.loadLiturgy(makeLiturgyData('liturgy-b'));
    });

    expect(result.current.state.previewSlideIndex).toBe(0);
    expect(result.current.state.liveSlideIndex).toBe(0);
  });
});

// ============================================================================
// Element membership: addImageSlides + reorderSlide
// ============================================================================

function makeSlide(id: string, primary = id): Slide {
  return {
    id,
    type: 'title',
    content: { primary },
    style: { backgroundColor: '#FFFFFF' },
    metadata: { sourceComponent: 'test', sourceId: id, order: 0, groupTotal: 1 },
  };
}

function makeMultiElementData(): PresentationData {
  // Two existing elements: el-A holds slides [0,1], el-B holds slides [2,3]
  const slides: Slide[] = [
    makeSlide('a1', 'A1'),
    makeSlide('a2', 'A2'),
    makeSlide('b1', 'B1'),
    makeSlide('b2', 'B2'),
  ];
  const elements: FlattenedElement[] = [
    {
      id: 'el-A',
      type: 'portada-principal',
      title: 'Element A',
      startSlideIndex: 0,
      endSlideIndex: 1,
      slideCount: 2,
      dbElementId: 'el-A',
      dbOrder: 0,
      isSynthetic: false,
    },
    {
      id: 'el-B',
      type: 'lectura-biblica',
      title: 'Element B',
      startSlideIndex: 2,
      endSlideIndex: 3,
      slideCount: 2,
      dbElementId: 'el-B',
      dbOrder: 1,
      isSynthetic: false,
    },
  ];
  return {
    liturgyId: 'multi',
    liturgyTitle: 'Multi',
    liturgyDate: new Date('2026-03-01'),
    slides,
    elements,
  };
}

describe('usePresentationState — addImageSlides element membership', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('inserts synthetic element at the very start (before first element)', () => {
    const { result } = renderHook(() => usePresentationState());
    act(() => {
      result.current.loadLiturgy(makeMultiElementData());
    });

    act(() => {
      // insertAfterIndex = -1 → insert at index 0
      result.current.addImageSlides(['https://x/img1.png', 'https://x/img2.png'], -1);
    });

    const elements = result.current.state.data!.elements;
    const slides = result.current.state.data!.slides;

    expect(slides).toHaveLength(6);
    // 3 elements now: synthetic, el-A, el-B
    expect(elements).toHaveLength(3);
    expect(elements[0].isSynthetic).toBe(true);
    expect(elements[0].startSlideIndex).toBe(0);
    expect(elements[0].endSlideIndex).toBe(1);
    expect(elements[1].id).toBe('el-A');
    expect(elements[1].startSlideIndex).toBe(2);
    expect(elements[1].endSlideIndex).toBe(3);
    expect(elements[2].id).toBe('el-B');
    expect(elements[2].startSlideIndex).toBe(4);
    expect(elements[2].endSlideIndex).toBe(5);
    expect(result.current.state.hasUnpublishedChanges).toBe(true);
  });

  it('inserts synthetic element BETWEEN two existing elements', () => {
    const { result } = renderHook(() => usePresentationState());
    act(() => {
      result.current.loadLiturgy(makeMultiElementData());
    });

    act(() => {
      // Insert after slide index 1 (last slide of el-A) → at boundary, no split
      result.current.addImageSlides(['https://x/m1.png'], 1);
    });

    const elements = result.current.state.data!.elements;
    expect(elements).toHaveLength(3);
    expect(elements[0].id).toBe('el-A');
    expect(elements[0].endSlideIndex).toBe(1);
    expect(elements[1].isSynthetic).toBe(true);
    expect(elements[1].startSlideIndex).toBe(2);
    expect(elements[1].endSlideIndex).toBe(2);
    expect(elements[2].id).toBe('el-B');
    expect(elements[2].startSlideIndex).toBe(3);
    expect(elements[2].endSlideIndex).toBe(4);
  });

  it('inserts synthetic element at the end (after last element)', () => {
    const { result } = renderHook(() => usePresentationState());
    act(() => {
      result.current.loadLiturgy(makeMultiElementData());
    });

    act(() => {
      // No insertAfterIndex → append to end
      result.current.addImageSlides(['https://x/end.png']);
    });

    const elements = result.current.state.data!.elements;
    expect(elements).toHaveLength(3);
    expect(elements[2].isSynthetic).toBe(true);
    expect(elements[2].startSlideIndex).toBe(4);
    expect(elements[2].endSlideIndex).toBe(4);
  });

  it('splits an existing element when inserting strictly inside its range', () => {
    const { result } = renderHook(() => usePresentationState());
    act(() => {
      result.current.loadLiturgy(makeMultiElementData());
    });

    act(() => {
      // Insert after slide index 0 (inside el-A which spans [0,1]) → split el-A
      result.current.addImageSlides(['https://x/mid.png'], 0);
    });

    const elements = result.current.state.data!.elements;
    // el-A first half, synthetic, el-A second half (split), el-B
    expect(elements).toHaveLength(4);
    expect(elements[0].id).toBe('el-A');
    expect(elements[0].startSlideIndex).toBe(0);
    expect(elements[0].endSlideIndex).toBe(0);
    expect(elements[1].isSynthetic).toBe(true);
    expect(elements[1].startSlideIndex).toBe(1);
    expect(elements[1].endSlideIndex).toBe(1);
    // Second half of split keeps dbElementId pointer
    expect(elements[2].isSynthetic).toBe(true);
    expect(elements[2].dbElementId).toBe('el-A');
    expect(elements[2].startSlideIndex).toBe(2);
    expect(elements[2].endSlideIndex).toBe(2);
    expect(elements[3].id).toBe('el-B');
    expect(elements[3].startSlideIndex).toBe(3);
    expect(elements[3].endSlideIndex).toBe(4);
  });
});

describe('usePresentationState — reorderSlide', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('moves a slide within the same element without changing membership', () => {
    const { result } = renderHook(() => usePresentationState());
    act(() => {
      result.current.loadLiturgy(makeMultiElementData());
    });

    act(() => {
      // Swap a1 and a2 within el-A
      result.current.reorderSlide(0, 1);
    });

    const slides = result.current.state.data!.slides;
    const elements = result.current.state.data!.elements;

    expect(slides.map((s) => s.id)).toEqual(['a2', 'a1', 'b1', 'b2']);
    expect(elements).toHaveLength(2);
    expect(elements[0].id).toBe('el-A');
    expect(elements[0].startSlideIndex).toBe(0);
    expect(elements[0].endSlideIndex).toBe(1);
    expect(elements[1].id).toBe('el-B');
    expect(elements[1].startSlideIndex).toBe(2);
    expect(elements[1].endSlideIndex).toBe(3);
    // Moved slide stays selected
    expect(result.current.state.previewSlideIndex).toBe(1);
    expect(result.current.state.hasUnpublishedChanges).toBe(true);
  });

  it('moves a slide from one element to another and updates membership', () => {
    const { result } = renderHook(() => usePresentationState());
    act(() => {
      result.current.loadLiturgy(makeMultiElementData());
    });

    act(() => {
      // Move a1 (index 0, in el-A) to index 3 (between b1 and b2 in el-B)
      result.current.reorderSlide(0, 3);
    });

    const slides = result.current.state.data!.slides;
    const elements = result.current.state.data!.elements;

    expect(slides.map((s) => s.id)).toEqual(['a2', 'b1', 'b2', 'a1']);
    expect(elements).toHaveLength(2);
    // el-A shrinks to 1 slide
    expect(elements[0].id).toBe('el-A');
    expect(elements[0].startSlideIndex).toBe(0);
    expect(elements[0].endSlideIndex).toBe(0);
    expect(elements[0].slideCount).toBe(1);
    // el-B grows to include a1
    expect(elements[1].id).toBe('el-B');
    expect(elements[1].startSlideIndex).toBe(1);
    expect(elements[1].endSlideIndex).toBe(3);
    expect(elements[1].slideCount).toBe(3);
    // Moved slide stays selected at destination
    expect(result.current.state.previewSlideIndex).toBe(3);
    expect(result.current.state.previewElementIndex).toBe(1);
  });

  it('drops an element entirely when its only slide moves out', () => {
    // Build single-slide elements
    const data: PresentationData = {
      liturgyId: 'tiny',
      liturgyTitle: 'Tiny',
      liturgyDate: new Date('2026-03-01'),
      slides: [makeSlide('a'), makeSlide('b')],
      elements: [
        {
          id: 'el-A',
          type: 'portada-principal',
          title: 'A',
          startSlideIndex: 0,
          endSlideIndex: 0,
          slideCount: 1,
          dbElementId: 'el-A',
          dbOrder: 0,
          isSynthetic: false,
        },
        {
          id: 'el-B',
          type: 'lectura-biblica',
          title: 'B',
          startSlideIndex: 1,
          endSlideIndex: 1,
          slideCount: 1,
          dbElementId: 'el-B',
          dbOrder: 1,
          isSynthetic: false,
        },
      ],
    };

    const { result } = renderHook(() => usePresentationState());
    act(() => {
      result.current.loadLiturgy(data);
    });

    act(() => {
      // Move 'a' (sole slide of el-A) past 'b'
      result.current.reorderSlide(0, 1);
    });

    const slides = result.current.state.data!.slides;
    const elements = result.current.state.data!.elements;

    expect(slides.map((s) => s.id)).toEqual(['b', 'a']);
    // Both slides are now siblings under el-B (the only surviving owner range);
    // el-A loses its slide and is dropped from the list.
    expect(elements).toHaveLength(1);
    expect(elements[0].id).toBe('el-B');
    expect(elements[0].startSlideIndex).toBe(0);
    expect(elements[0].endSlideIndex).toBe(1);
  });
});
