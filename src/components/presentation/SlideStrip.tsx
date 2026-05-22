/**
 * SlideStrip - Tira de miniaturas de slides
 * Permite navegacion rapida entre slides y reordenar via drag-and-drop
 * Soporta menú contextual para editar, duplicar, eliminar
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { UniversalSlide } from '@/components/liturgia-builder/UniversalSlide';
import { CASA_BRAND } from '@/lib/brand-kit';
import { Image as ImageIcon, Pencil, Copy, Trash2, Type, Clock, GripVertical } from 'lucide-react';
import type { Slide } from '@/types/shared/slide';
import type { LogoSettings, TempSlideEdit, TextOverlay } from '@/lib/presentation/types';
import { toast } from 'sonner';

interface SlideStripProps {
  slides: Slide[];
  currentIndex: number;
  liveIndex?: number;
  isLive?: boolean;
  onSlideClick: (index: number) => void;
  /** Map slideId -> elementGroupId for cross-element drag restriction.
   *  Slides with the same groupId can be reordered between each other.
   *  Slides with no entry (e.g. brand new temp slides) are treated as
   *  standalone (can move anywhere). */
  slideElementMap?: Record<string, string>;
  onReorder?: (newSlides: Slide[], newCurrentIndex: number) => void;
  logoOverrides?: Record<number, Partial<LogoSettings>>;
  textOverlayOverrides?: Record<number, Partial<TextOverlay>[]>;
  tempEdits?: Record<string, TempSlideEdit>;
  onEdit?: (index: number) => void;
  onDuplicate?: (index: number) => void;
  onDelete?: (index: number) => void;
}

const THUMBNAIL_SCALE = 0.12;

interface SortableSlideItemProps {
  slide: Slide;
  index: number;
  isPreview: boolean;
  isLiveSlide: boolean;
  isLive: boolean;
  hasEdit: boolean;
  hasLogoOverride: boolean;
  hasTextOverlayOverride: boolean;
  isTempSlide: boolean;
  outlineStyle: string;
  isDropBefore: boolean;
  isDropAfter: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  activeRef?: React.RefObject<HTMLDivElement>;
}

