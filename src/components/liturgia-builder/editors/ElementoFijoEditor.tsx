/**
 * ElementoFijoEditor - Editor para elementos fijos de la liturgia
 * Permite edición POR LITURGIA sin modificar el template original
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import {
  Eye,
  ChevronDown,
  ChevronUp,
  Edit3,
  Copy,
  Trash2,
  RotateCcw,
  Save,
  Loader2,
  GripVertical,
  Plus,
  X,
} from 'lucide-react';
import type { SlideGroup, Slide } from '@/types/shared/slide';
import type { LiturgyElementType } from '@/types/shared/liturgy';
import type { FixedElement, FixedSlide } from '@/types/shared/fixed-elements';
import { fixedElementToSlides } from '@/lib/fixedElementToSlides';

type FixedElementLiturgyType =
  | 'padre-nuestro'
  | 'paz'
  | 'santa-cena'
  | 'accion-gracias'
  | 'ofrenda'
  | 'bendicion';

interface ElementoFijoEditorProps {
  elementType: FixedElementLiturgyType;
  fixedElementFile: string;
  initialSlides?: SlideGroup;
  editedSlides?: SlideGroup;
  onSlidesGenerated: (slides: SlideGroup, isEdited: boolean) => void;
}

// Mapeo de tipos de liturgia a archivos de elementos fijos
const ELEMENT_FILES: Record<FixedElementLiturgyType, string> = {
  'padre-nuestro': 'padre-nuestro.json',
  'paz': 'la-paz.json',
  'santa-cena': 'santa-cena.json',
  'accion-gracias': 'accion-de-gracias.json',
  'ofrenda': 'ofrenda.json',
  'bendicion': 'bendicion-final.json',
};

// Labels para los tipos
const ELEMENT_LABELS: Record<FixedElementLiturgyType, string> = {
  'padre-nuestro': 'Padre Nuestro',
  'paz': 'La Paz',
  'santa-cena': 'Santa Cena',
  'accion-gracias': 'Acción de Gracias',
  'ofrenda': 'Ofrenda',
  'bendicion': 'Bendición Final',
};

// Descripciones
const ELEMENT_DESCRIPTIONS: Record<FixedElementLiturgyType, string> = {
  'padre-nuestro': 'Oración comunitaria del Padre Nuestro',
  'paz': 'Momento de compartir la paz',
  'santa-cena': 'Liturgia de la Santa Cena',
  'accion-gracias': 'Oración de acción de gracias eucarística',
  'ofrenda': 'Momento de la ofrenda',
  'bendicion': 'Bendición final del culto',
};

// Path to CASA logo
const CASA_LOGO_PATH = '/lovable-uploads/47301834-0831-465c-ae5e-47a978038312.png';

// Configuración del separador decorativo (idéntica a constants.ts)
const SEPARATOR_CONFIG = {
  lineWidth: 80,
  lineHeight: 1,
  dotRadius: 4,
  gap: 12,
  color: CASA_BRAND.colors.secondary.grayLight,
  dotColor: CASA_BRAND.colors.primary.amber,
};

/**
 * Obtiene el estilo de color según el slide
 * Usa los colores guardados en slide.style, con fallbacks por tipo
 * Esto asegura consistencia entre Constructor preview y Presenter
 */
