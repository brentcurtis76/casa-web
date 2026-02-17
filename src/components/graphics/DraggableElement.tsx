import { useCallback, useEffect, useRef, useState } from 'react';
import { useDragElement } from '@/hooks/useDragElement';
import { useResizeElement, type ResizeUpdate } from '@/hooks/useResizeElement';
import {
  ELEMENT_META,
  SELECTION_COLORS,
  type ResizeHandle,
} from './graphicsTypes';

interface DraggableElementProps {
  id: string;
  domX: number;
  domY: number;
  domWidth: number;
  domHeight: number;
  baseX: number;
  baseY: number;
  baseWidth: number;
  baseHeight: number;
  onPositionChange: (x: number, y: number) => void;
  toBaseDelta: (domDX: number, domDY: number) => { dx: number; dy: number };
  isSelected: boolean;
  onSelect: () => void;
  visible: boolean;
  isResizable: boolean;
  currentScale?: number;
  onScaleChange?: (scale: number) => void;
  currentSize?: number;
  onSizeChange?: (size: number) => void;
  currentFontSize?: number;
  onFontSizeChange?: (fontSize: number) => void;
  onResizePositionChange?: (x: number, y: number) => void;
  /** Combined resize callback — single state update for position + scale/fontSize/size */
  onResizeUpdate?: (update: ResizeUpdate) => void;
  /** Snap to grid */
  snapToGrid?: boolean;
  /** Grid cell size in base coordinates */
  gridSize?: number;
}

const HANDLE_SIZE = 14;
const HALF = HANDLE_SIZE / 2;

const CORNER_HANDLES: Array<{
  id: ResizeHandle;
  style: React.CSSProperties;
  cursor: string;
}> = [
  { id: 'nw', style: { top: -HALF, left: -HALF }, cursor: 'nw-resize' },
  { id: 'ne', style: { top: -HALF, right: -HALF }, cursor: 'ne-resize' },
  { id: 'se', style: { bottom: -HALF, right: -HALF }, cursor: 'se-resize' },
  { id: 'sw', style: { bottom: -HALF, left: -HALF }, cursor: 'sw-resize' },
];

const EDGE_HANDLES: Array<{
  id: ResizeHandle;
  style: React.CSSProperties;
  cursor: string;
}> = [
  { id: 'n', style: { top: -HALF, left: '50%', marginLeft: -HALF }, cursor: 'n-resize' },
  { id: 'e', style: { top: '50%', right: -HALF, marginTop: -HALF }, cursor: 'e-resize' },
  { id: 's', style: { bottom: -HALF, left: '50%', marginLeft: -HALF }, cursor: 's-resize' },
  { id: 'w', style: { top: '50%', left: -HALF, marginTop: -HALF }, cursor: 'w-resize' },
];

const ALL_HANDLES = [...CORNER_HANDLES, ...EDGE_HANDLES];

