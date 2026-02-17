import { useCallback, useRef } from 'react';
import type { ResizeHandle } from '@/components/graphics/graphicsTypes';

interface UseResizeElementOptions {
  /** Which handle is being used */
  handle: ResizeHandle;
  /** Current scale (for illustration) */
  currentScale?: number;
  /** Called with new scale value */
  onScaleChange?: (scale: number) => void;
  /** Current size (for logo) */
  currentSize?: number;
  /** Called with new size value */
  onSizeChange?: (size: number) => void;
  /** Current font size (for text elements) */
  currentFontSize?: number;
  /** Called with new font size value */
  onFontSizeChange?: (fontSize: number) => void;
  /** Convert DOM delta to base delta */
  toBaseDelta: (domDX: number, domDY: number) => { dx: number; dy: number };
  /** Current element width in base coords (for proportional scaling) */
  baseWidth: number;
  /** Current element height in base coords */
  baseHeight: number;
  disabled?: boolean;
}

/**
 * Hook for handling resize via corner/edge handles.
 * Corner handles resize proportionally (for illustration scale / logo size).
 */
export function useResizeElement({
  handle,
  currentScale,
  onScaleChange,
  currentSize,
  onSizeChange,
  currentFontSize,
  onFontSizeChange,
  toBaseDelta,
  baseWidth,
  baseHeight,
  disabled = false,
}: UseResizeElementOptions) {
  const startRef = useRef<{
    domX: number;
    domY: number;
    initialScale: number;
    initialSize: number;
    initialFontSize: number;
    diagonal: number;
  } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();

      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      const diagonal = Math.sqrt(baseWidth * baseWidth + baseHeight * baseHeight);

      startRef.current = {
        domX: e.clientX,
        domY: e.clientY,
        initialScale: currentScale ?? 1,
        initialSize: currentSize ?? 100,
        initialFontSize: currentFontSize ?? 16,
        diagonal: diagonal || 100,
      };

      const handlePointerMove = (ev: PointerEvent) => {
        if (!startRef.current) return;

        const domDX = ev.clientX - startRef.current.domX;
        const domDY = ev.clientY - startRef.current.domY;
        const { dx, dy } = toBaseDelta(domDX, domDY);

        // Compute signed diagonal delta based on handle position
        let diagDelta: number;
        switch (handle) {
          case 'se': diagDelta = (dx + dy) / 2; break;
          case 'nw': diagDelta = -(dx + dy) / 2; break;
          case 'ne': diagDelta = (dx - dy) / 2; break;
          case 'sw': diagDelta = (-dx + dy) / 2; break;
          case 'e': diagDelta = dx; break;
          case 'w': diagDelta = -dx; break;
          case 's': diagDelta = dy; break;
          case 'n': diagDelta = -dy; break;
          default: diagDelta = 0;
        }

        const scaleFraction = diagDelta / startRef.current.diagonal;

        if (onScaleChange && currentScale != null) {
          const newScale = Math.max(0.3, Math.min(3.0, startRef.current.initialScale * (1 + scaleFraction * 2)));
          onScaleChange(Math.round(newScale * 100) / 100);
        }

        if (onSizeChange && currentSize != null) {
          const newSize = Math.max(40, Math.min(300, Math.round(startRef.current.initialSize * (1 + scaleFraction * 2))));
          onSizeChange(newSize);
        }

        if (onFontSizeChange && currentFontSize != null) {
          const newFontSize = Math.max(16, Math.min(200, Math.round(startRef.current.initialFontSize * (1 + scaleFraction * 2))));
          onFontSizeChange(newFontSize);
        }
      };

      const handlePointerUp = () => {
        startRef.current = null;
        target.removeEventListener('pointermove', handlePointerMove);
        target.removeEventListener('pointerup', handlePointerUp);
      };

      target.addEventListener('pointermove', handlePointerMove);
      target.addEventListener('pointerup', handlePointerUp);
    },
    [disabled, handle, currentScale, currentSize, currentFontSize, onScaleChange, onSizeChange, onFontSizeChange, toBaseDelta, baseWidth, baseHeight]
  );

  return { handlePointerDown };
}
