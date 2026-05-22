/**
 * SlideStrip - Tira de miniaturas de slides
 * Permite navegacion rapida entre slides
 * Soporta menú contextual para editar, duplicar, eliminar
 * Soporta drag-and-drop accesible (mouse + teclado) para reordenar
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  type DragCancelEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { UniversalSlide } from '@/components/liturgia-builder/UniversalSlide';
import { CASA_BRAND } from '@/lib/brand-kit';
import { Image as ImageIcon, Pencil, Copy, Trash2, Type, Clock } from 'lucide-react';
import type { Slide } from '@/types/shared/slide';
import type { LogoSettings, TempSlideEdit, TextOverlay } from '@/lib/presentation/types';

interface SlideStripProps {
  slides: Slide[];
  currentIndex: number;
  liveIndex?: number;
  isLive?: boolean;
  onSlideClick: (index: number) => void;
  logoOverrides?: Record<number, Partial<LogoSettings>>;
  textOverlayOverrides?: Record<number, Partial<TextOverlay>[]>;
  tempEdits?: Record<string, TempSlideEdit>;
  onEdit?: (index: number) => void;
  onDuplicate?: (index: number) => void;
  onDelete?: (index: number) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
}

const THUMBNAIL_SCALE = 0.12;

interface SortableThumbProps {
  slide: Slide;
  index: number;
  isPreview: boolean;
  isLiveSlide: boolean;
  isLive: boolean;
  hasLogoOverride: boolean;
  hasTextOverlayOverride: boolean;
  hasEdit: boolean;
  isTempSlide: boolean;
  activeId: string | null;
  overId: string | null;
  activeIndex: number;
  onClick: () => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  setActiveRef?: (node: HTMLButtonElement | null) => void;
}

const SortableThumb: React.FC<SortableThumbProps> = ({
  slide,
  index,
  isPreview,
  isLiveSlide,
  isLive,
  hasLogoOverride,
  hasTextOverlayOverride,
  hasEdit,
  isTempSlide,
  activeId,
  overId,
  activeIndex,
  onClick,
  onDoubleClick,
  onContextMenu,
  setActiveRef,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slide.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Outline based on preview/live status
  let outlineStyle = '2px solid transparent';
  if (isPreview && isLiveSlide) {
    outlineStyle = `3px solid ${CASA_BRAND.colors.primary.amber}`;
  } else if (isPreview) {
    outlineStyle = `3px solid ${CASA_BRAND.colors.primary.amber}`;
  } else if (isLiveSlide && isLive) {
    outlineStyle = `3px solid #ef4444`;
  }

  // Compute drop indicator placement
  // While dragging, show a vertical bar on the edge of the hovered item
  // indicating where the slide would land if dropped.
  const isOver = !!activeId && activeId !== slide.id && overId === slide.id;
  const showBarBefore = isOver && activeIndex > index;
  const showBarAfter = isOver && activeIndex < index;

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, position: 'relative', display: 'flex', alignItems: 'center' }}
      className="flex-shrink-0"
    >
      {/* Drop indicator (left) */}
      {showBarBefore && (
        <div
          aria-hidden="true"
          className="absolute top-0 bottom-0 z-10"
          style={{
            left: '-5px',
            width: '3px',
            backgroundColor: CASA_BRAND.colors.primary.amber,
            borderRadius: '2px',
            boxShadow: `0 0 6px ${CASA_BRAND.colors.primary.amber}`,
          }}
        />
      )}

      <button
        ref={(node) => {
          if (setActiveRef) setActiveRef(node);
        }}
        type="button"
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
        {...attributes}
        {...listeners}
        aria-label={`Diapositiva ${index + 1}${isPreview ? ' (seleccionada)' : ''}${isLiveSlide && isLive ? ' (en vivo)' : ''}. Espacio para arrastrar.`}
        aria-roledescription="reordenable"
        className="flex-shrink-0 relative rounded overflow-hidden transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        style={{
          outline: outlineStyle,
          outlineOffset: '2px',
          opacity: isDragging ? 0.4 : isPreview || isLiveSlide ? 1 : 0.7,
          cursor: isDragging ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
      >
        <UniversalSlide
          slide={slide}
          scale={THUMBNAIL_SCALE}
          showIndicator={false}
        />

        {/* Edit indicator */}
        {hasEdit && (
          <div
            className="absolute top-1 left-1 p-0.5 rounded"
            style={{ backgroundColor: '#22c55e' }}
            title="Slide editado"
          >
            <Pencil size={8} color={CASA_BRAND.colors.primary.white} />
          </div>
        )}

        {/* Logo override indicator */}
        {hasLogoOverride && (
          <div
            className="absolute top-1 right-1 p-0.5 rounded"
            style={{ backgroundColor: CASA_BRAND.colors.primary.amber }}
            title="Logo override activo"
          >
            <ImageIcon size={8} color={CASA_BRAND.colors.primary.black} />
          </div>
        )}

        {/* Text overlay override indicator */}
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

        {/* Live indicator */}
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

        {/* Temp slide indicator */}
        {isTempSlide && (
          <div
            className="absolute bottom-1 left-1 p-0.5 rounded flex items-center gap-0.5"
            style={{
              backgroundColor: CASA_BRAND.colors.primary.amber + 'CC',
            }}
            title="Diapositiva temporal (solo esta sesión)"
          >
            <Clock size={8} color={CASA_BRAND.colors.primary.black} />
          </div>
        )}

        {/* Slide number overlay */}
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
      </button>

      {/* Drop indicator (right) */}
      {showBarAfter && (
        <div
          aria-hidden="true"
          className="absolute top-0 bottom-0 z-10"
          style={{
            right: '-5px',
            width: '3px',
            backgroundColor: CASA_BRAND.colors.primary.amber,
            borderRadius: '2px',
            boxShadow: `0 0 6px ${CASA_BRAND.colors.primary.amber}`,
          }}
        />
      )}
    </div>
  );
};