function ResizeHandleEl({
  handle,
  isResizable,
  currentScale,
  onScaleChange,
  currentSize,
  onSizeChange,
  currentFontSize,
  onFontSizeChange,
  onResizePositionChange,
  onResizeUpdate,
  baseX,
  baseY,
  toBaseDelta,
  baseWidth,
  baseHeight,
  snapToGrid,
  gridSize,
}: {
  handle: (typeof ALL_HANDLES)[number];
  isResizable: boolean;
  currentScale?: number;
  onScaleChange?: (s: number) => void;
  currentSize?: number;
  onSizeChange?: (s: number) => void;
  currentFontSize?: number;
  onFontSizeChange?: (fontSize: number) => void;
  onResizePositionChange?: (x: number, y: number) => void;
  onResizeUpdate?: (update: ResizeUpdate) => void;
  baseX: number;
  baseY: number;
  toBaseDelta: (dx: number, dy: number) => { dx: number; dy: number };
  baseWidth: number;
  baseHeight: number;
  snapToGrid?: boolean;
  gridSize?: number;
}) {
  const isCorner = ['nw', 'ne', 'se', 'sw'].includes(handle.id);
  const canResize = isResizable && isCorner;
  const handleRef = useRef<HTMLDivElement>(null);

  const { handlePointerDown } = useResizeElement({
    handle: handle.id,
    currentScale,
    onScaleChange,
    currentSize,
    onSizeChange,
    currentFontSize,
    onFontSizeChange,
    onPositionChange: onResizePositionChange,
    onResizeUpdate,
    initialX: baseX,
    initialY: baseY,
    toBaseDelta,
    baseWidth,
    baseHeight,
    disabled: !canResize,
    snapToGrid,
    gridSize,
  });

  // Use native event listener to guarantee stopPropagation works
  // before React's delegated event system can fire the parent's handler
  useEffect(() => {
    const el = handleRef.current;
    if (!el) return;

    const nativeHandler = (e: PointerEvent) => {
      // Stop propagation in the native DOM before React sees it
      e.stopPropagation();
      e.preventDefault();
      if (canResize) {
        handlePointerDown(e as unknown as React.PointerEvent);
      }
    };

    el.addEventListener('pointerdown', nativeHandler, { capture: false });
    return () => el.removeEventListener('pointerdown', nativeHandler);
  }, [canResize, handlePointerDown]);

  return (
    <div
      ref={handleRef}
      className="absolute touch-none"
      style={{
        ...handle.style,
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
        background: SELECTION_COLORS.handleFill,
        border: `1px solid ${SELECTION_COLORS.handleBorder}`,
        boxShadow: SELECTION_COLORS.handleShadow,
        borderRadius: 1,
        cursor: canResize ? handle.cursor : 'default',
        zIndex: 60,
      }}
    />
  );
}

/** Info shown in the resize feedback badge */
interface ResizeInfo {
  widthPercent: number;
  heightPercent: number;
  width: number;
  height: number;
}

