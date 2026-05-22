import { describe, expect, it } from 'vitest';
import {
  describeTempRunPositions,
  countMovedSavedSlides,
  buildSavePlan,
  calculateChangeSummary,
} from '../saveToLiturgyService';
import {
  DEFAULT_LOGO_STATE,
  DEFAULT_TEXT_OVERLAY_STATE,
  type StyleState,
  type FlattenedElement,
  type TempSlideEdit,
} from '../types';
import type { Slide } from '@/types/shared/slide';

const emptyStyle: StyleState = {
  globalStyles: null,
  elementStyles: {},
  slideStyles: {},
};

function realSlide(id: string, primary = id): Slide {
  return {
    id,
    type: 'title',
    content: { primary },
    style: { backgroundColor: '#FFFFFF' },
    metadata: { sourceComponent: 'real', sourceId: id, order: 0, groupTotal: 1 },
  };
}

function tempSlide(id: string, primary = id): Slide {
  return {
    id,
    type: 'title',
    content: { primary },
    style: { backgroundColor: '#FFFFFF' },
    metadata: { sourceComponent: 'temp-import', sourceId: id, order: 0, groupTotal: 1 },
  };
}

function tempImageSlide(id: string, url = `https://x/${id}.png`): Slide {
  return {
    id,
    type: 'announcement-image',
    content: { primary: '', imageUrl: url },
    style: { backgroundColor: '#000' },
    metadata: { sourceComponent: 'temp-image-import', sourceId: id, order: 0, groupTotal: 1 },
  };
}

function realElement(id: string, start: number, end: number, title = id): FlattenedElement {
  return {
    id,
    type: 'portada-principal',
    title,
    startSlideIndex: start,
    endSlideIndex: end,
    slideCount: end - start + 1,
    dbElementId: id,
    dbOrder: 0,
    isSynthetic: false,
  };
}

function syntheticTempRun(
  id: string,
  start: number,
  end: number,
  title = 'Imágenes'
): FlattenedElement {
  return {
    id,
    type: 'custom',
    title,
    startSlideIndex: start,
    endSlideIndex: end,
    slideCount: end - start + 1,
    isSynthetic: true,
    // No dbElementId → es un run nuevo, no split-second-half
  };
}

describe('saveToLiturgyService — describeTempRunPositions', () => {
  it('returns empty list when there are no temp runs', () => {
    const slides = [realSlide('a'), realSlide('b')];
    const elements = [realElement('el-A', 0, 1, 'Lectura Bíblica')];
    expect(describeTempRunPositions(slides, elements)).toEqual([]);
  });

  it('describes a run inserted at the start (before any real element)', () => {
    const slides = [tempImageSlide('imported-1'), tempImageSlide('imported-2'), realSlide('a')];
    const elements = [
      syntheticTempRun('syn-1', 0, 1),
      realElement('el-A', 2, 2, 'Lectura Bíblica'),
    ];
    const positions = describeTempRunPositions(slides, elements);
    expect(positions).toHaveLength(1);
    expect(positions[0]).toEqual({
      count: 2,
      isImages: true,
      label: '2 imágenes al inicio',
    });
  });

  it('describes a run inserted after a specific real element', () => {
    const slides = [realSlide('a'), tempImageSlide('imported-1'), realSlide('b')];
    const elements = [
      realElement('el-A', 0, 0, 'Lectura Bíblica'),
      syntheticTempRun('syn-1', 1, 1),
      realElement('el-B', 2, 2, 'Padre Nuestro'),
    ];
    const positions = describeTempRunPositions(slides, elements);
    expect(positions).toEqual([
      { count: 1, isImages: true, label: '1 imagen después de Lectura Bíblica' },
    ]);
  });

  it('describes a run at the very end', () => {
    const slides = [realSlide('a'), tempImageSlide('imported-1'), tempImageSlide('imported-2')];
    const elements = [
      realElement('el-A', 0, 0, 'Portada'),
      syntheticTempRun('syn-1', 1, 2),
    ];
    const positions = describeTempRunPositions(slides, elements);
    expect(positions).toEqual([{ count: 2, isImages: true, label: '2 imágenes al final' }]);
  });

  it('describes multiple mixed runs in one liturgy', () => {
    const slides = [
      tempImageSlide('imported-0'),
      realSlide('a'),
      tempImageSlide('imported-1'),
      tempImageSlide('imported-2'),
      realSlide('b'),
      tempImageSlide('imported-3'),
    ];
    const elements = [
      syntheticTempRun('syn-0', 0, 0),
      realElement('el-A', 1, 1, 'Lectura'),
      syntheticTempRun('syn-1', 2, 3),
      realElement('el-B', 4, 4, 'Padre Nuestro'),
      syntheticTempRun('syn-2', 5, 5),
    ];
    const positions = describeTempRunPositions(slides, elements);
    expect(positions).toHaveLength(3);
    expect(positions[0].label).toBe('1 imagen al inicio');
    expect(positions[1].label).toBe('2 imágenes después de Lectura');
    expect(positions[2].label).toBe('1 imagen al final');
  });

  it('uses diapositiva noun when the run is not all images', () => {
    const slides = [realSlide('a'), tempSlide('temp-text-1', 'Texto')];
    const elements = [
      realElement('el-A', 0, 0, 'Bienvenida'),
      syntheticTempRun('syn-1', 1, 1),
    ];
    const positions = describeTempRunPositions(slides, elements);
    expect(positions).toEqual([
      { count: 1, isImages: false, label: '1 diapositiva al final' },
    ]);
  });

  it('ignores elements that have a dbElementId (treated as split halves, not new runs)', () => {
    const slides = [realSlide('a'), tempImageSlide('imported-1')];
    const elements: FlattenedElement[] = [
      realElement('el-A', 0, 0, 'Portada'),
      {
        id: 'el-A-split-1',
        type: 'portada-principal',
        title: 'Portada',
        startSlideIndex: 1,
        endSlideIndex: 1,
        slideCount: 1,
        isSynthetic: true,
        dbElementId: 'el-A', // split second half
      },
    ];
    const positions = describeTempRunPositions(slides, elements);
    // The synthetic split half is not a new temp run because it has a dbElementId,
    // but the slide it owns IS a temp slide — current contract is that splits never
    // appear as new temp runs (they reuse the original element). Confirm no positions.
    expect(positions).toEqual([]);
  });
});

