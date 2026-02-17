import { useCallback, useRef, useState } from 'react';

interface UseDragElementOptions {
  /** Current position in base coordinates */
  position: { x: number; y: number };
  /** Called with new position in base coordinates */
  onChange: (x: number, y: number) => void;
  /** Convert DOM delta to base delta */
  toBaseDelta: (domDX: number, domDY: number) => { dx: number; dy: number };
  /** Whether drag is disabled */
  disabled?: boolean;
  /** Snap position to grid */
  snapToGrid?: boolean;
  /** Grid cell size in base coordinates */
  gridSize?: number;
}

interface UseDragElementReturn {
  isDragging: boolean;
  handlePointerDown: (e: React.PointerEvent) => void;
}

/**
 * Custom hook for making an element draggable using pointer events.
 * Works with both mouse and touch. Returns pointer event handlers
 * that should be attached to the draggable element.
 */
export function useDragElement({
  position,
  onChange,
  toBaseDelta,
  disabled = false,
  snapToGrid = false,
  gridSize = 0,
}: UseDragElementOptions): UseDragElementReturn {
  const [isDragging, setIsDragging] = useState(false);
  const startRef = useRef<{ domX: number; domY: number; baseX: number; baseY: number; dragStarted: boolean } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();

      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      startRef.current = {
        domX: e.clientX,
        domY: e.clientY,
        baseX: position.x,
        baseY: position.y,
        dragStarted: false,
      };
      setIsDragging(true);

      const handlePointerMove = (ev: PointerEvent) => {
        if (!startRef.current) return;
        const domDX = ev.clientX - startRef.current.domX;
        const domDY = ev.clientY - startRef.current.domY;

        // 3px threshold to prevent click jitter
        if (!startRef.current.dragStarted) {
          if (Math.abs(domDX) < 3 && Math.abs(domDY) < 3) return;
          startRef.current.dragStarted = true;
        }

        const { dx, dy } = toBaseDelta(domDX, domDY);
        let newX = Math.round(startRef.current.baseX + dx);
        let newY = Math.round(startRef.current.baseY + dy);
        if (snapToGrid && gridSize > 0) {
          newX = Math.round(newX / gridSize) * gridSize;
          newY = Math.round(newY / gridSize) * gridSize;
        }
        onChange(newX, newY);
      };

      const handlePointerUp = () => {
        startRef.current = null;
        setIsDragging(false);
        target.removeEventListener('pointermove', handlePointerMove);
        target.removeEventListener('pointerup', handlePointerUp);
      };

      target.addEventListener('pointermove', handlePointerMove);
      target.addEventListener('pointerup', handlePointerUp);
    },
    [disabled, position.x, position.y, onChange, toBaseDelta, snapToGrid, gridSize]
  );

  return { isDragging, handlePointerDown };
}
