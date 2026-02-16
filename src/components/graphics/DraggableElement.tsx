import { useState } from 'react';
import { useDragElement } from '@/hooks/useDragElement';
import { useResizeElement } from '@/hooks/useResizeElement';
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
}

const HANDLE_SIZE = 8;
const HALF = HANDLE_SIZE / 2;

const HANDLES: Array<{
  id: ResizeHandle;
  style: React.CSSProperties;
  cursor: string;
}> = [
  { id: 'nw', style: { top: -HALF, left: -HALF }, cursor: 'nw-resize' },
  { id: 'n', style: { top: -HALF, left: '50%', marginLeft: -HALF }, cursor: 'n-resize' },
  { id: 'ne', style: { top: -HALF, right: -HALF }, cursor: 'ne-resize' },
  { id: 'e', style: { top: '50%', right: -HALF, marginTop: -HALF }, cursor: 'e-resize' },
  { id: 'se', style: { bottom: -HALF, right: -HALF }, cursor: 'se-resize' },
  { id: 's', style: { bottom: -HALF, left: '50%', marginLeft: -HALF }, cursor: 's-resize' },
  { id: 'sw', style: { bottom: -HALF, left: -HALF }, cursor: 'sw-resize' },
  { id: 'w', style: { top: '50%', left: -HALF, marginTop: -HALF }, cursor: 'w-resize' },
];

function ResizeHandleEl({
  handle,
  isResizable,
  currentScale,
  onScaleChange,
  currentSize,
  onSizeChange,
  toBaseDelta,
  baseWidth,
  baseHeight,
}: {
  handle: (typeof HANDLES)[number];
  isResizable: boolean;
  currentScale?: number;
  onScaleChange?: (s: number) => void;
  currentSize?: number;
  onSizeChange?: (s: number) => void;
  toBaseDelta: (dx: number, dy: number) => { dx: number; dy: number };
  baseWidth: number;
  baseHeight: number;
}) {
  const isCorner = ['nw', 'ne', 'se', 'sw'].includes(handle.id);
  const canResize = isResizable && isCorner;

  const { handlePointerDown } = useResizeElement({
    handle: handle.id,
    currentScale,
    onScaleChange,
    currentSize,
    onSizeChange,
    toBaseDelta,
    baseWidth,
    baseHeight,
    disabled: !canResize,
  });

  return (
    <div
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
      onPointerDown={canResize ? handlePointerDown : (e) => e.stopPropagation()}
    />
  );
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
}: DraggableElementProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { isDragging, handlePointerDown } = useDragElement({
    position: { x: baseX, y: baseY },
    onChange: onPositionChange,
    toBaseDelta,
    disabled: !visible,
  });

  if (!visible) return null;

  const meta = ELEMENT_META[id] || { label: id, color: '#999' };
  const showChrome = isSelected || isHovered;

  return (
    <div
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
      onPointerDown={(e) => {
        onSelect();
        handlePointerDown(e);
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

      {/* 8 resize handles (only when selected) */}
      {isSelected &&
        HANDLES.map((h) => (
          <ResizeHandleEl
            key={h.id}
            handle={h}
            isResizable={isResizable}
            currentScale={currentScale}
            onScaleChange={onScaleChange}
            currentSize={currentSize}
            onSizeChange={onSizeChange}
            toBaseDelta={toBaseDelta}
            baseWidth={baseWidth}
            baseHeight={baseHeight}
          />
        ))}
    </div>
  );
}
