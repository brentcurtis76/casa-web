import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { usePresentationState } from '../usePresentationState';
import type { PresentationData } from '@/lib/presentation/types';
import type { ImageOverlay, TextOverlay } from '@/lib/presentation/types';

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
