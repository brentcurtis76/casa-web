import { describe, expect, it } from 'vitest';
import {
  buildOwnershipMap,
  rebuildElementsFromOwnership,
  makeSyntheticElement,
  insertSyntheticRun,
  resolveMovedSlideOwner,
} from '../elementOps';
import type { FlattenedElement } from '../types';

function el(
  id: string,
  start: number,
  end: number,
  extra: Partial<FlattenedElement> = {}
): FlattenedElement {
  return {
    id,
    type: 'portada-principal',
    title: id,
    startSlideIndex: start,
    endSlideIndex: end,
    slideCount: end - start + 1,
    dbElementId: extra.isSynthetic ? undefined : id,
    dbOrder: 0,
    isSynthetic: false,
    ...extra,
  };
}

describe('elementOps — buildOwnershipMap', () => {
  it('maps slides to their owning elements', () => {
    const elements = [el('A', 0, 1), el('B', 2, 3)];
    const ownership = buildOwnershipMap(4, elements);
    expect(ownership).toEqual(['A', 'A', 'B', 'B']);
  });

  it('marks slides outside any range as null', () => {
    const elements = [el('A', 0, 0), el('B', 2, 2)];
    const ownership = buildOwnershipMap(4, elements);
    expect(ownership).toEqual(['A', null, 'B', null]);
  });

  it('truncates element ranges that exceed slideCount', () => {
    const elements = [el('A', 0, 5)];
    const ownership = buildOwnershipMap(3, elements);
    expect(ownership).toEqual(['A', 'A', 'A']);
  });
});

describe('elementOps — rebuildElementsFromOwnership', () => {
  it('rebuilds contiguous runs into one element each', () => {
    const templates = { A: el('A', 0, 0), B: el('B', 0, 0) };
    const result = rebuildElementsFromOwnership(
      ['A', 'A', 'B', 'B', 'B'],
      templates
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: 'A', startSlideIndex: 0, endSlideIndex: 1, slideCount: 2 });
    expect(result[1]).toMatchObject({ id: 'B', startSlideIndex: 2, endSlideIndex: 4, slideCount: 3 });
  });

  it('skips null ownership entries (orphan slides)', () => {
    const templates = { A: el('A', 0, 0) };
    const result = rebuildElementsFromOwnership(['A', null, 'A'], templates);
    // Two separate runs because the null breaks contiguity, but both reference id 'A'
    expect(result).toHaveLength(2);
    expect(result[0].startSlideIndex).toBe(0);
    expect(result[1].startSlideIndex).toBe(2);
  });

  it('drops elements with no slides', () => {
    const templates = { A: el('A', 0, 0), B: el('B', 0, 0) };
    const result = rebuildElementsFromOwnership(['A', 'A'], templates);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('A');
  });
});

describe('elementOps — insertSyntheticRun', () => {
  const baseElements = [el('A', 0, 1), el('B', 2, 3)];
  const baseOwnership: (string | null)[] = ['A', 'A', 'B', 'B'];

  it('inserts at boundary without splitting', () => {
    const synthetic = makeSyntheticElement({
      id: 'syn-1',
      title: 'Imágenes',
      startSlideIndex: 2,
      slideCount: 1,
    });
    const result = insertSyntheticRun({
      baseOwnership,
      baseElements,
      insertIdx: 2,
      runLength: 1,
      syntheticId: 'syn-1',
      syntheticTemplate: synthetic,
      splitIdSuffix: 'x',
    });
    expect(result.didSplit).toBe(false);
    expect(result.ownership).toEqual(['A', 'A', 'syn-1', 'B', 'B']);
    expect(result.splitSecondHalfId).toBeNull();
  });

  it('splits an element when inserting strictly inside it', () => {
    const synthetic = makeSyntheticElement({
      id: 'syn-1',
      title: 'Imágenes',
      startSlideIndex: 1,
      slideCount: 1,
    });
    const result = insertSyntheticRun({
      baseOwnership,
      baseElements,
      insertIdx: 1,
      runLength: 1,
      syntheticId: 'syn-1',
      syntheticTemplate: synthetic,
      splitIdSuffix: 'ts1',
    });
    expect(result.didSplit).toBe(true);
    expect(result.splitSecondHalfId).toBe('A-split-ts1');
    expect(result.ownership).toEqual(['A', 'syn-1', 'A-split-ts1', 'B', 'B']);
    // The second-half template must point back to the original DB element id
    expect(result.templates['A-split-ts1']).toBeDefined();
    expect(result.templates['A-split-ts1'].dbElementId).toBe('A');
    expect(result.templates['A-split-ts1'].isSynthetic).toBe(true);
  });

  it('inserts at the very start without splitting', () => {
    const synthetic = makeSyntheticElement({
      id: 'syn-1',
      title: 'Imágenes',
      startSlideIndex: 0,
      slideCount: 2,
    });
    const result = insertSyntheticRun({
      baseOwnership,
      baseElements,
      insertIdx: 0,
      runLength: 2,
      syntheticId: 'syn-1',
      syntheticTemplate: synthetic,
      splitIdSuffix: 'x',
    });
    expect(result.didSplit).toBe(false);
    expect(result.ownership).toEqual(['syn-1', 'syn-1', 'A', 'A', 'B', 'B']);
  });

  it('inserts at the very end without splitting', () => {
    const synthetic = makeSyntheticElement({
      id: 'syn-end',
      title: 'Imágenes',
      startSlideIndex: 4,
      slideCount: 1,
    });
    const result = insertSyntheticRun({
      baseOwnership,
      baseElements,
      insertIdx: 4,
      runLength: 1,
      syntheticId: 'syn-end',
      syntheticTemplate: synthetic,
      splitIdSuffix: 'x',
    });
    expect(result.didSplit).toBe(false);
    expect(result.ownership).toEqual(['A', 'A', 'B', 'B', 'syn-end']);
  });
});

describe('elementOps — resolveMovedSlideOwner', () => {
  it('returns shared owner when neighbors match', () => {
    const owner = resolveMovedSlideOwner(['A', 'A', 'A'], 1, 'fallback');
    expect(owner).toBe('A');
  });

  it('prefers left neighbor at a boundary', () => {
    const owner = resolveMovedSlideOwner(['A', 'B'], 1, 'fallback');
    expect(owner).toBe('A');
  });

  it('returns the only available neighbor at the start', () => {
    const owner = resolveMovedSlideOwner(['A', 'A'], 0, 'fallback');
    expect(owner).toBe('A');
  });

  it('returns the only available neighbor at the end', () => {
    const owner = resolveMovedSlideOwner(['A', 'A'], 2, 'fallback');
    expect(owner).toBe('A');
  });

  it('falls back when there are no neighbors', () => {
    const owner = resolveMovedSlideOwner([], 0, 'fallback');
    expect(owner).toBe('fallback');
  });
});
