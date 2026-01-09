/**
 * VistaPrevia - Vista previa de la liturgia con elementos ordenables
 * Permite reordenar los elementos de la liturgia mediante drag-and-drop
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CASA_BRAND } from '@/lib/brand-kit';
import {
  GripVertical,
  Check,
  Circle,
  SkipForward,
  Loader2,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Music,
  MessageCircle,
  BookOpen,
  Cross,
  Hand,
  Heart,
  Gift,
  Megaphone,
  Sparkles,
  Sun,
  Baby,
  Church,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileText,
} from 'lucide-react';
import type {
  LiturgyElement,
  LiturgyElementType,
  LiturgyElementStatus,
} from '@/types/shared/liturgy';
import type { Slide, SlideGroup } from '@/types/shared/slide';
import { UniversalSlide } from './UniversalSlide';

/**
 * Configuración de iconos por tipo de elemento
 */
const ELEMENT_ICONS: Record<LiturgyElementType, React.ReactNode> = {
  'portada-principal': <ImageIcon size={16} />,
  'oracion-invocacion': <Sparkles size={16} />,
  'cancion-invocacion': <Music size={16} />,
  'oracion-arrepentimiento': <Heart size={16} />,
  'cancion-arrepentimiento': <Music size={16} />,
  'oracion-gratitud': <Sun size={16} />,
  'cancion-gratitud': <Music size={16} />,
  'lectura-biblica': <BookOpen size={16} />,
  'cuentacuentos': <Baby size={16} />,
  'portada-reflexion': <ImageIcon size={16} />,
  'padre-nuestro': <MessageCircle size={16} />,
  'paz': <Hand size={16} />,
  'santa-cena': <Cross size={16} />,
  'accion-gracias': <Heart size={16} />,
  'cancion-santa-cena': <Music size={16} />,
  'ofrenda': <Gift size={16} />,
  'anuncios': <Megaphone size={16} />,
  'bendicion': <Church size={16} />,
};

/**
 * Labels de elementos
 */
const ELEMENT_LABELS: Record<LiturgyElementType, string> = {
  'portada-principal': 'Portada Principal',
  'oracion-invocacion': 'Oración de Invocación',
  'cancion-invocacion': 'Primera Canción - Invocación',
  'oracion-arrepentimiento': 'Oración de Arrepentimiento',
  'cancion-arrepentimiento': 'Segunda Canción - Arrepentimiento',
  'oracion-gratitud': 'Oración de Gratitud',
  'cancion-gratitud': 'Tercera Canción - Gratitud',
  'lectura-biblica': 'Lectura Bíblica',
  'cuentacuentos': 'Cuentacuento',
  'portada-reflexion': 'Portada de Reflexión',
  'padre-nuestro': 'Padre Nuestro',
  'paz': 'La Paz',
  'santa-cena': 'Santa Cena',
  'accion-gracias': 'Acción de Gracias',
  'cancion-santa-cena': 'Cuarta Canción - Santa Cena',
  'ofrenda': 'Ofrenda',
  'anuncios': 'Anuncios',
  'bendicion': 'Bendición Final',
};

/**
 * Componente para mostrar un slide individual como miniatura visual
 */
interface SlidePreviewProps {
  slide: Slide;
  index: number;
  total: number;
}