export function DraggableElement({
  id,
  domX,
  domY,
  domWidth,
  domHeight,
  baseX,
  baseY,
  baseWidth,
  baseHeight,
  onPositionChange,
  toBaseDelta,
  isSelected,
  onSelect,
  visible,
  isResizable,
  currentScale,
  onScaleChange,
  currentSize,
  onSizeChange,
  currentFontSize,
  onFontSizeChange,
  onResizePositionChange,
  onResizeUpdate,
  snapToGrid,
  gridSize,
}: DraggableElementProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [resizeInfo, setResizeInfo] = useState<ResizeInfo | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const initialDimsRef = useRef<{ width: number; height: number } | null>(null);

  const { isDragging, handlePointerDown } = useDragElement({
    position: { x: baseX, y: baseY },
    onChange: onPositionChange,
    toBaseDelta,
    disabled: !visible,
    snapToGrid,
    gridSize,
  });

  // Wrap onResizeUpdate to capture resize info for the badge
  const wrappedResizeUpdate = useCallback(
    (update: ResizeUpdate) => {
      // Capture initial dimensions on first resize update
      if (!initialDimsRef.current) {
        initialDimsRef.current = { width: baseWidth, height: baseHeight };
      }

      // Compute new dimensions from the update
      let newWidth = baseWidth;
      let newHeight = baseHeight;
      if (update.scale != null && currentScale != null && currentScale > 0) {
        const scaleRatio = update.scale / currentScale;
        newWidth = baseWidth * scaleRatio;
        newHeight = baseHeight * scaleRatio;
      } else if (update.size != null && currentSize != null && currentSize > 0) {
        const sizeRatio = update.size / currentSize;
        newWidth = baseWidth * sizeRatio;
        newHeight = baseHeight * sizeRatio;
      } else if (update.fontSize != null && currentFontSize != null && currentFontSize > 0) {
        const fontRatio = update.fontSize / currentFontSize;
        newWidth = baseWidth * fontRatio;
        newHeight = baseHeight * fontRatio;
      }

      const initW = initialDimsRef.current.width;
      const initH = initialDimsRef.current.height;

      setResizeInfo({
        widthPercent: initW > 0 ? Math.round((newWidth / initW) * 100) : 100,
        heightPercent: initH > 0 ? Math.round((newHeight / initH) * 100) : 100,
        width: Math.round(newWidth),
        height: Math.round(newHeight),
      });

      onResizeUpdate?.(update);
    },
    [onResizeUpdate, baseWidth, baseHeight, currentScale, currentSize, currentFontSize]
  );

  // Clear resize info when pointer is released (listen globally)
  useEffect(() => {
    if (!resizeInfo) return;

    const clearResize = () => {
      setResizeInfo(null);
      initialDimsRef.current = null;
    };

    window.addEventListener('pointerup', clearResize, { once: true });
    return () => window.removeEventListener('pointerup', clearResize);
  }, [resizeInfo]);

  // Attach drag handler as a NATIVE listener so that child resize handles
  // can call stopPropagation() in their own native listeners and prevent
  // this parent handler from firing.
  useEffect(() => {
    const el = parentRef.current;
    if (!el || !visible) return;

    const nativeDragHandler = (e: PointerEvent) => {
      onSelect();
      handlePointerDown(e as unknown as React.PointerEvent);
    };

    el.addEventListener('pointerdown', nativeDragHandler);
    return () => el.removeEventListener('pointerdown', nativeDragHandler);
  }, [visible, onSelect, handlePointerDown]);

  if (!visible) return null;

  const meta = ELEMENT_META[id] || { label: id, color: '#999' };
  const showChrome = isSelected || isHovered;

  return (
    <div
      ref={parentRef}
      className="absolute touch-none select-none"
      style={{
        left: domX,
        top: domY,
        width: Math.max(domWidth, 24),
        height: Math.max(domHeight, 16),
        cursor: isDragging ? 'grabbing' : showChrome ? 'move' : 'default',
        opacity: isDragging ? 0.9 : 1,
        zIndex: isDragging ? 50 : isSelected ? 40 : isHovered ? 30 : 10,
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
    >
      {/* Selection / hover border */}
      {showChrome && (
        <div
          className="absolute inset-0 rounded-sm pointer-events-none"
          style={{
            border: isSelected
              ? `2px solid ${SELECTION_COLORS.border}`
              : `1px solid ${SELECTION_COLORS.borderHover}`,
            background: isSelected ? SELECTION_COLORS.selectedBg : 'transparent',
          }}
        />
      )}

      {/* Name badge */}
      {showChrome && (
        <div
          className="absolute -top-5 left-0 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap pointer-events-none"
          style={{
            background: isSelected ? SELECTION_COLORS.badgeBg : 'rgba(100, 100, 100, 0.7)',
            color: SELECTION_COLORS.badgeText,
          }}
        >
          {meta.label}
        </div>
      )}

      {/* Resize feedback badge */}
      {resizeInfo && (
        <div
          className="absolute pointer-events-none whitespace-nowrap px-1.5 py-0.5 rounded text-[10px] font-mono font-medium"
          style={{
            bottom: -20,
            right: 0,
            background: 'rgba(0,0,0,0.75)',
            color: '#fff',
            zIndex: 70,
          }}
        >
          {resizeInfo.widthPercent}% ({resizeInfo.width}×{resizeInfo.height})
        </div>
      )}

      {/* 8 resize handles (only when selected) */}
      {isSelected &&
        ALL_HANDLES.map((h) => (
          <ResizeHandleEl
            key={h.id}
            handle={h}
            isResizable={isResizable}
            currentScale={currentScale}
            onScaleChange={onScaleChange}
            currentSize={currentSize}
            onSizeChange={onSizeChange}
            currentFontSize={currentFontSize}
            onFontSizeChange={onFontSizeChange}
            onResizePositionChange={onResizePositionChange}
            onResizeUpdate={onResizeUpdate ? wrappedResizeUpdate : undefined}
            baseX={baseX}
            baseY={baseY}
            toBaseDelta={toBaseDelta}
            baseWidth={baseWidth}
            baseHeight={baseHeight}
            snapToGrid={snapToGrid}
            gridSize={gridSize}
          />
        ))}
    </div>
  );
}