function getSlideStyle(slide: Slide) {
  const type = slide.type;
  const savedPrimaryColor = slide.style?.primaryColor;
  const savedBgColor = slide.style?.backgroundColor;

  switch (type) {
    case 'prayer-leader':
      return {
        bg: savedBgColor || CASA_BRAND.colors.primary.white,
        text: savedPrimaryColor || CASA_BRAND.colors.primary.black,
        label: 'Líder',
        labelColor: CASA_BRAND.colors.secondary.grayMedium,
      };
    case 'prayer-response':
      return {
        bg: savedBgColor || CASA_BRAND.colors.primary.white,
        text: savedPrimaryColor || CASA_BRAND.colors.primary.amber,
        label: 'Congregación',
        labelColor: savedPrimaryColor || CASA_BRAND.colors.primary.amber,
      };
    case 'prayer-full':
      return {
        bg: savedBgColor || CASA_BRAND.colors.primary.white,
        text: savedPrimaryColor || CASA_BRAND.colors.primary.black,
        label: 'Antifonal',
        labelColor: CASA_BRAND.colors.secondary.grayMedium,
      };
    case 'title':
      return {
        bg: savedBgColor || CASA_BRAND.colors.primary.white,
        text: savedPrimaryColor || CASA_BRAND.colors.primary.black,
        label: 'Título',
        labelColor: CASA_BRAND.colors.secondary.grayMedium,
      };
    case 'blessing':
      return {
        bg: savedBgColor || CASA_BRAND.colors.primary.white,
        text: savedPrimaryColor || CASA_BRAND.colors.primary.amber,
        label: 'Bendición',
        labelColor: savedPrimaryColor || CASA_BRAND.colors.primary.amber,
      };
    default:
      return {
        bg: savedBgColor || CASA_BRAND.colors.primary.white,
        text: savedPrimaryColor || CASA_BRAND.colors.primary.black,
        label: 'Slide',
        labelColor: CASA_BRAND.colors.secondary.grayMedium,
      };
  }
}

/**
 * Componente de slide editable
 */