const SortableSlideItem: React.FC<SortableSlideItemProps> = ({
  slide,
  index,
  isPreview,
  isLiveSlide,
  isLive,
  hasEdit,
  hasLogoOverride,
  hasTextOverlayOverride,
  isTempSlide,
  outlineStyle,
  isDropBefore,
  isDropAfter,
  onClick,
  onDoubleClick,
  onContextMenu,
  activeRef,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slide.id });

  const wrapperStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1000 : 'auto',
    opacity: isDragging ? 0.4 : 1,
  };

  // Outer wrapper is the single interactive element (role="button"). The drag
  // handle stops pointer propagation so dnd-kit owns the drag and the wrapper
  // owns the click. This replaces the previous <button><div with listeners></button>
  // nesting, which is invalid HTML and broke keyboard / screen-reader behavior.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        if (activeRef && isPreview) {
          (activeRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Ir a diapositiva ${index + 1}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onKeyDown={handleKeyDown}
      style={{
        ...wrapperStyle,
        outline: outlineStyle,
        outlineOffset: '2px',
        opacity: isPreview || isLiveSlide ? 1 : 0.7,
      }}
      className="relative flex-shrink-0 rounded overflow-hidden transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
    >
      {isDropBefore && (
        <div
          aria-hidden
          className="absolute -left-1 top-0 bottom-0 w-1 rounded"
          style={{ backgroundColor: CASA_BRAND.colors.primary.amber, zIndex: 50 }}
        />
      )}
      {isDropAfter && (
        <div
          aria-hidden
          className="absolute -right-1 top-0 bottom-0 w-1 rounded"
          style={{ backgroundColor: CASA_BRAND.colors.primary.amber, zIndex: 50 }}
        />
      )}

      <UniversalSlide slide={slide} scale={THUMBNAIL_SCALE} showIndicator={false} />

      {/* Drag handle — only stopPropagation on click. Don't override onPointerDown
          or onMouseDown: {...listeners} from dnd-kit already attaches those, and
          a same-named explicit prop after the spread would silently replace them,
          killing the drag entirely. */}
      <div
        {...attributes}
        {...listeners}
        role="button"
        tabIndex={-1}
        aria-label={`Mover diapositiva ${index + 1}`}
        className="absolute top-1 left-1/2 -translate-x-1/2 p-0.5 rounded cursor-grab active:cursor-grabbing opacity-70 hover:opacity-100"
        style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical size={10} color={CASA_BRAND.colors.primary.white} />
      </div>

      {hasEdit && (
        <div
          className="absolute top-1 left-1 p-0.5 rounded"
          style={{ backgroundColor: '#22c55e' }}
          title="Slide editado"
        >
          <Pencil size={8} color={CASA_BRAND.colors.primary.white} />
        </div>
      )}

      {hasLogoOverride && (
        <div
          className="absolute top-1 right-1 p-0.5 rounded"
          style={{ backgroundColor: CASA_BRAND.colors.primary.amber }}
          title="Logo override activo"
        >
          <ImageIcon size={8} color={CASA_BRAND.colors.primary.black} />
        </div>
      )}

      {hasTextOverlayOverride && (
        <div
          className="absolute top-1 p-0.5 rounded"
          style={{
            backgroundColor: '#3b82f6',
            right: hasLogoOverride ? '24px' : '4px',
          }}
          title="Texto override activo"
        >
          <Type size={8} color={CASA_BRAND.colors.primary.white} />
        </div>
      )}

      {isLiveSlide && isLive && (
        <div
          className="absolute top-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-xs"
          style={{
            backgroundColor: '#ef4444',
            color: CASA_BRAND.colors.primary.white,
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '8px',
            fontWeight: 700,
          }}
        >
          LIVE
        </div>
      )}

      {isTempSlide && (
        <div
          className="absolute bottom-1 left-1 p-0.5 rounded flex items-center gap-0.5"
          style={{ backgroundColor: CASA_BRAND.colors.primary.amber + 'CC' }}
          title="Diapositiva temporal (solo esta sesión)"
        >
          <Clock size={8} color={CASA_BRAND.colors.primary.black} />
        </div>
      )}

      <div
        className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-xs"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: CASA_BRAND.colors.primary.white,
          fontFamily: CASA_BRAND.fonts.body,
          fontSize: '10px',
          fontWeight: 600,
        }}
      >
        {index + 1}
      </div>
    </div>
  );
};

