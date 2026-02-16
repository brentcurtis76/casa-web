import { useCallback, useEffect, useRef, useState } from 'react';
import { FORMAT_DIMENSIONS, type FormatType } from '@/components/graphics/graphicsTypes';

interface CoordinateMapper {
  /** Convert DOM coordinates (relative to overlay) to base coordinates */
  toBase: (domX: number, domY: number) => { x: number; y: number };
  /** Convert base coordinates to DOM coordinates (relative to overlay) */
  toDOM: (baseX: number, baseY: number) => { x: number; y: number };
  /** Convert a DOM distance to base distance */
  toBaseDelta: (domDX: number, domDY: number) => { dx: number; dy: number };
  /** Scale factor: base units per DOM pixel */
  scaleFactor: number;
  /** The displayed image dimensions within the container */
  imageDisplayWidth: number;
  imageDisplayHeight: number;
  /** Offset of the image within the container (due to object-contain letterboxing) */
  offsetX: number;
  offsetY: number;
  /** Whether the mapper is ready (container has been measured) */
  ready: boolean;
}

/**
 * Maps between DOM preview coordinates and compositor base coordinates.
 * Handles object-contain letterboxing automatically.
 *
 * @param containerRef - Ref to the overlay container element
 * @param format - Current format being edited
 */
export function useCoordinateMapper(
  containerRef: React.RefObject<HTMLDivElement | null>,
  format: FormatType
): CoordinateMapper {
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const observerRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    observerRef.current = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ width, height });
    });

    observerRef.current.observe(el);

    // Initial measurement
    const rect = el.getBoundingClientRect();
    setContainerSize({ width: rect.width, height: rect.height });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [containerRef]);

  const dims = FORMAT_DIMENSIONS[format];
  const baseWidth = dims.width;
  const baseHeight = dims.height;

  // Compute object-contain layout
  const containerAspect = containerSize.width / (containerSize.height || 1);
  const baseAspect = baseWidth / baseHeight;

  let imageDisplayWidth: number;
  let imageDisplayHeight: number;
  let offsetX: number;
  let offsetY: number;

  if (containerSize.width === 0 || containerSize.height === 0) {
    imageDisplayWidth = 0;
    imageDisplayHeight = 0;
    offsetX = 0;
    offsetY = 0;
  } else if (containerAspect > baseAspect) {
    // Container wider than image — image is height-constrained
    imageDisplayHeight = containerSize.height;
    imageDisplayWidth = containerSize.height * baseAspect;
    offsetX = (containerSize.width - imageDisplayWidth) / 2;
    offsetY = 0;
  } else {
    // Container taller than image — image is width-constrained
    imageDisplayWidth = containerSize.width;
    imageDisplayHeight = containerSize.width / baseAspect;
    offsetX = 0;
    offsetY = (containerSize.height - imageDisplayHeight) / 2;
  }

  const scaleFactor = imageDisplayWidth > 0 ? baseWidth / imageDisplayWidth : 1;

  const toBase = useCallback(
    (domX: number, domY: number) => ({
      x: (domX - offsetX) * scaleFactor,
      y: (domY - offsetY) * scaleFactor,
    }),
    [offsetX, offsetY, scaleFactor]
  );

  const toDOM = useCallback(
    (baseX: number, baseY: number) => ({
      x: baseX / scaleFactor + offsetX,
      y: baseY / scaleFactor + offsetY,
    }),
    [offsetX, offsetY, scaleFactor]
  );

  const toBaseDelta = useCallback(
    (domDX: number, domDY: number) => ({
      dx: domDX * scaleFactor,
      dy: domDY * scaleFactor,
    }),
    [scaleFactor]
  );

  return {
    toBase,
    toDOM,
    toBaseDelta,
    scaleFactor,
    imageDisplayWidth,
    imageDisplayHeight,
    offsetX,
    offsetY,
    ready: containerSize.width > 0 && containerSize.height > 0,
  };
}