export const SlideStrip: React.FC<SlideStripProps> = ({
  slides,
  currentIndex,
  liveIndex,
  isLive = false,
  onSlideClick,
  logoOverrides = {},
  textOverlayOverrides = {},
  tempEdits = {},
  onEdit,
  onDuplicate,
  onDelete,
  onReorder,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; index: number } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Sensors with activation constraint so clicks still work
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Scroll to active slide (only when not dragging)
  useEffect(() => {
    if (activeId) return;
    if (activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [currentIndex, activeId]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    const menuHeight = 130;
    const windowHeight = window.innerHeight;
    const y = e.clientY + menuHeight > windowHeight
      ? e.clientY - menuHeight
      : e.clientY;
    setContextMenu({ x: e.clientX, y, index });
  };

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
    setOverId(null);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverId(event.over ? String(event.over.id) : null);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);
    if (!over || active.id === over.id) return;
    const fromIndex = slides.findIndex((s) => s.id === active.id);
    const toIndex = slides.findIndex((s) => s.id === over.id);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    onReorder?.(fromIndex, toIndex);
  }, [slides, onReorder]);

  const handleDragCancel = useCallback((_event: DragCancelEvent) => {
    setActiveId(null);
    setOverId(null);
  }, []);

  const activeIndex = activeId ? slides.findIndex((s) => s.id === activeId) : -1;

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
          <SortableContext
            items={slides.map((s) => s.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div
              className="flex items-center gap-2 p-2"
              role="list"
              aria-label="Miniaturas de diapositivas. Usa la barra espaciadora para tomar una diapositiva y las flechas izquierda y derecha para moverla."
            >
              {slides.map((slide, index) => {
                const isPreview = index === currentIndex;
                const isLiveSlide = liveIndex !== undefined && index === liveIndex;
                const hasLogoOverride = index in logoOverrides;
                const hasTextOverlayOverride =
                  index in textOverlayOverrides && textOverlayOverrides[index].length > 0;
                const hasEdit = slide.id in tempEdits;
                const isTempSlide = slide.id.startsWith('temp-') || slide.id.startsWith('imported-');

                return (
                  <SortableThumb
                    key={slide.id}
                    slide={slide}
                    index={index}
                    isPreview={isPreview}
                    isLiveSlide={isLiveSlide}
                    isLive={isLive}
                    hasLogoOverride={hasLogoOverride}
                    hasTextOverlayOverride={hasTextOverlayOverride}
                    hasEdit={hasEdit}
                    isTempSlide={isTempSlide}
                    activeId={activeId}
                    overId={overId}
                    activeIndex={activeIndex}
                    setActiveRef={isPreview ? (node) => { activeRef.current = node; } : undefined}
                    onClick={() => onSlideClick(index)}
                    onDoubleClick={() => onEdit?.(index)}
                    onContextMenu={(e) => handleContextMenu(e, index)}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Context Menu */}
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