describe('saveToLiturgyService — countMovedSavedSlides', () => {
  it('counts a real slide that landed in a different real element', () => {
    const slides = [realSlide('a'), realSlide('b')];
    const elements = [
      realElement('el-A', 0, 0),
      realElement('el-B', 1, 1),
    ];
    // Original ownership: a→el-B, b→el-A. Both moved.
    const count = countMovedSavedSlides(slides, elements, { a: 'el-B', b: 'el-A' });
    expect(count).toBe(2);
  });

  it('returns 0 when no slides moved', () => {
    const slides = [realSlide('a'), realSlide('b')];
    const elements = [realElement('el-A', 0, 0), realElement('el-B', 1, 1)];
    const count = countMovedSavedSlides(slides, elements, { a: 'el-A', b: 'el-B' });
    expect(count).toBe(0);
  });

  it('ignores temp slides', () => {
    const slides = [tempImageSlide('imported-1'), realSlide('b')];
    const elements = [realElement('el-A', 0, 1, 'El A')];
    const count = countMovedSavedSlides(slides, elements, { 'imported-1': 'el-B', b: 'el-A' });
    expect(count).toBe(0);
  });
});

describe('saveToLiturgyService — buildSavePlan', () => {
  it('converts each temp slide and tracks the temp→permanent mapping', () => {
    const slides = [tempImageSlide('imported-1'), tempImageSlide('imported-2')];
    const elements = [syntheticTempRun('syn-1', 0, 1)];
    const { plan, savedSlideIds } = buildSavePlan(slides, elements, {});
    expect(plan).toHaveLength(1);
    expect(plan[0].kind).toBe('new-temp-run');
    expect(plan[0].slides).toHaveLength(2);
    expect(savedSlideIds['imported-1']).toBeDefined();
    expect(savedSlideIds['imported-2']).toBeDefined();
    // Permanent ids must NOT keep the temp/imported prefix
    expect(savedSlideIds['imported-1'].startsWith('imported-')).toBe(false);
    expect(savedSlideIds['imported-1'].startsWith('temp-')).toBe(false);
  });

  it('marks new-temp-run plan items as isAllImages when every slide is an image', () => {
    const slides = [tempImageSlide('imported-1')];
    const elements = [syntheticTempRun('syn-1', 0, 0)];
    const { plan } = buildSavePlan(slides, elements, {});
    expect(plan[0].kind).toBe('new-temp-run');
    expect(plan[0].isAllImages).toBe(true);
    expect(plan[0].positionLabel).toBeDefined();
  });

  it('classifies a synthetic element with dbElementId as split-second-half', () => {
    const slides = [realSlide('a'), realSlide('b')];
    const elements: FlattenedElement[] = [
      realElement('el-A', 0, 0),
      {
        id: 'el-A-split-1',
        type: 'portada-principal',
        title: 'Portada',
        startSlideIndex: 1,
        endSlideIndex: 1,
        slideCount: 1,
        isSynthetic: true,
        dbElementId: 'el-A',
      },
    ];
    const { plan } = buildSavePlan(slides, elements, {});
    expect(plan[0].kind).toBe('existing');
    expect(plan[1].kind).toBe('split-second-half');
  });

  it('applies tempEdits when converting slides', () => {
    const slides = [tempSlide('temp-1', 'Original')];
    const elements = [syntheticTempRun('syn-1', 0, 0)];
    const edits: Record<string, TempSlideEdit> = {
      'temp-1': { content: { primary: 'Editado' } },
    };
    const { plan } = buildSavePlan(slides, elements, edits);
    expect(plan[0].slides[0].content.primary).toBe('Editado');
  });

  it('preserves orden as element array index for stable reorder', () => {
    const slides = [
      tempImageSlide('imported-0'),
      realSlide('a'),
      tempImageSlide('imported-1'),
    ];
    const elements = [
      syntheticTempRun('syn-0', 0, 0),
      realElement('el-A', 1, 1, 'Lectura'),
      syntheticTempRun('syn-1', 2, 2),
    ];
    const { plan } = buildSavePlan(slides, elements, {});
    expect(plan[0].newOrden).toBe(0);
    expect(plan[1].newOrden).toBe(1);
    expect(plan[2].newOrden).toBe(2);
  });
});

