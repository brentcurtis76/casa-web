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
  /** Called with new position when resizing changes element position */
  onPositionChange?: (x: number, y: number) => void;
  /** Initial X position (captured at pointer-down) */
  initialX?: number;
  /** Initial Y position (captured at pointer-down) */
  initialY?: number;
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
  onPositionChange,
  initialX,
  initialY,
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
    initialX: number;
    initialY: number;
    initialWidth: number;
    initialHeight: number;
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
        initialX: initialX ?? 0,
        initialY: initialY ?? 0,
        initialWidth: baseWidth,
        initialHeight: baseHeight,
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

        // Compute new dimensions and position based on element type
        let newWidth = startRef.current.initialWidth;
        let newHeight = startRef.current.initialHeight;
        let newX = startRef.current.initialX;
        let newY = startRef.current.initialY;

        if (onScaleChange && currentScale != null) {
          const newScale = Math.max(0.3, Math.min(3.0, startRef.current.initialScale * (1 + scaleFraction * 2)));
          onScaleChange(Math.round(newScale * 100) / 100);

          // For illustration scale: dimension change = (newScale/initialScale - 1) * baseDimensions
          const scaleRatio = newScale / startRef.current.initialScale;
          newWidth = startRef.current.initialWidth * scaleRatio;
          newHeight = startRef.current.initialHeight * scaleRatio;
        }

        if (onSizeChange && currentSize != null) {
          const newSize = Math.max(40, Math.min(300, Math.round(startRef.current.initialSize * (1 + scaleFraction * 2))));
          onSizeChange(newSize);

          // For logo size: dimension change = (newSize/initialSize - 1) * baseDimensions
          const sizeRatio = newSize / startRef.current.initialSize;
          newWidth = startRef.current.initialWidth * sizeRatio;
          newHeight = startRef.current.initialHeight * sizeRatio;
        }

        if (onFontSizeChange && currentFontSize != null) {
          const newFontSize = Math.max(16, Math.min(200, Math.round(startRef.current.initialFontSize * (1 + scaleFraction * 2))));
          onFontSizeChange(newFontSize);

          // For text fontSize: dimension change = (newFontSize/initialFontSize - 1) * baseDimensions
          const fontRatio = newFontSize / startRef.current.initialFontSize;
          newWidth = startRef.current.initialWidth * fontRatio;
          newHeight = startRef.current.initialHeight * fontRatio;
        }

        // Calculate position offset per handle (anchor opposite corner)
        if (onPositionChange) {
          const deltaWidth = newWidth - startRef.current.initialWidth;
          const deltaHeight = newHeight - startRef.current.initialHeight;

          switch (handle) {
            case 'se':
              // No position change (origin stays fixed)
              break;
            case 'nw':
              newX = startRef.current.initialX - deltaWidth;
              newY = startRef.current.initialY - deltaHeight;
              break;
            case 'ne':
              newY = startRef.current.initialY - deltaHeight;
              break;
            case 'sw':
              newX = startRef.current.initialX - deltaWidth;
              break;
          }

          onPositionChange(newX, newY);
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
    [disabled, handle, currentScale, currentSize, currentFontSize, onScaleChange, onSizeChange, onFontSizeChange, onPositionChange, initialX, initialY, toBaseDelta, baseWidth, baseHeight]
  );

  return { handlePointerDown };
}
