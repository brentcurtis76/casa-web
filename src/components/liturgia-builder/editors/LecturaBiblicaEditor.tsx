/**
 * LecturaBiblicaEditor - Editor para la lectura bíblica
 * Usa las lecturas cargadas desde el Contexto Transversal
 */

import React, { useState, useCallback, useMemo } from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import {
  BookOpen,
  Eye,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Save,
  AlertCircle,
  Edit3,
  Scissors,
  Check,
} from 'lucide-react';
import type { LiturgyContext, LiturgyReading } from '@/types/shared/liturgy';
import type { SlideGroup, Slide } from '@/types/shared/slide';

interface LecturaBiblicaEditorProps {
  context: LiturgyContext;
  initialSlides?: SlideGroup;
  onSlidesGenerated: (slides: SlideGroup) => void;
}

/**
 * Genera un ID único
 */
function generateId(): string {
  return `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Máximo de caracteres por slide para lectura legible
 */
const MAX_CHARS_PER_SLIDE = 300;

/**
 * Divide el texto de la lectura en slides
 */
function splitReadingIntoSlides(
  reading: LiturgyReading,
  maxChars: number = MAX_CHARS_PER_SLIDE
): string[] {
  const text = reading.text.trim();

  // Si el texto es corto, un solo slide
  if (text.length <= maxChars) {
    return [text];
  }

  const slides: string[] = [];

  // Intentar dividir por versículos (números seguidos de punto o dos puntos)
  const versePattern = /(\d+[.:]\s*)/g;
  const verses = text.split(versePattern).filter(s => s.trim());

  let currentSlide = '';

  for (let i = 0; i < verses.length; i++) {
    const part = verses[i];

    // Si es un número de versículo, agrégalo al siguiente texto
    if (/^\d+[.:]\s*$/.test(part)) {
      if (i + 1 < verses.length) {
        const combined = part + verses[i + 1];
        if ((currentSlide + combined).length > maxChars && currentSlide) {
          slides.push(currentSlide.trim());
          currentSlide = combined;
        } else {
          currentSlide += combined;
        }
        i++; // Saltar el siguiente porque ya lo procesamos
      }
    } else {
      // Es texto normal
      if ((currentSlide + part).length > maxChars && currentSlide) {
        slides.push(currentSlide.trim());
        currentSlide = part;
      } else {
        currentSlide += part;
      }
    }
  }

  if (currentSlide.trim()) {
    slides.push(currentSlide.trim());
  }

  // Si no se dividió bien, dividir por oraciones
  if (slides.length === 1 && text.length > maxChars) {
    const sentences = text.split(/([.!?]+\s+)/);
    slides.length = 0;
    currentSlide = '';

    for (const sentence of sentences) {
      if ((currentSlide + sentence).length > maxChars && currentSlide) {
        slides.push(currentSlide.trim());
        currentSlide = sentence;
      } else {
        currentSlide += sentence;
      }
    }

    if (currentSlide.trim()) {
      slides.push(currentSlide.trim());
    }
  }

  return slides;
}

/**
 * Convierte una lectura en SlideGroup
 */
function readingToSlideGroup(
  reading: LiturgyReading,
  slideTexts: string[]
): SlideGroup {
  const slides: Slide[] = [];
  const totalSlides = slideTexts.length + 1; // +1 por el título

  // Slide de título
  slides.push({
    id: generateId(),
    type: 'title',
    content: {
      primary: 'LECTURA BÍBLICA',
      subtitle: reading.reference,
    },
    style: {
      primaryColor: CASA_BRAND.colors.primary.black,
      backgroundColor: CASA_BRAND.colors.primary.white,
      primaryFont: CASA_BRAND.fonts.heading,
    },
    metadata: {
      sourceComponent: 'lectura-biblica-editor',
      sourceId: 'lectura-biblica',
      order: 0,
      groupTotal: totalSlides,
    },
  });

  // Slides de contenido
  slideTexts.forEach((text, index) => {
    const isLast = index === slideTexts.length - 1;

    slides.push({
      id: generateId(),
      type: 'reading',
      content: {
        primary: text,
        subtitle: isLast ? `— ${reading.reference} (${reading.versionCode})` : undefined,
      },
      style: {
        primaryColor: CASA_BRAND.colors.primary.black,
        backgroundColor: CASA_BRAND.colors.primary.white,
        primaryFont: CASA_BRAND.fonts.body,
      },
      metadata: {
        sourceComponent: 'lectura-biblica-editor',
        sourceId: 'lectura-biblica',
        order: index + 1,
        groupTotal: totalSlides,
      },
    });
  });

  return {
    id: generateId(),
    type: 'reading',
    title: `Lectura: ${reading.reference}`,
    slides,
    metadata: {
      sourceComponent: 'lectura-biblica-editor',
      createdAt: new Date().toISOString(),
    },
  };
}

/**
 * Configuración de slides (consistente con el módulo liturgia)
 */
const SLIDE_CONFIG = {
  width: 1024,
  height: 768,
  padding: { horizontal: 64, vertical: 48 },
  fontSize: { title: 72, content: 28, reference: 20 },
  separator: {
    lineWidth: 80,
    lineHeight: 1,
    dotRadius: 4,
    gap: 12,
    color: '#E5E5E5',
    dotColor: CASA_BRAND.colors.primary.amber,
  },
};

// Path to CASA logo
const CASA_LOGO_PATH = '/lovable-uploads/47301834-0831-465c-ae5e-47a978038312.png';

/**
 * Componente de vista previa de slide de lectura
 * Diseño consistente con el módulo de liturgia (fondo blanco, texto negro/ámbar)
 */
const ReadingSlidePreview: React.FC<{
  slide: Slide;
  index: number;
  scale?: number;
  onEdit?: (index: number) => void;
}> = ({ slide, index, scale = 0.35, onEdit }) => {
  const isTitle = slide.type === 'title';
  const { width, height, padding, fontSize, separator } = SLIDE_CONFIG;

  return (
    <div className="relative group">
      {/* Slide con diseño consistente */}
      <div
        className="relative bg-white shadow-lg rounded overflow-hidden"
        style={{
          width: width * scale,
          height: height * scale,
          backgroundColor: CASA_BRAND.colors.primary.white,
        }}
      >
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            width: width,
            height: height,
            padding: `${padding.vertical}px ${padding.horizontal}px`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
            position: 'relative',
          }}
        >
          {/* Logo CASA en esquina superior derecha */}
          <img
            src={CASA_LOGO_PATH}
            alt="CASA"
            style={{
              position: 'absolute',
              top: `${padding.vertical}px`,
              right: `${padding.horizontal}px`,
              width: '32px',
              height: '32px',
              opacity: 0.8,
            }}
          />
          {isTitle ? (
            <>
              {/* Slide de título */}
              <h1
                style={{
                  fontFamily: 'Merriweather, Georgia, serif',
                  fontWeight: 300,
                  fontSize: `${fontSize.title}px`,
                  color: CASA_BRAND.colors.primary.black,
                  letterSpacing: '0.02em',
                  textAlign: 'center',
                  marginBottom: '20px',
                }}
              >
                {slide.content.primary}
              </h1>
              {slide.content.subtitle && (
                <p
                  style={{
                    fontFamily: 'Montserrat, Arial, sans-serif',
                    fontWeight: 400,
                    fontSize: `${fontSize.reference}px`,
                    color: CASA_BRAND.colors.primary.amber,
                    textAlign: 'center',
                  }}
                >
                  {slide.content.subtitle}
                </p>
              )}
              {/* Separador decorativo */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginTop: '40px',
                }}
              >
                <div
                  style={{
                    width: `${separator.lineWidth * 1.5}px`,
                    height: `${separator.lineHeight}px`,
                    backgroundColor: separator.color,
                  }}
                />
                <div
                  style={{
                    width: `${separator.dotRadius * 3}px`,
                    height: `${separator.dotRadius * 3}px`,
                    borderRadius: '50%',
                    backgroundColor: separator.dotColor,
                    margin: `0 ${separator.gap}px`,
                  }}
                />
                <div
                  style={{
                    width: `${separator.lineWidth * 1.5}px`,
                    height: `${separator.lineHeight}px`,
                    backgroundColor: separator.color,
                  }}
                />
              </div>
            </>
          ) : (
            <>
              {/* Slide de contenido */}
              <p
                style={{
                  fontFamily: 'Montserrat, Arial, sans-serif',
                  fontWeight: 400,
                  fontSize: `${fontSize.content}px`,
                  color: CASA_BRAND.colors.primary.black,
                  lineHeight: 1.6,
                  textAlign: 'center',
                  maxWidth: '90%',
                }}
              >
                {slide.content.primary}
              </p>
              {slide.content.subtitle && (
                <>
                  {/* Separador antes de la referencia */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      margin: '32px 0 24px 0',
                    }}
                  >
                    <div
                      style={{
                        width: `${separator.lineWidth}px`,
                        height: `${separator.lineHeight}px`,
                        backgroundColor: separator.color,
                      }}
                    />
                    <div
                      style={{
                        width: `${separator.dotRadius * 2}px`,
                        height: `${separator.dotRadius * 2}px`,
                        borderRadius: '50%',
                        backgroundColor: separator.dotColor,
                        margin: `0 ${separator.gap}px`,
                      }}
                    />
                    <div
                      style={{
                        width: `${separator.lineWidth}px`,
                        height: `${separator.lineHeight}px`,
                        backgroundColor: separator.color,
                      }}
                    />
                  </div>
                  <p
                    style={{
                      fontFamily: 'Montserrat, Arial, sans-serif',
                      fontWeight: 500,
                      fontSize: `${fontSize.reference}px`,
                      color: CASA_BRAND.colors.primary.amber,
                      textAlign: 'center',
                    }}
                  >
                    {slide.content.subtitle}
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Overlay de edición */}
      {onEdit && !isTitle && (
        <button
          type="button"
          onClick={() => onEdit(index)}
          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg"
        >
          <Edit3 size={16} color={CASA_BRAND.colors.primary.white} />
        </button>
      )}

      {/* Número de slide */}
      <span
        className="absolute top-1 left-1 w-5 h-5 rounded-full flex items-center justify-center text-xs"
        style={{
          backgroundColor: CASA_BRAND.colors.primary.amber,
          color: CASA_BRAND.colors.primary.white,
          fontFamily: CASA_BRAND.fonts.body,
        }}
      >
        {index + 1}
      </span>
    </div>
  );
};

const LecturaBiblicaEditor: React.FC<LecturaBiblicaEditorProps> = ({
  context,
  initialSlides,
  onSlidesGenerated,
}) => {
  const [selectedReadingIndex, setSelectedReadingIndex] = useState(0);
  const [customSlideTexts, setCustomSlideTexts] = useState<string[] | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [editingSlideIndex, setEditingSlideIndex] = useState<number | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  const readings = context.readings || [];
  const hasReadings = readings.length > 0;
  const selectedReading = hasReadings ? readings[selectedReadingIndex] : null;

  // Generar división automática de slides
  const autoSlideTexts = useMemo(() => {
    if (!selectedReading?.text) return [];
    return splitReadingIntoSlides(selectedReading);
  }, [selectedReading]);

  // Usar división personalizada o automática
  const slideTexts = customSlideTexts || autoSlideTexts;

  // Generar SlideGroup para preview
  const previewSlideGroup = useMemo(() => {
    if (!selectedReading) return null;
    return readingToSlideGroup(selectedReading, slideTexts);
  }, [selectedReading, slideTexts]);

  // Regenerar división
  const handleRegenerate = useCallback(() => {
    setCustomSlideTexts(null);
  }, []);

  // Editar un slide específico
  const handleEditSlide = useCallback((index: number) => {
    setEditingSlideIndex(index);
  }, []);

  // Guardar edición de slide
  const handleSaveSlideEdit = useCallback((newText: string) => {
    if (editingSlideIndex === null) return;

    const newTexts = [...(customSlideTexts || autoSlideTexts)];
    newTexts[editingSlideIndex] = newText;
    setCustomSlideTexts(newTexts);
    setEditingSlideIndex(null);
  }, [editingSlideIndex, customSlideTexts, autoSlideTexts]);

  // Dividir un slide en dos
  const handleSplitSlide = useCallback((index: number) => {
    const texts = customSlideTexts || autoSlideTexts;
    const text = texts[index];
    const midpoint = Math.floor(text.length / 2);

    // Buscar el mejor punto de corte (final de oración o espacio)
    let splitPoint = midpoint;
    for (let i = midpoint; i < text.length && i < midpoint + 50; i++) {
      if (text[i] === '.' || text[i] === '!' || text[i] === '?') {
        splitPoint = i + 1;
        break;
      }
    }

    if (splitPoint === midpoint) {
      // Si no encontramos puntuación, buscar espacio
      const spaceIndex = text.lastIndexOf(' ', midpoint);
      if (spaceIndex > 0) {
        splitPoint = spaceIndex;
      }
    }

    const newTexts = [...texts];
    newTexts.splice(index, 1, text.slice(0, splitPoint).trim(), text.slice(splitPoint).trim());
    setCustomSlideTexts(newTexts);
  }, [customSlideTexts, autoSlideTexts]);

  // Guardar y generar slides finales
  const handleSave = useCallback(() => {
    if (!selectedReading || !previewSlideGroup) return;
    onSlidesGenerated(previewSlideGroup);

    // Mostrar feedback de guardado
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  }, [selectedReading, previewSlideGroup, onSlidesGenerated]);

  // Si no hay lecturas
  if (!hasReadings) {
    return (
      <div className="text-center py-12">
        <AlertCircle
          size={48}
          className="mx-auto mb-4"
          style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
        />
        <h4
          style={{
            fontFamily: CASA_BRAND.fonts.heading,
            fontSize: '18px',
            color: CASA_BRAND.colors.primary.black,
            marginBottom: '8px',
          }}
        >
          No hay lecturas bíblicas
        </h4>
        <p
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
            color: CASA_BRAND.colors.secondary.grayMedium,
          }}
        >
          Agrega lecturas bíblicas en el paso de Contexto para generar los slides.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
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
          Lectura Bíblica
        </h3>
        <p
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
            color: CASA_BRAND.colors.secondary.grayMedium,
          }}
        >
          Genera slides legibles a partir de las lecturas del contexto
        </p>
      </div>

      {/* Selector de lectura (si hay más de una) */}
      {readings.length > 1 && (
        <div className="flex gap-2">
          {readings.map((reading, index) => (
            <button
              key={index}
              type="button"
              onClick={() => {
                setSelectedReadingIndex(index);
                setCustomSlideTexts(null);
              }}
              className={`px-4 py-2 rounded-full transition-colors ${
                selectedReadingIndex === index ? 'ring-2 ring-offset-1' : ''
              }`}
              style={{
                backgroundColor:
                  selectedReadingIndex === index
                    ? CASA_BRAND.colors.primary.amber
                    : CASA_BRAND.colors.secondary.grayLight,
                color:
                  selectedReadingIndex === index
                    ? CASA_BRAND.colors.primary.white
                    : CASA_BRAND.colors.secondary.grayMedium,
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '13px',
                ringColor: CASA_BRAND.colors.primary.amber,
              }}
            >
              {reading.reference}
            </button>
          ))}
        </div>
      )}

      {/* Información de la lectura */}
      {selectedReading && (
        <div
          className="p-4 rounded-lg border"
          style={{
            backgroundColor: `${CASA_BRAND.colors.amber.light}10`,
            borderColor: CASA_BRAND.colors.amber.light,
          }}
        >
          <div className="flex items-start gap-3">
            <BookOpen
              size={20}
              style={{ color: CASA_BRAND.colors.primary.amber }}
            />
            <div className="flex-1">
              <h4
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '14px',
                  fontWeight: 600,
                  color: CASA_BRAND.colors.primary.black,
                }}
              >
                {selectedReading.reference}
              </h4>
              <p
                className="text-xs mt-1"
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  color: CASA_BRAND.colors.secondary.grayMedium,
                }}
              >
                Versión: {selectedReading.version} • {slideTexts.length} slides generados
              </p>
            </div>
            <button
              type="button"
              onClick={handleRegenerate}
              className="flex items-center gap-1 px-3 py-1 rounded-full text-sm transition-colors hover:bg-white/50"
              style={{
                color: CASA_BRAND.colors.primary.amber,
                fontFamily: CASA_BRAND.fonts.body,
              }}
            >
              <RefreshCw size={14} />
              Regenerar
            </button>
          </div>
        </div>
      )}

      {/* Texto completo (colapsable) */}
      {selectedReading?.text && (
        <div>
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-2 mb-2"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '13px',
              fontWeight: 500,
              color: CASA_BRAND.colors.primary.black,
            }}
          >
            <Eye size={14} />
            Vista previa de slides ({previewSlideGroup?.slides.length || 0})
            {showPreview ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showPreview && previewSlideGroup && (
            <div className="space-y-4">
              {/* Grid de slides */}
              <div className="grid grid-cols-4 gap-3">
                {previewSlideGroup.slides.map((slide, index) => (
                  <ReadingSlidePreview
                    key={slide.id}
                    slide={slide}
                    index={index}
                    onEdit={index > 0 ? handleEditSlide : undefined}
                  />
                ))}
              </div>

              {/* Herramientas de edición */}
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-xs"
                  style={{
                    color: CASA_BRAND.colors.secondary.grayMedium,
                    fontFamily: CASA_BRAND.fonts.body,
                  }}
                >
                  Herramientas:
                </span>
                {slideTexts.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSplitSlide(index)}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors hover:bg-gray-100"
                    style={{
                      color: CASA_BRAND.colors.secondary.grayMedium,
                      fontFamily: CASA_BRAND.fonts.body,
                    }}
                    title={`Dividir slide ${index + 2}`}
                  >
                    <Scissors size={12} />
                    Slide {index + 2}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de edición de slide */}
      {editingSlideIndex !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div
            className="bg-white rounded-xl p-6 max-w-lg w-full mx-4"
            style={{ fontFamily: CASA_BRAND.fonts.body }}
          >
            <h4
              className="mb-4"
              style={{
                fontFamily: CASA_BRAND.fonts.heading,
                fontSize: '18px',
                color: CASA_BRAND.colors.primary.black,
              }}
            >
              Editar Slide {editingSlideIndex + 2}
            </h4>
            <textarea
              defaultValue={slideTexts[editingSlideIndex]}
              id="slide-edit-textarea"
              rows={6}
              className="w-full p-3 rounded-lg border resize-none focus:outline-none focus:ring-2"
              style={{
                borderColor: CASA_BRAND.colors.secondary.grayLight,
                fontSize: '14px',
                lineHeight: 1.5,
                // @ts-expect-error - CSS custom property
                '--tw-ring-color': CASA_BRAND.colors.primary.amber,
              }}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setEditingSlideIndex(null)}
                className="px-4 py-2 rounded-lg transition-colors hover:bg-gray-100"
                style={{
                  color: CASA_BRAND.colors.secondary.grayMedium,
                  fontSize: '14px',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const textarea = document.getElementById('slide-edit-textarea') as HTMLTextAreaElement;
                  handleSaveSlideEdit(textarea.value);
                }}
                className="px-4 py-2 rounded-lg transition-colors"
                style={{
                  backgroundColor: CASA_BRAND.colors.primary.amber,
                  color: CASA_BRAND.colors.primary.white,
                  fontSize: '14px',
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {isSaved && (
        <div
          className="p-3 rounded-lg flex items-center gap-2"
          style={{
            backgroundColor: `${CASA_BRAND.colors.amber.light}30`,
            color: CASA_BRAND.colors.amber.dark,
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '13px',
          }}
        >
          <Check size={16} />
          Lectura agregada. Usa el botón "Guardar" principal para guardar en la nube.
        </div>
      )}

      {/* Botón guardar */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={!selectedReading || isSaved}
          className="flex items-center gap-2 px-6 py-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: isSaved ? CASA_BRAND.colors.amber.dark : CASA_BRAND.colors.primary.amber,
            color: CASA_BRAND.colors.primary.white,
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
          }}
        >
          {isSaved ? (
            <>
              <Check size={16} />
              Guardado
            </>
          ) : (
            <>
              <Save size={16} />
              Guardar lectura
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default LecturaBiblicaEditor;
