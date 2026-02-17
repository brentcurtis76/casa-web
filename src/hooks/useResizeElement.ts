import { useCallback, useRef } from 'react';
import type { ResizeHandle } from '@/components/graphics/graphicsTypes';

export interface ResizeUpdate {
  x: number;
  y: number;
  scale?: number;
  fontSize?: number;
  size?: number;
}

interface UseResizeElementOptions {
  /** Which handle is being used */
  handle: ResizeHandle;
  /** Current scale (for illustration) */
  currentScale?: number;
  /** Current size (for logo) */
  currentSize?: number;
  /** Current font size (for text elements) */
  currentFontSize?: number;
  /** Combined callback — receives ALL resize data in one call to avoid competing state updates */
  onResizeUpdate?: (update: ResizeUpdate) => void;
  /** @deprecated Use onResizeUpdate instead — kept for backwards compat */
  onScaleChange?: (scale: number) => void;
  /** @deprecated Use onResizeUpdate instead */
  onSizeChange?: (size: number) => void;
  /** @deprecated Use onResizeUpdate instead */
  onFontSizeChange?: (fontSize: number) => void;
  /** @deprecated Use onResizeUpdate instead */
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
  /** Snap position to grid */
  snapToGrid?: boolean;
  /** Grid cell size in base coordinates */
  gridSize?: number;
}

/** Minimum dimension in base coordinates */
const MIN_DIMENSION = 20;

export interface ResizeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Pure anchor-based rectangle solver.
 * Given a handle, initial rect, and pointer delta, compute the new rectangle
 * by keeping the opposite corner as a fixed anchor.
 */
export function computeResizeRect(
  handle: ResizeHandle,
  initialRect: ResizeRect,
  dx: number,
  dy: number,
  lockAspectRatio: boolean
): ResizeRect {
  const { x, y, width, height } = initialRect;

  let newWidth: number;
  let newHeight: number;
  let newX: number;
  let newY: number;

  switch (handle) {
    case 'se': {
      // Anchor = top-left (x, y)
      newWidth = width + dx;
      newHeight = height + dy;
      newX = x;
      newY = y;
      break;
    }
    case 'nw': {
      // Anchor = bottom-right (x + width, y + height)
      const anchorX = x + width;
      const anchorY = y + height;
      newWidth = width - dx;
      newHeight = height - dy;
      newX = anchorX - newWidth;
      newY = anchorY - newHeight;
      break;
    }
    case 'ne': {
      // Anchor = bottom-left (x, y + height)
      const anchorY = y + height;
      newWidth = width + dx;
      newHeight = height - dy;
      newX = x;
      newY = anchorY - newHeight;
      break;
    }
    case 'sw': {
      // Anchor = top-right (x + width, y)
      const anchorX = x + width;
      newWidth = width - dx;
      newHeight = height + dy;
      newX = anchorX - newWidth;
      newY = y;
      break;
    }
    // Edge handles: only move one axis
    case 'e': {
      newWidth = width + dx;
      newHeight = height;
      newX = x;
      newY = y;
      break;
    }
    case 'w': {
      const anchorX = x + width;
      newWidth = width - dx;
      newHeight = height;
      newX = anchorX - newWidth;
      newY = y;
      break;
    }
    case 's': {
      newWidth = width;
      newHeight = height + dy;
      newX = x;
      newY = y;
      break;
    }
    case 'n': {
      const anchorY = y + height;
      newWidth = width;
      newHeight = height - dy;
      newX = x;
      newY = anchorY - newHeight;
      break;
    }
    default: {
      newWidth = width;
      newHeight = height;
      newX = x;
      newY = y;
    }
  }

  // Aspect ratio lock: pick dominant axis, scale the other to match
  if (lockAspectRatio && width > 0 && height > 0) {
    const aspect = width / height;
    const widthChange = Math.abs(newWidth - width);
    const heightChange = Math.abs(newHeight - height);

    if (widthChange >= heightChange) {
      // Width is dominant — derive height from it
      newHeight = newWidth / aspect;
    } else {
      // Height is dominant — derive width from it
      newWidth = newHeight * aspect;
    }

    // Recompute position from anchor after aspect correction
    switch (handle) {
      case 'se':
      case 'e':
      case 's':
        // Anchor is top-left, no position change needed
        break;
      case 'nw': {
        const anchorX = x + width;
        const anchorY = y + height;
        newX = anchorX - newWidth;
        newY = anchorY - newHeight;
        break;
      }
      case 'ne':
      case 'n': {
        const anchorY = y + height;
        newX = x;
        newY = anchorY - newHeight;
        break;
      }
      case 'sw':
      case 'w': {
        const anchorX = x + width;
        newX = anchorX - newWidth;
        newY = y;
        break;
      }
    }
  }

  // Clamp minimum dimensions
  if (newWidth < MIN_DIMENSION) {
    const clampedWidth = MIN_DIMENSION;
    // Adjust position if anchor is on the right side
    if (handle === 'nw' || handle === 'sw' || handle === 'w') {
      newX = newX + (newWidth - clampedWidth);
    }
    newWidth = clampedWidth;
  }
  if (newHeight < MIN_DIMENSION) {
    const clampedHeight = MIN_DIMENSION;
    if (handle === 'nw' || handle === 'ne' || handle === 'n') {
      newY = newY + (newHeight - clampedHeight);
    }
    newHeight = clampedHeight;
  }

  return { x: newX, y: newY, width: newWidth, height: newHeight };
}

