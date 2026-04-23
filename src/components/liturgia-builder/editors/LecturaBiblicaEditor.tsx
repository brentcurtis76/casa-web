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
 * Máximo de caracteres por slide para lectura legible.
 * Calibrado al font-size efectivo del presentador: 34px base × 1.3 boost
 * (FONT_SIZE_BOOSTED_SOURCES en UniversalSlide) ≈ 44px. A ese tamaño caben
 * ~35 chars por línea × 6 líneas = ~210 chars antes de que el slide se
 * desborde verticalmente.
 */
const MAX_CHARS_PER_SLIDE = 210;
const MAX_LINES_PER_SLIDE = 6;
const AVG_CHARS_PER_LINE = 35;

/**
 * Limpia el texto bíblico eliminando marcado que filtra desde APIs
 * (etiquetas HTML como <sup>, referencias a notas como [43], números de
 * versículo sueltos, etc.) para dejar solo la prosa legible.
 */
function removeVerseNumbers(text: string): string {
  return text
    // Etiquetas HTML (sup, b, i, span, etc.) que algunas fuentes bíblicas dejan
    .replace(/<[^>]+>/g, '')
    // Referencias bracketeadas a notas al pie: [43], [a], [footnote 1]
    .replace(/\[[^\]]+\]/g, '')
    // Números al inicio del texto (1-176 para cubrir Salmo 119)
    .replace(/^\s*\d{1,3}\s+/g, '')
    // Números después de puntuación o espacio, seguidos de espacio
    .replace(/\s+\d{1,3}\s+/g, ' ')
    // Números después de puntuación directamente
    .replace(/([.!?,;:'"])\s*\d{1,3}\s+/g, '$1 ')
    // Limpiar múltiples espacios
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Divide un texto en chunks por palabras, sin exceder targetChars por chunk.
 * Último recurso cuando ni oraciones ni cláusulas caben.
 */
function splitByWords(text: string, targetChars: number): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let current = '';
  for (const word of words) {
    const potential = current ? `${current} ${word}` : word;
    if (potential.length > targetChars && current) {
      chunks.push(current.trim());
      current = word;
    } else {
      current = potential;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/**
 * Divide una oración larga en fragmentos, prefiriendo límites de cláusula
 * (coma, punto y coma, dos puntos). Cae a división por palabras si alguna
 * cláusula excede targetChars.
 */
function splitLongSentence(sentence: string, targetChars: number): string[] {
  const clauses = sentence.split(/(?<=[,;:])\s+/).filter((s) => s.trim());
  if (clauses.length <= 1) {
    return splitByWords(sentence, targetChars);
  }

  const chunks: string[] = [];
  let current = '';
  for (const clause of clauses) {
    const potential = current ? `${current} ${clause}` : clause;
    if (potential.length > targetChars && current) {
      chunks.push(current.trim());
      current = clause;
    } else {
      current = potential;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks.flatMap((chunk) =>
    chunk.length <= targetChars ? [chunk] : splitByWords(chunk, targetChars)
  );
}

/**
 * Divide el texto de la lectura en slides, prefiriendo límites de oración
 * (. ! ? ») sobre cláusulas y palabras. Evita cortes a mitad de frase que
 * producen slides feos como "...Jesús les | puso este ejemplo...".
 */
function splitReadingIntoSlides(reading: LiturgyReading): string[] {
  const cleanText = removeVerseNumbers(reading.text);
  const maxChars = MAX_LINES_PER_SLIDE * AVG_CHARS_PER_LINE; // 6 * 35 = 210

  if (cleanText.length <= maxChars) {
    return [cleanText];
  }

  const numSlides = Math.ceil(cleanText.length / maxChars);
  const targetChars = Math.ceil(cleanText.length / numSlides);

  // Segmenta por oraciones usando lookbehind sobre puntuación fuerte seguida
  // de espacio. Preserva la puntuación al final de cada oración.
  const sentences = cleanText.split(/(?<=[.!?»])\s+/).filter((s) => s.trim());

  const slides: string[] = [];
  let currentSlide = '';

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    // Oración que por sí sola excede el máximo: flush + sub-dividir por cláusulas
    if (trimmed.length > maxChars) {
      if (currentSlide) {
        slides.push(currentSlide.trim());
        currentSlide = '';
      }
      slides.push(...splitLongSentence(trimmed, targetChars));
      continue;
    }

    const potential = currentSlide ? `${currentSlide} ${trimmed}` : trimmed;
    if (potential.length > targetChars && currentSlide) {
      slides.push(currentSlide.trim());
      currentSlide = trimmed;
    } else {
      currentSlide = potential;
    }
  }

  if (currentSlide.trim()) {
    slides.push(currentSlide.trim());
  }

  // Post-proceso: si el último slide es muy corto (< 40% del objetivo),
  // fusionarlo con el anterior
  while (slides.length > 1) {
    const lastSlide = slides[slides.length - 1];
    if (lastSlide.length < targetChars * 0.4) {
      slides.pop();
      slides[slides.length - 1] = `${slides[slides.length - 1]} ${lastSlide}`;
    } else {
      break;
    }
  }

  return slides;
}

/**
 * Combina una o más lecturas en un SlideGroup único. Cada lectura aporta su
 * propio slide de título seguido por sus chunks de contenido.
 *
 * Nota: el subtítulo de la última lámina de cada lectura NO lleva el guión
 * largo ("— ") como prefijo; el renderer en UniversalSlide ya lo añade, así
 * que duplicarlo producía "— — Juan 10:1-10 (NVI)".
 */
function combineReadingsToSlideGroup(
  items: Array<{ reading: LiturgyReading; texts: string[] }>
): SlideGroup {
  const allSlides: Slide[] = [];
  const totalSlides = items.reduce((sum, item) => sum + item.texts.length + 1, 0);
  let order = 0;

  for (const { reading, texts } of items) {
    // Slide de título por lectura
    allSlides.push({
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
        order: order++,
        groupTotal: totalSlides,
      },
    });

    // Slides de contenido para esta lectura
    texts.forEach((text, index) => {
      const isLast = index === texts.length - 1;
      allSlides.push({
        id: generateId(),
        type: 'reading',
        content: {
          primary: text,
          subtitle: isLast ? `${reading.reference} (${reading.versionCode})` : undefined,
        },
        style: {
          primaryColor: CASA_BRAND.colors.primary.black,
          backgroundColor: CASA_BRAND.colors.primary.white,
          primaryFont: CASA_BRAND.fonts.body,
        },
        metadata: {
          sourceComponent: 'lectura-biblica-editor',
          sourceId: 'lectura-biblica',
          order: order++,
          groupTotal: totalSlides,
        },
      });
    });
  }

  return {
    id: generateId(),
    type: 'reading',
    title:
      items.length === 1
        ? `Lectura: ${items[0].reading.reference}`
        : `Lecturas: ${items.map((i) => i.reading.reference).join(' • ')}`,
    slides: allSlides,
    metadata: {
      sourceComponent: 'lectura-biblica-editor',
      createdAt: new Date().toISOString(),
    },
  };
}

/**
 * Atajo para el preview: un solo SlideGroup para la lectura seleccionada.
 */
function readingToSlideGroup(
  reading: LiturgyReading,
  slideTexts: string[]
): SlideGroup {
  return combineReadingsToSlideGroup([{ reading, texts: slideTexts }]);
}

/**
 * Configuración de slides (consistente con el módulo liturgia)
 */
const SLIDE_CONFIG = {
  width: 1024,
  height: 768,
  padding: { horizontal: 64, vertical: 48 },
  fontSize: { title: 72, content: 28, reference: 32, subtitle: 36 },
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
                    fontWeight: 500,
                    fontSize: `${fontSize.subtitle}px`,
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
  // Ediciones por lectura (por índice). Un map permite preservar cambios cuando
  // el usuario alterna entre pestañas de lecturas sin perder sus ajustes.
  const [customTextsByReading, setCustomTextsByReading] = useState<Record<number, string[]>>({});
  const [showPreview, setShowPreview] = useState(true);
  const [editingSlideIndex, setEditingSlideIndex] = useState<number | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [regenerateKey, setRegenerateKey] = useState(0); // Clave para forzar regeneración
  const [isRegenerating, setIsRegenerating] = useState(false); // Visual feedback

  const readings = useMemo(() => context.readings || [], [context.readings]);
  const hasReadings = readings.length > 0;
  const selectedReading = hasReadings ? readings[selectedReadingIndex] : null;

  // División automática para la lectura seleccionada (para preview)
  const autoSlideTexts = useMemo(() => {
    if (!selectedReading?.text) return [];
    console.log('[LecturaBiblicaEditor] Regenerando slides...', { regenerateKey });
    return splitReadingIntoSlides(selectedReading);
  }, [selectedReading, regenerateKey]);

  // Usar división personalizada (si existe para esta lectura) o automática
  const slideTexts = customTextsByReading[selectedReadingIndex] ?? autoSlideTexts;

  // Generar SlideGroup para preview — solo la lectura seleccionada
  const previewSlideGroup = useMemo(() => {
    if (!selectedReading) return null;
    return readingToSlideGroup(selectedReading, slideTexts);
  }, [selectedReading, slideTexts]);

  // Resolver textos finales de cada lectura (custom o auto) para construir el
  // SlideGroup combinado al guardar.
  const resolveAllReadings = useCallback(
    () =>
      readings.map((reading, idx) => ({
        reading,
        texts: customTextsByReading[idx] ?? splitReadingIntoSlides(reading),
      })),
    [readings, customTextsByReading]
  );

  // Regenerar división de la lectura seleccionada
  const handleRegenerate = useCallback(() => {
    setIsRegenerating(true);
    setCustomTextsByReading((prev) => {
      const next = { ...prev };
      delete next[selectedReadingIndex];
      return next;
    });
    setRegenerateKey((k) => k + 1);
    setTimeout(() => setIsRegenerating(false), 300);
  }, [selectedReadingIndex]);

  // Editar un slide específico
  const handleEditSlide = useCallback((index: number) => {
    setEditingSlideIndex(index);
  }, []);

  // Guardar edición de slide (aplica a la lectura seleccionada)
  const handleSaveSlideEdit = useCallback(
    (newText: string) => {
      if (editingSlideIndex === null) return;
      const newTexts = [...slideTexts];
      newTexts[editingSlideIndex] = newText;
      setCustomTextsByReading((prev) => ({ ...prev, [selectedReadingIndex]: newTexts }));
      setEditingSlideIndex(null);
    },
    [editingSlideIndex, slideTexts, selectedReadingIndex]
  );

  // Dividir un slide en dos (en la lectura seleccionada)
  const handleSplitSlide = useCallback(
    (index: number) => {
      const text = slideTexts[index];
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
        const spaceIndex = text.lastIndexOf(' ', midpoint);
        if (spaceIndex > 0) {
          splitPoint = spaceIndex;
        }
      }

      const newTexts = [...slideTexts];
      newTexts.splice(index, 1, text.slice(0, splitPoint).trim(), text.slice(splitPoint).trim());
      setCustomTextsByReading((prev) => ({ ...prev, [selectedReadingIndex]: newTexts }));
    },
    [slideTexts, selectedReadingIndex]
  );

  // Guardar: combina TODAS las lecturas en un solo SlideGroup. Antes solo se
  // guardaba la lectura seleccionada, sobrescribiendo cualquier otra al cambiar
  // de pestaña.
  const handleSave = useCallback(() => {
    if (!hasReadings) return;
    const combined = combineReadingsToSlideGroup(resolveAllReadings());
    onSlidesGenerated(combined);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  }, [hasReadings, resolveAllReadings, onSlidesGenerated]);

  // Detecta slides guardados con la calibración anterior o con formato viejo
  // de subtítulo. Los chunks viejos (pre-boost) tenían hasta ~360 chars y
  // ahora se desbordan; el subtítulo anterior incluía un "— " literal que el
  // renderer ya añade, produciendo doble guión largo en la cita.
  const hasStaleSlides = useMemo(() => {
    if (!initialSlides?.slides) return false;
    return initialSlides.slides.some((s) => {
      if (s.type !== 'reading') return false;
      if ((s.content?.primary?.length ?? 0) > MAX_CHARS_PER_SLIDE) return true;
      if (s.content?.subtitle?.trimStart().startsWith('—')) return true;
      return false;
    });
  }, [initialSlides]);

  // Regenera chunks desde el texto fuente (de TODAS las lecturas) e
  // inmediatamente guarda. Descarta customTextsByReading para volver al estado
  // generado automáticamente.
  const handleRegenerateAndSave = useCallback(() => {
    if (!hasReadings) return;
    const items = readings.map((reading) => ({
      reading,
      texts: splitReadingIntoSlides(reading),
    }));
    const combined = combineReadingsToSlideGroup(items);
    setCustomTextsByReading({});
    setRegenerateKey((k) => k + 1);
    onSlidesGenerated(combined);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  }, [hasReadings, readings, onSlidesGenerated]);

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
              onClick={() => setSelectedReadingIndex(index)}
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

      {/* Banner: slides desactualizados (calibración anterior) */}
      {hasStaleSlides && !isSaved && (
        <div
          className="p-3 rounded-lg border flex items-center justify-between gap-3"
          style={{
            backgroundColor: '#FEF3C7',
            borderColor: '#FBBF24',
            fontFamily: CASA_BRAND.fonts.body,
          }}
        >
          <div className="flex items-start gap-2 flex-1">
            <AlertCircle
              size={18}
              style={{ color: '#B45309', flexShrink: 0, marginTop: 2 }}
            />
            <div>
              <p
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#92400E',
                  marginBottom: '2px',
                }}
              >
                Slides desactualizados
              </p>
              <p style={{ fontSize: '12px', color: '#92400E' }}>
                Esta lectura fue dividida con la calibración anterior y el texto se desborda del slide. Regenera para ajustar al tamaño actual de fuente.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRegenerateAndSave}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors flex-shrink-0"
            style={{
              backgroundColor: '#B45309',
              color: CASA_BRAND.colors.primary.white,
              fontFamily: CASA_BRAND.fonts.body,
              fontWeight: 500,
            }}
          >
            <RefreshCw size={14} />
            Regenerar y guardar
          </button>
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
              disabled={isRegenerating}
              className="flex items-center gap-1 px-3 py-1 rounded-full text-sm transition-colors hover:bg-white/50 disabled:opacity-50"
              style={{
                color: CASA_BRAND.colors.primary.amber,
                fontFamily: CASA_BRAND.fonts.body,
              }}
            >
              <RefreshCw size={14} className={isRegenerating ? 'animate-spin' : ''} />
              {isRegenerating ? 'Regenerando...' : 'Regenerar'}
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
            <div className="space-y-4" key={`preview-${regenerateKey}`}>
              {/* Grid de slides */}
              <div className="grid grid-cols-4 gap-3">
                {previewSlideGroup.slides.map((slide, index) => {
                  console.log(`[Render] Slide ${index} content:`, slide.content.primary?.substring(0, 30));
                  return (
                    <ReadingSlidePreview
                      key={`${slide.id}-${regenerateKey}`}
                      slide={slide}
                      index={index}
                      onEdit={index > 0 ? handleEditSlide : undefined}
                    />
                  );
                })}
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
