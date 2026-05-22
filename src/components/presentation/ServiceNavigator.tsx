/**
 * ServiceNavigator - Navegador de elementos de la liturgia
 * Muestra todos los elementos y permite saltar a cada uno.
 * Soporta reordenar elementos via drag-and-drop (vertical).
 */

import React, { useCallback, useMemo } from 'react';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CASA_BRAND } from '@/lib/brand-kit';
import type { FlattenedElement } from '@/lib/presentation/types';
import { Music, BookOpen, Hand, Church, Gift, Megaphone, Heart, Image, GripVertical } from 'lucide-react';

interface ServiceNavigatorProps {
  elements: FlattenedElement[];
  currentElementIndex: number;
  onElementClick: (index: number) => void;
  /** Called when the user reorders elements via drag. Receives the new
   *  in-memory element order. If omitted, the navigator is read-only. */
  onReorder?: (newOrder: FlattenedElement[]) => void;
}

const getElementIcon = (type: string) => {
  if (type.includes('cancion')) return Music;
  if (type.includes('oracion') || type.includes('padre-nuestro')) return Hand;
  if (type.includes('lectura')) return BookOpen;
  if (type.includes('santa-cena') || type.includes('paz')) return Church;
  if (type.includes('ofrenda')) return Gift;
  if (type.includes('anuncios')) return Megaphone;
  if (type.includes('bendicion')) return Heart;
  if (type.includes('portada')) return Image;
  return BookOpen;
};

interface SortableElementRowProps {
  element: FlattenedElement;
  index: number;
  isActive: boolean;
  isDraggable: boolean;
  onClick: () => void;
}

const SortableElementRow: React.FC<SortableElementRowProps> = ({
  element,
  isActive,
  isDraggable,
  onClick,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: element.dbRowId, disabled: !isDraggable });

  const Icon = getElementIcon(element.type);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    backgroundColor: isActive
      ? CASA_BRAND.colors.primary.amber + '20'
      : 'transparent',
    borderLeft: isActive
      ? `3px solid ${CASA_BRAND.colors.primary.amber}`
      : '3px solid transparent',
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      ref={setNodeRef}
      role="button"
      tabIndex={0}
      aria-label={`Ir al elemento ${element.title}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      style={style}
      className="w-full text-left pr-3 py-2 rounded-md transition-colors flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
    >
      {/* Drag handle — only this element captures drag-start. onClick stopPropagation
          keeps clicking the handle from also navigating. */}
      {isDraggable ? (
        <div
          {...attributes}
          {...listeners}
          role="button"
          tabIndex={-1}
          aria-label={`Mover ${element.title}`}
          className="cursor-grab active:cursor-grabbing px-1 opacity-40 hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={14} color={CASA_BRAND.colors.secondary.grayMedium} />
        </div>
      ) : (
        <div className="px-1 w-[22px]" aria-hidden />
      )}

      <Icon
        size={16}
        style={{
          color: isActive
            ? CASA_BRAND.colors.primary.amber
            : CASA_BRAND.colors.secondary.grayMedium,
        }}
      />
      <div className="flex-1 min-w-0">
        <p
          className="truncate"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '13px',
            fontWeight: isActive ? 600 : 400,
            color: isActive
              ? CASA_BRAND.colors.primary.white
              : CASA_BRAND.colors.secondary.grayLight,
          }}
        >
          {element.title}
        </p>
        <p
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '11px',
            color: CASA_BRAND.colors.secondary.grayMedium,
          }}
        >
          {element.slideCount} {element.slideCount === 1 ? 'slide' : 'slides'}
        </p>
      </div>
    </div>
  );
};

export const ServiceNavigator: React.FC<ServiceNavigatorProps> = ({
  elements,
  currentElementIndex,
  onElementClick,
  onReorder,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = useMemo(() => elements.map((e) => e.dbRowId), [elements]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !onReorder) return;
      const oldIndex = elements.findIndex((e) => e.dbRowId === String(active.id));
      const newIndex = elements.findIndex((e) => e.dbRowId === String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;
      onReorder(arrayMove(elements, oldIndex, newIndex));
    },
    [elements, onReorder],
  );

  return (
    <div
      className="h-full flex flex-col"
      style={{
        backgroundColor: CASA_BRAND.colors.secondary.carbon,
        borderRight: `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
      }}
    >
      <div
        className="px-4 py-3"
        style={{
          borderBottom: `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
        }}
      >
        <h2
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '12px',
            fontWeight: 600,
            color: CASA_BRAND.colors.secondary.grayMedium,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          Orden del Servicio
        </h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              {elements.map((element, index) => (
                <SortableElementRow
                  key={element.dbRowId}
                  element={element}
                  index={index}
                  isActive={index === currentElementIndex}
                  isDraggable={!!onReorder}
                  onClick={() => onElementClick(index)}
                />
              ))}
            </SortableContext>
          </DndContext>

          {elements.length === 0 && (
            <p
              className="px-3 py-4 text-center"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '13px',
                color: CASA_BRAND.colors.secondary.grayMedium,
              }}
            >
              No hay elementos en esta liturgia
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ServiceNavigator;