const SlidePreviewItem: React.FC<SlidePreviewProps> = ({ slide, index, total }) => {
  const thumbnailScale = 0.2; // 20% del tamaño original para miniaturas

  return (
    <div className="flex items-center gap-3">
      {/* Número del slide */}
      <span
        className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded text-xs font-medium"
        style={{
          backgroundColor: CASA_BRAND.colors.secondary.grayMedium + '30',
          color: CASA_BRAND.colors.secondary.grayDark,
        }}
      >
        {index + 1}
      </span>

      {/* Miniatura del slide usando UniversalSlide */}
      <div className="overflow-hidden rounded-md shadow-sm border" style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}>
        <UniversalSlide
          slide={slide}
          scale={thumbnailScale}
          showIndicator={false}
        />
      </div>

      {/* Info del slide */}
      <div className="flex-1 min-w-0">
        <p
          className="text-xs font-medium uppercase tracking-wide"
          style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
        >
          {slide.type.replace(/-/g, ' ')}
        </p>
        <p
          className="text-xs truncate mt-0.5"
          style={{ color: CASA_BRAND.colors.secondary.grayDark }}
        >
          {slide.content.primary?.slice(0, 50) || '(Sin contenido)'}
          {(slide.content.primary?.length || 0) > 50 ? '...' : ''}
        </p>
      </div>
    </div>
  );
};

/**
 * Componente de elemento sorteable
 */