const EditableSlide: React.FC<{
  slide: Slide;
  index: number;
  isEditing: boolean;
  onEdit: (index: number) => void;
  onDuplicate: (index: number) => void;
  onDelete: (index: number) => void;
  onSaveEdit: (index: number, content: string, secondary?: string) => void;
  onCancelEdit: () => void;
  canDelete: boolean;
}> = ({
  slide,
  index,
  isEditing,
  onEdit,
  onDuplicate,
  onDelete,
  onSaveEdit,
  onCancelEdit,
  canDelete,
}) => {
  const [editContent, setEditContent] = useState(slide.content.primary);
  const [editSecondary, setEditSecondary] = useState(slide.content.secondary || '');
  const style = getSlideStyle(slide);
  const hasSecondary = slide.type === 'prayer-full';

  useEffect(() => {
    setEditContent(slide.content.primary);
    setEditSecondary(slide.content.secondary || '');
  }, [slide]);

  if (isEditing) {
    return (
      <div
        className="p-4 rounded-lg border-2"
        style={{ borderColor: CASA_BRAND.colors.primary.amber }}
      >
        <div className="space-y-3">
          <div>
            <label
              className="block text-xs mb-1"
              style={{
                color: CASA_BRAND.colors.secondary.grayMedium,
                fontFamily: CASA_BRAND.fonts.body,
              }}
            >
              {hasSecondary ? 'Texto del líder' : 'Contenido'}
            </label>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={3}
              className="w-full p-2 rounded border resize-none focus:outline-none focus:ring-2"
              style={{
                borderColor: CASA_BRAND.colors.secondary.grayLight,
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '13px',
                // @ts-expect-error - CSS custom property
                '--tw-ring-color': CASA_BRAND.colors.primary.amber,
              }}
            />
          </div>

          {hasSecondary && (
            <div>
              <label
                className="block text-xs mb-1"
                style={{
                  color: CASA_BRAND.colors.primary.amber,
                  fontFamily: CASA_BRAND.fonts.body,
                }}
              >
                Respuesta de la congregación
              </label>
              <textarea
                value={editSecondary}
                onChange={(e) => setEditSecondary(e.target.value)}
                rows={2}
                className="w-full p-2 rounded border resize-none focus:outline-none focus:ring-2"
                style={{
                  borderColor: CASA_BRAND.colors.secondary.grayLight,
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '13px',
                  // @ts-expect-error - CSS custom property
                  '--tw-ring-color': CASA_BRAND.colors.primary.amber,
                }}
              />
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancelEdit}
              className="px-3 py-1 rounded text-sm transition-colors hover:bg-gray-100"
              style={{
                color: CASA_BRAND.colors.secondary.grayMedium,
                fontFamily: CASA_BRAND.fonts.body,
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => onSaveEdit(index, editContent, hasSecondary ? editSecondary : undefined)}
              className="px-3 py-1 rounded text-sm transition-colors"
              style={{
                backgroundColor: CASA_BRAND.colors.primary.amber,
                color: CASA_BRAND.colors.primary.white,
                fontFamily: CASA_BRAND.fonts.body,
              }}
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Escala proporcional para el separador en preview pequeño
  const previewScale = 0.15;

  return (
    <div className="group relative">
      {/* Slide preview - diseño limpio sin labels ni números */}
      <div
        className="aspect-[4/3] rounded-lg flex flex-col items-center justify-center p-4 text-center relative shadow-md border"
        style={{
          backgroundColor: style.bg,
          borderColor: CASA_BRAND.colors.secondary.grayLight,
        }}
      >
        {/* Logo CASA en esquina superior derecha */}
        <img
          src={CASA_LOGO_PATH}
          alt="CASA"
          className="absolute top-1 right-1 w-4 h-4 opacity-80"
        />

        {/* Contenido - con separadores decorativos */}
        <div className="flex-1 flex flex-col items-center justify-center w-full">
          {slide.type === 'title' ? (
            /* Slide de título con separador debajo */
            <>
              <p
                style={{
                  color: style.text,
                  fontFamily: CASA_BRAND.fonts.heading,
                  fontWeight: 300,
                  fontSize: '12px',
                  lineHeight: 1.5,
                  textAlign: 'center',
                }}
              >
                {slide.content.primary.slice(0, 100)}
                {slide.content.primary.length > 100 && '...'}
              </p>
              {/* Separador decorativo - proporcional al de SlidePreview */}
              <div style={{ display: 'flex', alignItems: 'center', margin: '8px 0' }}>
                <div
                  style={{
                    width: `${SEPARATOR_CONFIG.lineWidth * 1.5 * previewScale}px`,
                    height: `${SEPARATOR_CONFIG.lineHeight}px`,
                    backgroundColor: SEPARATOR_CONFIG.color,
                  }}
                />
                <div
                  style={{
                    width: `${SEPARATOR_CONFIG.dotRadius * 3 * previewScale}px`,
                    height: `${SEPARATOR_CONFIG.dotRadius * 3 * previewScale}px`,
                    borderRadius: '50%',
                    backgroundColor: SEPARATOR_CONFIG.dotColor,
                    margin: `0 ${SEPARATOR_CONFIG.gap * previewScale}px`,
                  }}
                />
                <div
                  style={{
                    width: `${SEPARATOR_CONFIG.lineWidth * 1.5 * previewScale}px`,
                    height: `${SEPARATOR_CONFIG.lineHeight}px`,
                    backgroundColor: SEPARATOR_CONFIG.color,
                  }}
                />
              </div>
            </>
          ) : slide.content.secondary ? (
            /* Slide con líder y congregación - separador entre ellos */
            <>
              <p
                style={{
                  color: CASA_BRAND.colors.primary.black,
                  fontFamily: CASA_BRAND.fonts.body,
                  fontWeight: 400,
                  fontSize: '8px',
                  lineHeight: 1.4,
                  textAlign: 'center',
                }}
              >
                {slide.content.primary.slice(0, 80)}
                {slide.content.primary.length > 80 && '...'}
              </p>
              {/* Separador decorativo - proporcional al de SlidePreview */}
              <div style={{ display: 'flex', alignItems: 'center', margin: '4px 0' }}>
                <div
                  style={{
                    width: `${SEPARATOR_CONFIG.lineWidth * previewScale}px`,
                    height: `${SEPARATOR_CONFIG.lineHeight}px`,
                    backgroundColor: SEPARATOR_CONFIG.color,
                  }}
                />
                <div
                  style={{
                    width: `${SEPARATOR_CONFIG.dotRadius * 2 * previewScale}px`,
                    height: `${SEPARATOR_CONFIG.dotRadius * 2 * previewScale}px`,
                    borderRadius: '50%',
                    backgroundColor: SEPARATOR_CONFIG.dotColor,
                    margin: `0 ${SEPARATOR_CONFIG.gap * previewScale}px`,
                  }}
                />
                <div
                  style={{
                    width: `${SEPARATOR_CONFIG.lineWidth * previewScale}px`,
                    height: `${SEPARATOR_CONFIG.lineHeight}px`,
                    backgroundColor: SEPARATOR_CONFIG.color,
                  }}
                />
              </div>
              <p
                style={{
                  color: CASA_BRAND.colors.primary.amber,
                  fontFamily: CASA_BRAND.fonts.body,
                  fontWeight: 600,
                  fontSize: '8px',
                  lineHeight: 1.4,
                  textAlign: 'center',
                }}
              >
                {slide.content.secondary.slice(0, 60)}
                {slide.content.secondary.length > 60 && '...'}
              </p>
            </>
          ) : (
            /* Slide simple sin secondary */
            <p
              style={{
                color: style.text,
                fontFamily: CASA_BRAND.fonts.body,
                fontWeight: slide.type === 'prayer-response' || slide.type === 'blessing' ? 600 : 400,
                fontSize: '9px',
                lineHeight: 1.5,
                textAlign: 'center',
              }}
            >
              {slide.content.primary.slice(0, 100)}
              {slide.content.primary.length > 100 && '...'}
            </p>
          )}
        </div>
      </div>

      {/* Acciones (hover) */}
      <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => onEdit(index)}
          className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          title="Editar"
        >
          <Edit3 size={14} color="white" />
        </button>
        <button
          type="button"
          onClick={() => onDuplicate(index)}
          className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          title="Duplicar"
        >
          <Copy size={14} color="white" />
        </button>
        {canDelete && (
          <button
            type="button"
            onClick={() => onDelete(index)}
            className="p-2 rounded-full bg-red-500/50 hover:bg-red-500/70 transition-colors"
            title="Eliminar"
          >
            <Trash2 size={14} color="white" />
          </button>
        )}
      </div>
    </div>
  );
};

const ElementoFijoEditor: React.FC<ElementoFijoEditorProps> = ({
  elementType,
  fixedElementFile,
  initialSlides,
  editedSlides,
  onSlidesGenerated,
}) => {
  // Estados
  const [originalElement, setOriginalElement] = useState<FixedElement | null>(null);
  const [originalSlides, setOriginalSlides] = useState<SlideGroup | null>(null);
  const [currentSlides, setCurrentSlides] = useState<Slide[]>(
    editedSlides?.slides || initialSlides?.slides || []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [editingSlideIndex, setEditingSlideIndex] = useState<number | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const elementLabel = ELEMENT_LABELS[elementType];
  const elementDescription = ELEMENT_DESCRIPTIONS[elementType];

  // Cargar elemento fijo original
  useEffect(() => {
    const loadElement = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const fileName = ELEMENT_FILES[elementType];
        const response = await fetch(`/data/elementos-fijos/${fileName}`);

        if (!response.ok) {
          throw new Error('No se pudo cargar el elemento');
        }

        const element: FixedElement = await response.json();
        setOriginalElement(element);

        // Convertir a slides
        const slides = fixedElementToSlides(element);
        setOriginalSlides(slides);

        // Si no hay slides editados, usar los originales
        if (!editedSlides?.slides.length && !initialSlides?.slides.length) {
          setCurrentSlides(slides.slides);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar');
      } finally {
        setIsLoading(false);
      }
    };

    loadElement();
  }, [elementType, editedSlides, initialSlides]);

  // Detectar cambios
  useEffect(() => {
    if (!originalSlides) return;

    const hasEdits = currentSlides.some((slide, index) => {
      const original = originalSlides.slides[index];
      if (!original) return true;
      return (
        slide.content.primary !== original.content.primary ||
        slide.content.secondary !== original.content.secondary
      );
    }) || currentSlides.length !== originalSlides.slides.length;

    setHasChanges(hasEdits);
  }, [currentSlides, originalSlides]);

  // Editar slide
  const handleEditSlide = useCallback((index: number) => {
    setEditingSlideIndex(index);
  }, []);

  // Guardar edición de slide
  const handleSaveSlideEdit = useCallback((index: number, content: string, secondary?: string) => {
    setCurrentSlides(prev => {
      const newSlides = [...prev];
      newSlides[index] = {
        ...newSlides[index],
        content: {
          ...newSlides[index].content,
          primary: content,
          secondary,
        },
      };
      return newSlides;
    });
    setEditingSlideIndex(null);
  }, []);

  // Cancelar edición
  const handleCancelEdit = useCallback(() => {
    setEditingSlideIndex(null);
  }, []);

  // Duplicar slide
  const handleDuplicateSlide = useCallback((index: number) => {
    setCurrentSlides(prev => {
      const newSlides = [...prev];
      const duplicated = {
        ...prev[index],
        id: `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };
      newSlides.splice(index + 1, 0, duplicated);
      return newSlides;
    });
  }, []);

  // Eliminar slide
  const handleDeleteSlide = useCallback((index: number) => {
    setCurrentSlides(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Restaurar original
  const handleRestoreOriginal = useCallback(() => {
    if (originalSlides) {
      setCurrentSlides([...originalSlides.slides]);
    }
  }, [originalSlides]);

  // Guardar
  const handleSave = useCallback(() => {
    if (!originalSlides) return;

    const slideGroup: SlideGroup = {
      ...originalSlides,
      id: `${elementType}-${Date.now()}`,
      slides: currentSlides,
      metadata: {
        ...originalSlides.metadata,
        createdAt: new Date().toISOString(),
      },
    };

    onSlidesGenerated(slideGroup, hasChanges);
  }, [elementType, currentSlides, originalSlides, hasChanges, onSlidesGenerated]);

  // Loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2
          size={32}
          className="animate-spin"
          style={{ color: CASA_BRAND.colors.primary.amber }}
        />
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="text-center py-12">
        <p
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
            color: '#DC2626',
          }}
        >
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3
            style={{
              fontFamily: CASA_BRAND.fonts.heading,
              fontSize: '20px',
              fontWeight: 400,
              color: CASA_BRAND.colors.primary.black,
              marginBottom: '4px',
            }}
          >
            {elementLabel}
          </h3>
          <p
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              color: CASA_BRAND.colors.secondary.grayMedium,
            }}
          >
            {elementDescription}
          </p>
        </div>

        {/* Indicador de cambios */}
        {hasChanges && (
          <span
            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs"
            style={{
              backgroundColor: `${CASA_BRAND.colors.primary.amber}20`,
              color: CASA_BRAND.colors.primary.amber,
              fontFamily: CASA_BRAND.fonts.body,
            }}
          >
            <Edit3 size={12} />
            Editado
          </span>
        )}
      </div>

      {/* Instrucciones */}
      <div
        className="p-3 rounded-lg"
        style={{
          backgroundColor: `${CASA_BRAND.colors.amber.light}10`,
          borderWidth: 1,
          borderColor: CASA_BRAND.colors.amber.light,
        }}
      >
        <p
          className="text-sm"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            color: CASA_BRAND.colors.secondary.grayDark,
          }}
        >
          Los cambios que hagas aquí solo aplican a esta liturgia.
          El template original no se modificará.
        </p>
      </div>

      {/* Vista previa */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-2"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '13px',
              fontWeight: 500,
              color: CASA_BRAND.colors.primary.black,
            }}
          >
            <Eye size={14} />
            Slides ({currentSlides.length})
            {showPreview ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {hasChanges && (
            <button
              type="button"
              onClick={handleRestoreOriginal}
              className="flex items-center gap-1 px-3 py-1 rounded-full text-sm transition-colors hover:bg-gray-100"
              style={{
                color: CASA_BRAND.colors.secondary.grayMedium,
                fontFamily: CASA_BRAND.fonts.body,
              }}
            >
              <RotateCcw size={14} />
              Restaurar original
            </button>
          )}
        </div>

        {showPreview && (
          <div className="grid grid-cols-4 gap-3">
            {currentSlides.map((slide, index) => (
              <EditableSlide
                key={slide.id}
                slide={slide}
                index={index}
                isEditing={editingSlideIndex === index}
                onEdit={handleEditSlide}
                onDuplicate={handleDuplicateSlide}
                onDelete={handleDeleteSlide}
                onSaveEdit={handleSaveSlideEdit}
                onCancelEdit={handleCancelEdit}
                canDelete={currentSlides.length > 1}
              />
            ))}
          </div>
        )}
      </div>

      {/* Botón guardar */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-2 rounded-full transition-colors"
          style={{
            backgroundColor: CASA_BRAND.colors.primary.amber,
            color: CASA_BRAND.colors.primary.white,
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
          }}
        >
          <Save size={16} />
          {hasChanges ? 'Guardar cambios' : 'Confirmar'}
        </button>
      </div>
    </div>
  );
};

export default ElementoFijoEditor;