/**
 * Hook for handling resize via corner/edge handles.
 * Uses anchor-based rectangle solver: the opposite corner stays fixed,
 * the dragged corner follows the pointer.
 */
export function useResizeElement({
  handle,
  currentScale,
  currentSize,
  currentFontSize,
  onResizeUpdate,
  onScaleChange,
  onSizeChange,
  onFontSizeChange,
  onPositionChange,
  initialX,
  initialY,
  toBaseDelta,
  baseWidth,
  baseHeight,
  disabled = false,
  snapToGrid = false,
  gridSize = 0,
}: UseResizeElementOptions) {
  const startRef = useRef<{
    domX: number;
    domY: number;
    initialScale: number;
    initialSize: number;
    initialFontSize: number;
    initialRect: ResizeRect;
  } | null>(null);

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
        initialScale: currentScale ?? 1,
        initialSize: currentSize ?? 100,
        initialFontSize: currentFontSize ?? 16,
        initialRect: {
          x: initialX ?? 0,
          y: initialY ?? 0,
          width: baseWidth,
          height: baseHeight,
        },
      };

      const handlePointerMove = (ev: PointerEvent) => {
        if (!startRef.current) return;

        const domDX = ev.clientX - startRef.current.domX;
        const domDY = ev.clientY - startRef.current.domY;
        const { dx, dy } = toBaseDelta(domDX, domDY);

        const isAspectLocked = (currentScale != null) || (currentSize != null);

        const newRect = computeResizeRect(
          handle,
          startRef.current.initialRect,
          dx,
          dy,
          isAspectLocked
        );

        const initRect = startRef.current.initialRect;

        // If combined callback is provided, use it for a SINGLE state update
        if (onResizeUpdate) {
          let snappedX = newRect.x;
          let snappedY = newRect.y;
          if (snapToGrid && gridSize > 0) {
            snappedX = Math.round(snappedX / gridSize) * gridSize;
            snappedY = Math.round(snappedY / gridSize) * gridSize;
          }
          const update: ResizeUpdate = { x: snappedX, y: snappedY };

          if (currentScale != null) {
            const widthRatio = newRect.width / initRect.width;
            update.scale = Math.round(Math.max(0.1, Math.min(3.0, startRef.current.initialScale * widthRatio)) * 100) / 100;
          }

          if (currentSize != null) {
            const widthRatio = newRect.width / initRect.width;
            update.size = Math.max(20, Math.min(400, Math.round(startRef.current.initialSize * widthRatio)));
          }

          if (currentFontSize != null) {
            const heightRatio = newRect.height / initRect.height;
            update.fontSize = Math.max(12, Math.min(200, Math.round(startRef.current.initialFontSize * heightRatio)));
          }

          onResizeUpdate(update);
          return;
        }

        // Legacy: separate callbacks (prone to competing state updates)
        if (onScaleChange && currentScale != null) {
          const widthRatio = newRect.width / initRect.width;
          const newScale = Math.max(0.1, Math.min(3.0, startRef.current.initialScale * widthRatio));
          onScaleChange(Math.round(newScale * 100) / 100);
        }

        if (onSizeChange && currentSize != null) {
          const widthRatio = newRect.width / initRect.width;
          const newSize = Math.max(20, Math.min(400, Math.round(startRef.current.initialSize * widthRatio)));
          onSizeChange(newSize);
        }

        if (onFontSizeChange && currentFontSize != null) {
          const heightRatio = newRect.height / initRect.height;
          const newFontSize = Math.max(12, Math.min(200, Math.round(startRef.current.initialFontSize * heightRatio)));
          onFontSizeChange(newFontSize);
        }

        if (onPositionChange) {
          onPositionChange(newRect.x, newRect.y);
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
    [disabled, handle, currentScale, currentSize, currentFontSize, onResizeUpdate, onScaleChange, onSizeChange, onFontSizeChange, onPositionChange, initialX, initialY, toBaseDelta, baseWidth, baseHeight, snapToGrid, gridSize]
  );

  return { handlePointerDown };
}