describe('saveToLiturgyService — calculateChangeSummary', () => {
  it('produces a positions summary aligned with describeTempRunPositions', () => {
    const slides = [realSlide('a'), tempImageSlide('imported-1'), tempImageSlide('imported-2')];
    const elements = [
      realElement('el-A', 0, 0, 'Bienvenida'),
      syntheticTempRun('syn-1', 1, 2),
    ];
    const summary = calculateChangeSummary(
      slides,
      emptyStyle,
      DEFAULT_LOGO_STATE,
      DEFAULT_TEXT_OVERLAY_STATE,
      DEFAULT_LOGO_STATE,
      DEFAULT_TEXT_OVERLAY_STATE,
      elements
    );
    expect(summary.tempSlides.count).toBe(2);
    expect(summary.tempSlides.positions).toEqual([
      { count: 2, isImages: true, label: '2 imágenes al final' },
    ]);
    expect(summary.hasStyleChanges).toBe(false);
    expect(summary.hasLogoChanges).toBe(false);
    expect(summary.hasTextOverlayChanges).toBe(false);
  });

  it('reports moved saved slides count via originalOwnership', () => {
    const slides = [realSlide('a'), realSlide('b')];
    const elements = [realElement('el-A', 0, 1, 'El A')];
    const summary = calculateChangeSummary(
      slides,
      emptyStyle,
      DEFAULT_LOGO_STATE,
      DEFAULT_TEXT_OVERLAY_STATE,
      DEFAULT_LOGO_STATE,
      DEFAULT_TEXT_OVERLAY_STATE,
      elements,
      { a: 'el-A', b: 'el-B' } // b moved from el-B to el-A
    );
    expect(summary.movedSavedSlidesCount).toBe(1);
  });

  it('returns empty positions when elements arg is omitted (back-compat)', () => {
    const slides = [tempImageSlide('imported-1')];
    const summary = calculateChangeSummary(
      slides,
      emptyStyle,
      DEFAULT_LOGO_STATE,
      DEFAULT_TEXT_OVERLAY_STATE,
      DEFAULT_LOGO_STATE,
      DEFAULT_TEXT_OVERLAY_STATE
    );
    expect(summary.tempSlides.count).toBe(1);
    expect(summary.tempSlides.positions).toEqual([]);
    expect(summary.movedSavedSlidesCount).toBe(0);
  });
});