interface SortableElementProps {
  element: {
    type: LiturgyElementType;
    status: LiturgyElementStatus;
    title?: string;
    sourceInfo?: string;
    slides?: SlideGroup;
  };
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

const SortableElement: React.FC<SortableElementProps> = ({ element, index, isExpanded, onToggleExpand }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: element.type });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1000 : 1,
  };

  const statusConfig = {
    pending: {
      icon: <Circle size={14} />,
      color: CASA_BRAND.colors.secondary.grayMedium,
      bg: `${CASA_BRAND.colors.secondary.grayMedium}15`,
    },
    in_progress: {
      icon: <Loader2 size={14} className="animate-spin" />,
      color: CASA_BRAND.colors.primary.amber,
      bg: `${CASA_BRAND.colors.primary.amber}15`,
    },
    completed: {
      icon: <Check size={14} />,
      color: CASA_BRAND.colors.amber.dark,
      bg: `${CASA_BRAND.colors.amber.dark}15`,
    },
    skipped: {
      icon: <SkipForward size={14} />,
      color: CASA_BRAND.colors.secondary.grayLight,
      bg: `${CASA_BRAND.colors.secondary.grayLight}15`,
    },
  };

  const config = statusConfig[element.status];
  const hasSlides = element.slides && element.slides.slides && element.slides.slides.length > 0;
  const slideCount = hasSlides ? element.slides!.slides.length : 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border transition-all ${isDragging ? 'shadow-lg' : ''}`}
      {...attributes}
    >
      {/* Fila principal del elemento */}
      <div className="flex items-center gap-3 p-3">
        {/* Drag handle */}
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-gray-100 touch-none"
          style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
          {...listeners}
        >
          <GripVertical size={18} />
        </button>

        {/* Número de orden */}
        <span
          className="w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium"
          style={{
            backgroundColor: CASA_BRAND.colors.primary.amber + '20',
            color: CASA_BRAND.colors.primary.amber,
          }}
        >
          {index + 1}
        </span>

        {/* Icono del elemento */}
        <span style={{ color: CASA_BRAND.colors.secondary.grayDark }}>
          {ELEMENT_ICONS[element.type]}
        </span>

        {/* Título y descripción */}
        <div className="flex-1 min-w-0">
          <p
            className="font-medium text-sm truncate"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              color: CASA_BRAND.colors.primary.black,
            }}
          >
            {element.title || ELEMENT_LABELS[element.type]}
          </p>
          {element.sourceInfo && (
            <p
              className="text-xs truncate"
              style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
            >
              {element.sourceInfo}
            </p>
          )}
        </div>

        {/* Botón de ver slides */}
        {hasSlides ? (
          <button
            type="button"
            onClick={onToggleExpand}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors hover:opacity-80"
            style={{
              backgroundColor: isExpanded
                ? CASA_BRAND.colors.primary.amber + '20'
                : CASA_BRAND.colors.secondary.grayLight + '50',
              color: isExpanded
                ? CASA_BRAND.colors.primary.amber
                : CASA_BRAND.colors.secondary.grayDark,
            }}
          >
            {isExpanded ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>{slideCount} slides</span>
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        ) : (
          <span
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs"
            style={{
              backgroundColor: CASA_BRAND.colors.secondary.grayLight + '30',
              color: CASA_BRAND.colors.secondary.grayMedium,
            }}
          >
            <FileText size={14} />
            <span>Sin slides</span>
          </span>
        )}

        {/* Estado */}
        <span
          className="flex items-center justify-center w-7 h-7 rounded-full"
          style={{ backgroundColor: config.bg, color: config.color }}
        >
          {config.icon}
        </span>
      </div>

      {/* Panel expandible de slides */}
      {isExpanded && hasSlides && (
        <div
          className="border-t px-4 py-3 space-y-2"
          style={{
            backgroundColor: CASA_BRAND.colors.primary.cream + '50',
            borderColor: CASA_BRAND.colors.secondary.grayLight,
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <p
              className="text-xs font-medium"
              style={{ color: CASA_BRAND.colors.secondary.grayDark }}
            >
              Slides de {element.slides!.title || ELEMENT_LABELS[element.type]}
            </p>
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{
                backgroundColor: CASA_BRAND.colors.primary.amber + '20',
                color: CASA_BRAND.colors.primary.amber,
              }}
            >
              {slideCount} {slideCount === 1 ? 'slide' : 'slides'}
            </span>
          </div>
          <div className="space-y-3 max-h-[500px] overflow-y-auto py-2">
            {element.slides!.slides.map((slide, slideIndex) => (
              <SlidePreviewItem
                key={slide.id}
                slide={slide}
                index={slideIndex}
                total={slideCount}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Props del componente VistaPrevia
 */
interface VistaPreviaProps {
  elements: Map<LiturgyElementType, LiturgyElement>;
  elementOrder: LiturgyElementType[];
  onOrderChange: (newOrder: LiturgyElementType[]) => void;
  liturgyTitle?: string;
  liturgyDate?: Date;
}

/**
 * Componente principal de Vista Previa
 */
const VistaPrevia: React.FC<VistaPreviaProps> = ({
  elements,
  elementOrder,
  onOrderChange,
  liturgyTitle,
  liturgyDate,
}) => {
  // Estado para controlar qué elementos están expandidos
  const [expandedElements, setExpandedElements] = useState<Set<LiturgyElementType>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Toggle expansión de un elemento
  const toggleExpand = useCallback((type: LiturgyElementType) => {
    setExpandedElements((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  }, []);

  // Calcular el status real de un elemento (misma lógica que ConstructorLiturgias)
  const getElementStatus = useCallback((type: LiturgyElementType, element: LiturgyElement | undefined): LiturgyElementStatus => {
    if (!element) return 'pending';
    if (element.status === 'skipped') return 'skipped';

    // Para canciones: debe tener sourceId (canción seleccionada) o slides con título
    const isSong = type.startsWith('cancion-');
    if (isSong) {
      const hasSource = element.sourceId || element.slides?.title;
      return hasSource ? 'completed' : 'pending';
    }

    // Para cuentacuentos: debe tener storyData en config
    if (type === 'cuentacuentos') {
      return element.config?.storyData ? 'completed' : 'pending';
    }

    // Para anuncios: debe tener announcementConfigs con al menos un anuncio
    if (type === 'anuncios') {
      const configs = element.config?.announcementConfigs;
      return Array.isArray(configs) && configs.length > 0 ? 'completed' : 'pending';
    }

    // Para otros elementos, verificar slides
    return (element.slides || element.editedSlides) ? 'completed' : 'pending';
  }, []);

  // Preparar elementos para mostrar
  const sortedElements = useMemo(() => {
    return elementOrder.map((type) => {
      const element = elements.get(type);
      const defaultLabel = ELEMENT_LABELS[type];
      const slides = element?.slides || element?.editedSlides;

      // Para canciones, usar el título del SlideGroup que contiene el nombre real de la canción
      const isSong = type.startsWith('cancion-');
      const songTitle = isSong && slides?.title ? slides.title : null;

      return {
        type,
        status: getElementStatus(type, element),
        title: songTitle || element?.title || defaultLabel,
        // Si es canción con título, mostrar el tipo como subtítulo
        sourceInfo: songTitle ? defaultLabel : undefined,
        slides,
      };
    });
  }, [elementOrder, elements, getElementStatus]);

  // Estadísticas de completitud
  const stats = useMemo(() => {
    const total = elementOrder.length;
    const completed = sortedElements.filter((e) => e.status === 'completed').length;
    const skipped = sortedElements.filter((e) => e.status === 'skipped').length;
    const pending = total - completed - skipped;
    return { total, completed, skipped, pending };
  }, [sortedElements, elementOrder]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = elementOrder.indexOf(active.id as LiturgyElementType);
      const newIndex = elementOrder.indexOf(over.id as LiturgyElementType);
      const newOrder = arrayMove(elementOrder, oldIndex, newIndex);
      onOrderChange(newOrder);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3
            className="text-lg font-semibold"
            style={{
              fontFamily: CASA_BRAND.fonts.heading,
              color: CASA_BRAND.colors.primary.black,
            }}
          >
            Vista Previa de la Liturgia
          </h3>
          {liturgyTitle && (
            <p
              className="text-sm mt-1"
              style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
            >
              {liturgyTitle}
              {liturgyDate && ` - ${liturgyDate.toLocaleDateString('es-CL')}`}
            </p>
          )}
        </div>

        {/* Estadísticas */}
        <div
          className="flex items-center gap-4 px-4 py-2 rounded-lg"
          style={{ backgroundColor: CASA_BRAND.colors.primary.cream }}
        >
          <div className="text-center">
            <p
              className="text-lg font-bold"
              style={{ color: CASA_BRAND.colors.amber.dark }}
            >
              {stats.completed}
            </p>
            <p className="text-xs" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
              Listos
            </p>
          </div>
          <div
            className="w-px h-8"
            style={{ backgroundColor: CASA_BRAND.colors.secondary.grayLight }}
          />
          <div className="text-center">
            <p
              className="text-lg font-bold"
              style={{ color: CASA_BRAND.colors.primary.amber }}
            >
              {stats.pending}
            </p>
            <p className="text-xs" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
              Pendientes
            </p>
          </div>
          <div
            className="w-px h-8"
            style={{ backgroundColor: CASA_BRAND.colors.secondary.grayLight }}
          />
          <div className="text-center">
            <p
              className="text-lg font-bold"
              style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
            >
              {stats.skipped}
            </p>
            <p className="text-xs" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
              Omitidos
            </p>
          </div>
        </div>
      </div>

      {/* Instrucciones */}
      <div
        className="flex items-center gap-2 p-3 rounded-lg"
        style={{
          backgroundColor: CASA_BRAND.colors.primary.amber + '10',
          border: `1px solid ${CASA_BRAND.colors.primary.amber}30`,
        }}
      >
        <AlertCircle size={16} style={{ color: CASA_BRAND.colors.primary.amber }} />
        <p
          className="text-sm"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            color: CASA_BRAND.colors.secondary.grayDark,
          }}
        >
          Arrastra los elementos para cambiar el orden de la liturgia. Los cambios se guardarán automáticamente.
        </p>
      </div>

      {/* Lista de elementos */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={elementOrder}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {sortedElements.map((element, index) => (
              <SortableElement
                key={element.type}
                element={element}
                index={index}
                isExpanded={expandedElements.has(element.type)}
                onToggleExpand={() => toggleExpand(element.type)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Footer con info */}
      <div
        className="flex items-center justify-between pt-4 border-t"
        style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
      >
        <p
          className="text-xs"
          style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
        >
          {stats.total} elementos en total
        </p>
        <p
          className="text-xs"
          style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
        >
          Progreso: {Math.round((stats.completed / stats.total) * 100)}%
        </p>
      </div>
    </div>
  );
};

export default VistaPrevia;
