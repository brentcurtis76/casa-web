import { useDragElement } from '@/hooks/useDragElement';
import { ELEMENT_META } from './graphicsTypes';

interface DraggableElementProps {
  id: string;
  /** Position in DOM pixels (already converted from base via toDOM) */
  domX: number;
  domY: number;
  /** Approximate size in DOM pixels */
  domWidth: number;
  domHeight: number;
  /** Current position in base coordinates (for drag hook) */
  baseX: number;
  baseY: number;
  /** Called with new base coordinates */
  onPositionChange: (x: number, y: number) => void;
  /** Convert DOM delta to base delta */
  toBaseDelta: (domDX: number, domDY: number) => { dx: number; dy: number };
  isSelected: boolean;
  onSelect: () => void;
  visible: boolean;
}

export function DraggableElement({
  id,
  domX,
  domY,
  domWidth,
  domHeight,
  baseX,
  baseY,
  onPositionChange,
  toBaseDelta,
  isSelected,
  onSelect,
  visible,
}: DraggableElementProps) {
  const { isDragging, handlePointerDown } = useDragElement({
    position: { x: baseX, y: baseY },
    onChange: onPositionChange,
    toBaseDelta,
    disabled: !visible,
  });

  if (!visible) return null;

  const meta = ELEMENT_META[id] || { label: id, color: '#999' };

  return (
    <div
      className="absolute touch-none select-none"
      style={{
        left: domX,
        top: domY,
        width: Math.max(domWidth, 24),
        height: Math.max(domHeight, 16),
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.8 : 1,
        zIndex: isDragging ? 50 : isSelected ? 40 : 10,
      }}
      onPointerDown={(e) => {
        onSelect();
        handlePointerDown(e);
      }}
    >
      {/* Border */}
      <div
        className="absolute inset-0 rounded-sm transition-colors"
        style={{
          border: isSelected
            ? '2px solid #D4A853'
            : '1px dashed rgba(150, 150, 150, 0.6)',
          background: isSelected
            ? 'rgba(212, 168, 83, 0.08)'
            : isDragging
            ? 'rgba(212, 168, 83, 0.05)'
            : 'transparent',
        }}
      />

      {/* Label badge */}
      <div
        className="absolute -top-5 left-0 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap"
        style={{
          background: isSelected ? '#D4A853' : 'rgba(100, 100, 100, 0.7)',
          color: 'white',
        }}
      >
        {meta.label}
      </div>
    </div>
  );
}
