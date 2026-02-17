import { useMemo } from 'react';
import { FORMAT_DIMENSIONS, type FormatType } from './graphicsTypes';

interface GridOverlayProps {
  /** Coordinate mapper's toDOM function */
  toDOM: (baseX: number, baseY: number) => { x: number; y: number };
  /** Coordinate mapper's image display dimensions */
  imageDisplayWidth: number;
  imageDisplayHeight: number;
  /** Coordinate mapper's offset (letterboxing) */
  offsetX: number;
  offsetY: number;
  /** Current format */
  format: FormatType;
  /** Whether the grid is visible */
  visible: boolean;
}

const GRID_DIVISIONS = 16;
const LINE_COLOR = 'rgba(0,0,0,0.08)';
const CENTER_LINE_COLOR = 'rgba(0,0,0,0.15)';

/**
 * SVG grid overlay for the drag canvas editor.
 * Renders an 8×8 grid in base coordinates, converted to DOM positions.
 * Purely visual — pointer-events: none so it doesn't interfere with dragging.
 */
export function GridOverlay({
  toDOM,
  imageDisplayWidth,
  imageDisplayHeight,
  offsetX,
  offsetY,
  format,
  visible,
}: GridOverlayProps) {
  const lines = useMemo(() => {
    if (!visible || imageDisplayWidth === 0) return [];

    const dims = FORMAT_DIMENSIONS[format];
    const stepX = dims.width / GRID_DIVISIONS;
    const stepY = dims.height / GRID_DIVISIONS;

    const result: Array<{
      x1: number; y1: number; x2: number; y2: number;
      isCenter: boolean;
    }> = [];

    // Vertical lines (skip edges at 0 and GRID_DIVISIONS)
    for (let i = 1; i < GRID_DIVISIONS; i++) {
      const baseX = i * stepX;
      const top = toDOM(baseX, 0);
      const bottom = toDOM(baseX, dims.height);
      result.push({
        x1: top.x, y1: top.y,
        x2: bottom.x, y2: bottom.y,
        isCenter: i === GRID_DIVISIONS / 2,
      });
    }

    // Horizontal lines (skip edges at 0 and GRID_DIVISIONS)
    for (let i = 1; i < GRID_DIVISIONS; i++) {
      const baseY = i * stepY;
      const left = toDOM(0, baseY);
      const right = toDOM(dims.width, baseY);
      result.push({
        x1: left.x, y1: left.y,
        x2: right.x, y2: right.y,
        isCenter: i === GRID_DIVISIONS / 2,
      });
    }

    return result;
  }, [visible, format, toDOM, imageDisplayWidth]);

  if (!visible || imageDisplayWidth === 0) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 5 }}
      width="100%"
      height="100%"
    >
      {lines.map((line, idx) => (
        <line
          key={idx}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke={line.isCenter ? CENTER_LINE_COLOR : LINE_COLOR}
          strokeWidth={line.isCenter ? 1 : 0.5}
        />
      ))}
    </svg>
  );
}