export const SlideStrip: React.FC<SlideStripProps> = ({
  slides,
  currentIndex,
  liveIndex,
  isLive = false,
  onSlideClick,
  slideElementMap = {},
  onReorder,
  logoOverrides = {},
  textOverlayOverrides = {},
  tempEdits = {},
  onEdit,
  onDuplicate,
  onDelete,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; index: number } | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      activeRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [currentIndex]);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  const handleContextMenu = useCallback((e: React.MouseEvent, index: number) => {
    e.preventDefault();
    const menuHeight = 130;
    const windowHeight = window.innerHeight;
    const y = e.clientY + menuHeight > windowHeight
      ? e.clientY - menuHeight
      : e.clientY;
    setContextMenu({ x: e.clientX, y, index });
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const slideIds = useMemo(() => slides.map((s) => s.id), [slides]);

  const sameElement = useCallback(
    (idA: string, idB: string): boolean => {
      const a = slideElementMap[idA];
      const b = slideElementMap[idB];
      if (!a || !b) return true; // unknown -> permit (temp slides)
      return a === b;
    },
    [slideElementMap],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  }, []);

  const handleDragOver = useCallback((event: { over: { id: string | number } | null }) => {
    setOverId(event.over ? String(event.over.id) : null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveDragId(null);
      setOverId(null);
      if (!over || active.id === over.id) return;
      if (!onReorder) return;

      const activeId = String(active.id);
      const overIdStr = String(over.id);

      if (!sameElement(activeId, overIdStr)) {
        toast.error('Solo se puede reordenar dentro del mismo elemento');
        return;
      }

      const oldIndex = slides.findIndex((s) => s.id === activeId);
      const newIndex = slides.findIndex((s) => s.id === overIdStr);
      if (oldIndex === -1 || newIndex === -1) return;

      const newSlides = arrayMove(slides, oldIndex, newIndex);
      // currentIndex follows the moved slide if user dragged the current slide,
      // otherwise it follows by id.
      const movedSlideId = slides[currentIndex]?.id;
      const newCurrentIndex = newSlides.findIndex((s) => s.id === movedSlideId);

      onReorder(newSlides, newCurrentIndex === -1 ? currentIndex : newCurrentIndex);
    },
    [onReorder, slides, currentIndex, sameElement],
  );

  const handleDragCancel = useCallback(() => {
    setActiveDragId(null);
    setOverId(null);
  }, []);

  // Compute drop indicator positions
  const activeIndex = activeDragId ? slides.findIndex((s) => s.id === activeDragId) : -1;
  const overIndex = overId ? slides.findIndex((s) => s.id === overId) : -1;
  const showDropBeforeIndex =
    activeDragId && overIndex >= 0 && overIndex < activeIndex ? overIndex : -1;
  const showDropAfterIndex =
    activeDragId && overIndex >= 0 && overIndex > activeIndex ? overIndex : -1;

  return (
    <div
      className="h-full"
      style={{
        backgroundColor: CASA_BRAND.colors.secondary.carbon,
        borderTop: `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
      }}
    >
      <ScrollArea className="w-full h-full" ref={scrollRef}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={slideIds} strategy={horizontalListSortingStrategy}>
            <div className="flex items-center gap-2 p-2">
              {slides.map((slide, index) => {
                const isPreview = index === currentIndex;
                const isLiveSlide = liveIndex !== undefined && index === liveIndex;
                const hasLogoOverride = index in logoOverrides;
                const hasTextOverlayOverride =
                  index in textOverlayOverrides && textOverlayOverrides[index].length > 0;
                const hasEdit = slide.id in tempEdits;
                const isTempSlide =
                  slide.id.startsWith('temp-') || slide.id.startsWith('imported-');

                let outlineStyle = '2px solid transparent';
                if (isPreview && isLiveSlide) {
                  outlineStyle = `3px solid ${CASA_BRAND.colors.primary.amber}`;
                } else if (isPreview) {
                  outlineStyle = `3px solid ${CASA_BRAND.colors.primary.amber}`;
                } else if (isLiveSlide && isLive) {
                  outlineStyle = `3px solid #ef4444`;
                }

                return (
                  <SortableSlideItem
                    key={slide.id}
                    slide={slide}
                    index={index}
                    isPreview={isPreview}
                    isLiveSlide={isLiveSlide}
                    isLive={isLive}
                    hasEdit={hasEdit}
                    hasLogoOverride={hasLogoOverride}
                    hasTextOverlayOverride={hasTextOverlayOverride}
                    isTempSlide={isTempSlide}
                    outlineStyle={outlineStyle}
                    isDropBefore={showDropBeforeIndex === index}
                    isDropAfter={showDropAfterIndex === index}
                    onClick={() => onSlideClick(index)}
                    onDoubleClick={() => onEdit?.(index)}
                    onContextMenu={(e) => handleContextMenu(e, index)}
                    activeRef={isPreview ? activeRef : undefined}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {contextMenu && (
        <div
          className="fixed z-50 rounded-lg shadow-lg overflow-hidden"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            backgroundColor: CASA_BRAND.colors.secondary.carbon,
            border: `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
          }}
        >
          <button
            onClick={() => {
              onEdit?.(contextMenu.index);
              setContextMenu(null);
            }}
            className="flex items-center gap-2 w-full px-4 py-2 hover:bg-gray-700 transition-colors text-left"
            style={{
              color: CASA_BRAND.colors.primary.white,
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
            }}
          >
            <Pencil size={14} />
            Editar
          </button>
          <button
            onClick={() => {
              onDuplicate?.(contextMenu.index);
              setContextMenu(null);
            }}
            className="flex items-center gap-2 w-full px-4 py-2 hover:bg-gray-700 transition-colors text-left"
            style={{
              color: CASA_BRAND.colors.primary.white,
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
            }}
          >
            <Copy size={14} />
            Duplicar
          </button>
          {slides.length > 1 && (
            <button
              onClick={() => {
                onDelete?.(contextMenu.index);
                setContextMenu(null);
              }}
              className="flex items-center gap-2 w-full px-4 py-2 hover:bg-red-900/50 transition-colors text-left"
              style={{
                color: '#ef4444',
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '14px',
              }}
            >
              <Trash2 size={14} />
              Eliminar
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SlideStrip;
