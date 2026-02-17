import { describe, it, expect } from 'vitest';
import { computeResizeRect, type ResizeRect } from '../useResizeElement';

const initial: ResizeRect = { x: 100, y: 100, width: 200, height: 100 };

describe('computeResizeRect', () => {
  // ===== SE handle =====
  describe('SE handle (anchor = top-left)', () => {
    it('dragged right+down increases width and height, x/y unchanged', () => {
      const result = computeResizeRect('se', initial, 50, 30, false);
      expect(result.width).toBe(250);
      expect(result.height).toBe(130);
      expect(result.x).toBe(100);
      expect(result.y).toBe(100);
    });

    it('dragged left+up decreases width and height, x/y unchanged', () => {
      const result = computeResizeRect('se', initial, -50, -30, false);
      expect(result.width).toBe(150);
      expect(result.height).toBe(70);
      expect(result.x).toBe(100);
      expect(result.y).toBe(100);
    });

    it('dragged purely right increases only width', () => {
      const result = computeResizeRect('se', initial, 80, 0, false);
      expect(result.width).toBe(280);
      expect(result.height).toBe(100);
      expect(result.x).toBe(100);
      expect(result.y).toBe(100);
    });
  });

  // ===== NW handle =====
  describe('NW handle (anchor = bottom-right)', () => {
    it('dragged left+up increases width and height, x/y decrease', () => {
      const result = computeResizeRect('nw', initial, -50, -30, false);
      expect(result.width).toBe(250);
      expect(result.height).toBe(130);
      expect(result.x).toBe(50);
      expect(result.y).toBe(70);
    });

    it('dragged right+down decreases width and height, x/y increase', () => {
      const result = computeResizeRect('nw', initial, 50, 30, false);
      expect(result.width).toBe(150);
      expect(result.height).toBe(70);
      expect(result.x).toBe(150);
      expect(result.y).toBe(130);
    });
  });

  // ===== NE handle =====
  describe('NE handle (anchor = bottom-left)', () => {
    it('dragged right+up increases width and height, x unchanged, y decreases', () => {
      const result = computeResizeRect('ne', initial, 50, -30, false);
      expect(result.width).toBe(250);
      expect(result.height).toBe(130);
      expect(result.x).toBe(100);
      expect(result.y).toBe(70);
    });
  });

  // ===== SW handle =====
  describe('SW handle (anchor = top-right)', () => {
    it('dragged left+down increases width and height, x decreases, y unchanged', () => {
      const result = computeResizeRect('sw', initial, -50, 30, false);
      expect(result.width).toBe(250);
      expect(result.height).toBe(130);
      expect(result.x).toBe(50);
      expect(result.y).toBe(100);
    });
  });

  // ===== Edge handles =====
  describe('Edge handles', () => {
    it('E handle: only width changes', () => {
      const result = computeResizeRect('e', initial, 40, 20, false);
      expect(result.width).toBe(240);
      expect(result.height).toBe(100);
      expect(result.x).toBe(100);
      expect(result.y).toBe(100);
    });

    it('W handle: width and x change', () => {
      const result = computeResizeRect('w', initial, -40, 20, false);
      expect(result.width).toBe(240);
      expect(result.x).toBe(60);
      expect(result.height).toBe(100);
      expect(result.y).toBe(100);
    });

    it('S handle: only height changes', () => {
      const result = computeResizeRect('s', initial, 40, 20, false);
      expect(result.width).toBe(200);
      expect(result.height).toBe(120);
      expect(result.x).toBe(100);
      expect(result.y).toBe(100);
    });

    it('N handle: height and y change', () => {
      const result = computeResizeRect('n', initial, 40, -20, false);
      expect(result.width).toBe(200);
      expect(result.height).toBe(120);
      expect(result.x).toBe(100);
      expect(result.y).toBe(80);
    });
  });

  // ===== Aspect ratio lock =====
  describe('Aspect ratio lock', () => {
    const square: ResizeRect = { x: 100, y: 100, width: 200, height: 200 };

    it('maintains aspect ratio within 1% tolerance (SE handle)', () => {
      const result = computeResizeRect('se', square, 60, 20, true);
      const originalAspect = square.width / square.height;
      const newAspect = result.width / result.height;
      expect(Math.abs(newAspect - originalAspect)).toBeLessThan(0.01 * originalAspect);
    });

    it('maintains aspect ratio for 2:1 rectangle (NW handle)', () => {
      const result = computeResizeRect('nw', initial, -40, -10, true);
      const originalAspect = initial.width / initial.height;
      const newAspect = result.width / result.height;
      expect(Math.abs(newAspect - originalAspect)).toBeLessThan(0.01 * originalAspect);
    });

    it('anchors correctly when aspect locked (NW)', () => {
      const result = computeResizeRect('nw', square, -50, -50, true);
      // Anchor = bottom-right = (300, 300)
      expect(result.x + result.width).toBeCloseTo(300, 0);
      expect(result.y + result.height).toBeCloseTo(300, 0);
    });
  });

  // ===== Minimum clamp =====
  describe('Minimum dimension clamp', () => {
    it('does not go below 20px width (SE shrink)', () => {
      const result = computeResizeRect('se', initial, -300, 0, false);
      expect(result.width).toBeGreaterThanOrEqual(20);
    });

    it('does not go below 20px height (SE shrink)', () => {
      const result = computeResizeRect('se', initial, 0, -300, false);
      expect(result.height).toBeGreaterThanOrEqual(20);
    });

    it('does not produce negative dimensions (NW large drag)', () => {
      const result = computeResizeRect('nw', initial, 500, 500, false);
      expect(result.width).toBeGreaterThanOrEqual(20);
      expect(result.height).toBeGreaterThanOrEqual(20);
    });
  });

  // ===== Anchor integrity =====
  describe('Anchor integrity', () => {
    it('SE: top-left corner stays fixed', () => {
      const result = computeResizeRect('se', initial, 30, 40, false);
      expect(result.x).toBe(initial.x);
      expect(result.y).toBe(initial.y);
    });

    it('NW: bottom-right corner stays fixed', () => {
      const result = computeResizeRect('nw', initial, -30, -40, false);
      expect(result.x + result.width).toBe(initial.x + initial.width);
      expect(result.y + result.height).toBe(initial.y + initial.height);
    });

    it('NE: bottom-left corner stays fixed', () => {
      const result = computeResizeRect('ne', initial, 30, -40, false);
      expect(result.x).toBe(initial.x);
      expect(result.y + result.height).toBe(initial.y + initial.height);
    });

    it('SW: top-right corner stays fixed', () => {
      const result = computeResizeRect('sw', initial, -30, 40, false);
      expect(result.x + result.width).toBe(initial.x + initial.width);
      expect(result.y).toBe(initial.y);
    });
  });
});
