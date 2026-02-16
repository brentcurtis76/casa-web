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
}: UseDragElementOptions): UseDragElementReturn {
  const [isDragging, setIsDragging] = useState(false);
  const startRef = useRef<{ domX: number; domY: number; baseX: number; baseY: number } | null>(null);

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
      };
      setIsDragging(true);

      const handlePointerMove = (ev: PointerEvent) => {
        if (!startRef.current) return;
        const domDX = ev.clientX - startRef.current.domX;
        const domDY = ev.clientY - startRef.current.domY;
        const { dx, dy } = toBaseDelta(domDX, domDY);
        onChange(
          Math.round(startRef.current.baseX + dx),
          Math.round(startRef.current.baseY + dy)
        );
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
    [disabled, position.x, position.y, onChange, toBaseDelta]
  );

  return { isDragging, handlePointerDown };
}
