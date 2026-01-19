/**
 * OracionEditor - Editor para generar oraciones individuales
 * Soporta generación con IA o entrada manual
 * Reutiliza el SlidePreview del módulo de liturgia para consistencia visual
 */

import React, { useState, useCallback } from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import {
  Sparkles,
  Edit3,
  Save,
  RefreshCw,
  Loader2,
  Eye,
  ChevronDown,
  ChevronUp,
  Check,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { SlidePreview } from '@/components/liturgia/SlidePreview';
import type { SlideData, TipoOracion, Tiempo } from '@/components/liturgia/types';
import type { LiturgyContext } from '@/types/shared/liturgy';
import type { SlideGroup, Slide } from '@/types/shared/slide';

type PrayerType = 'oracion-invocacion' | 'oracion-arrepentimiento' | 'oracion-gratitud';

interface OracionEditorProps {
  context: LiturgyContext;
  elementType: PrayerType;
  initialContent?: string;
  initialSlides?: SlideGroup;
  onSlidesGenerated: (slides: SlideGroup) => void;
  onContentChange?: (content: string) => void;
}

// Prompts específicos para cada tipo de oración
const PRAYER_PROMPTS: Record<PrayerType, {
  title: string;
  description: string;
  systemPrompt: string;
}> = {
  'oracion-invocacion': {
    title: 'Oración de Invocación',
    description: 'Oración de apertura que invita a la presencia de Dios',
    systemPrompt: `Eres un pastor luterano escribiendo una oración de invocación para un culto dominical.
La oración debe:
- Invitar la presencia de Dios al inicio del culto
- Ser antifonal (líder y congregación alternando)
- Usar un tono cálido y acogedor
- Tener 3-4 intercambios entre líder y congregación
- Las respuestas de la congregación deben ser cortas y fáciles de seguir
- Relacionarse con el tema del día si se proporciona

Formato de salida (usa exactamente este formato):
LÍDER: [texto del líder]
CONGREGACIÓN: [respuesta de la congregación]
LÍDER: [siguiente texto]
CONGREGACIÓN: [siguiente respuesta]
...`,
  },
  'oracion-arrepentimiento': {
    title: 'Oración de Arrepentimiento',
    description: 'Oración de confesión y arrepentimiento',
    systemPrompt: `Eres un pastor luterano escribiendo una oración de arrepentimiento/confesión para un culto dominical.
La oración debe:
- Guiar a la congregación en un momento de reflexión y confesión
- Ser antifonal (líder y congregación alternando)
- Reconocer la humanidad compartida y la necesidad de gracia
- Terminar con esperanza y la seguridad del perdón de Dios
- Tener 3-4 intercambios entre líder y congregación
- Las respuestas de la congregación deben ser cortas y fáciles de seguir

Formato de salida (usa exactamente este formato):
LÍDER: [texto del líder]
CONGREGACIÓN: [respuesta de la congregación]
LÍDER: [siguiente texto]
CONGREGACIÓN: [siguiente respuesta]
...`,
  },
  'oracion-gratitud': {
    title: 'Oración de Gratitud',
    description: 'Oración de acción de gracias',
    systemPrompt: `Eres un pastor luterano escribiendo una oración de gratitud/acción de gracias para un culto dominical.
La oración debe:
- Expresar agradecimiento por las bendiciones de Dios
- Ser antifonal (líder y congregación alternando)
- Celebrar tanto las bendiciones cotidianas como las espirituales
- Conectar la gratitud con el tema del día si se proporciona
- Tener 3-4 intercambios entre líder y congregación
- Las respuestas de la congregación deben ser cortas y fáciles de seguir

Formato de salida (usa exactamente este formato):
LÍDER: [texto del líder]
CONGREGACIÓN: [respuesta de la congregación]
LÍDER: [siguiente texto]
CONGREGACIÓN: [siguiente respuesta]
...`,
  },
};

/**
 * Genera un ID único
 */
function generateId(): string {
  return `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Mapea el tipo de oración del editor al tipo usado en SlidePreview
 */
function mapPrayerTypeToTipoOracion(elementType: PrayerType): TipoOracion {
  const mapping: Record<PrayerType, TipoOracion> = {
    'oracion-invocacion': 'invocacion',
    'oracion-arrepentimiento': 'arrepentimiento',
    'oracion-gratitud': 'gratitud',
  };
  return mapping[elementType];
}

/**
 * Interface para los slides de preview (compatible con SlidePreview)
 */
interface TitleSlideData {
  tipo: TipoOracion;
  titulo: string;
  isTitle: true;
}

type AnySlideData = SlideData | TitleSlideData;

/**
 * Parsea el texto de la oración antifonal en tiempos (pares líder/congregación)
 */
function parseTextToTiempos(text: string): Tiempo[] {
  const lines = text.split('\n').filter(line => line.trim());
  const tiempos: Tiempo[] = [];
  let currentLider = '';

  for (const line of lines) {
    const leaderMatch = line.match(/^(?:LÍDER|LIDER|L):\s*(.+)/i);
    const congregationMatch = line.match(/^(?:CONGREGACIÓN|CONGREGACION|C):\s*(.+)/i);

    if (leaderMatch) {
      currentLider = leaderMatch[1].trim();
    } else if (congregationMatch && currentLider) {
      tiempos.push({
        lider: currentLider,
        congregacion: congregationMatch[1].trim(),
      });
      currentLider = '';
    }
  }

  return tiempos;
}

/**
 * Convierte tiempos a formato SlideData para vista previa
 */
function tiemposToPreviewSlides(tiempos: Tiempo[], elementType: PrayerType): AnySlideData[] {
  const tipo = mapPrayerTypeToTipoOracion(elementType);
  const prayerInfo = PRAYER_PROMPTS[elementType];
  const slides: AnySlideData[] = [];

  // Slide de título
  slides.push({
    tipo,
    titulo: prayerInfo.title,
    isTitle: true,
  });

  // Slides de contenido (uno por tiempo)
  tiempos.forEach((tiempo, index) => {
    slides.push({
      tipo,
      titulo: prayerInfo.title,
      tiempoNumero: index + 1,
      totalTiempos: tiempos.length,
      lider: tiempo.lider,
      congregacion: tiempo.congregacion,
    });
  });

  return slides;
}

/**
 * Parsea el texto de la oración antifonal en slides (para guardar)
 * Crea slides con líder y congregación JUNTOS (prayer-full)
 */
function parseAntiphonalPrayer(text: string, elementType: PrayerType): Slide[] {
  // Primero parseamos a tiempos (pares líder/congregación)
  const tiempos = parseTextToTiempos(text);
  const slides: Slide[] = [];

  // Agregar slide de título
  const prayerInfo = PRAYER_PROMPTS[elementType];
  slides.push({
    id: generateId(),
    type: 'title',
    content: {
      primary: prayerInfo.title.toUpperCase(),
    },
    style: {
      primaryColor: CASA_BRAND.colors.primary.black,
      backgroundColor: CASA_BRAND.colors.primary.white,
      primaryFont: CASA_BRAND.fonts.heading,
    },
    metadata: {
      sourceComponent: 'oracion-editor',
      sourceId: elementType,
      order: 0,
      groupTotal: tiempos.length + 1,
    },
  });

  // Crear un slide por cada tiempo (líder + congregación juntos)
  tiempos.forEach((tiempo, index) => {
    slides.push({
      id: generateId(),
      type: 'prayer-full',
      content: {
        primary: tiempo.lider,      // Texto del líder (negro)
        secondary: tiempo.congregacion,  // Respuesta congregación (ámbar)
      },
      style: {
        primaryColor: CASA_BRAND.colors.primary.black,
        secondaryColor: CASA_BRAND.colors.primary.amber,
        backgroundColor: CASA_BRAND.colors.primary.white,
        primaryFont: CASA_BRAND.fonts.body,
      },
      metadata: {
        sourceComponent: 'oracion-editor',
        sourceId: elementType,
        order: index + 1,
        groupTotal: tiempos.length + 1,
      },
    });
  });

  return slides;
}

/**
 * Reconstruye el texto antifonal desde los slides guardados
 */
function slidesToText(slides: SlideGroup | undefined): string {
  if (!slides?.slides) return '';

  const lines: string[] = [];
  for (const slide of slides.slides) {
    // Ignorar slides de título
    if (slide.type === 'title' || slide.type === 'prayer-title') continue;

    if (slide.type === 'prayer-full' || slide.type === 'prayer-antiphonal') {
      // Slide con líder y congregación juntos
      if (slide.content.primary) {
        lines.push(`LÍDER: ${slide.content.primary}`);
      }
      if (slide.content.secondary) {
        lines.push(`CONGREGACIÓN: ${slide.content.secondary}`);
      }
    } else if (slide.type === 'prayer-leader') {
      lines.push(`LÍDER: ${slide.content.primary}`);
    } else if (slide.type === 'prayer-response') {
      lines.push(`CONGREGACIÓN: ${slide.content.primary}`);
    }
  }

  return lines.join('\n');
}

const OracionEditor: React.FC<OracionEditorProps> = ({
  context,
  elementType,
  initialContent = '',
  initialSlides,
  onSlidesGenerated,
  onContentChange,
}) => {
  // Reconstruir contenido desde slides si existe, sino usar initialContent
  const reconstructedContent = initialSlides ? slidesToText(initialSlides) : initialContent;

  const [content, setContent] = useState(reconstructedContent);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  // Preview slides usando el formato compatible con SlidePreview del módulo liturgia
  const [previewSlides, setPreviewSlides] = useState<AnySlideData[]>([]);
  const [showPreview, setShowPreview] = useState(true);
  const [isManualMode, setIsManualMode] = useState(!!reconstructedContent);

  const prayerInfo = PRAYER_PROMPTS[elementType];

  // Inicializar preview si hay contenido reconstruido
  React.useEffect(() => {
    if (reconstructedContent) {
      const tiempos = parseTextToTiempos(reconstructedContent);
      const slides = tiemposToPreviewSlides(tiempos, elementType);
      setPreviewSlides(slides);
    }
  }, []);

  // Generar oración con IA usando Supabase Edge Function
  const handleGenerateWithAI = useCallback(async () => {
    setIsGenerating(true);
    setError(null);

    try {
      // Preparar lecturas del contexto
      const lecturasData = context.readings?.map(r => ({
        cita: r.reference,
        texto: r.text || '',
      })) || [];

      // Llamar a la Edge Function de generación
      const { data, error: fnError } = await supabase.functions.invoke<{
        success: boolean;
        oraciones?: {
          invocacion: { titulo: string; tiempos: Tiempo[] };
          arrepentimiento: { titulo: string; tiempos: Tiempo[] };
          gratitud: { titulo: string; tiempos: Tiempo[] };
        };
        error?: string;
      }>('generate-oraciones', {
        body: {
          liturgia: {
            titulo: context.title,
            resumen: context.summary || '',
            lecturas: lecturasData,
          },
        },
      });

      if (fnError) throw fnError;
      if (!data?.success || !data.oraciones) {
        throw new Error(data?.error || 'Error al generar las oraciones');
      }

      // Obtener la oración correspondiente al tipo
      const tipoOracion = mapPrayerTypeToTipoOracion(elementType);
      const oracionGenerada = data.oraciones[tipoOracion];

      // Convertir tiempos a texto editable
      const textContent = oracionGenerada.tiempos
        .map(t => `LÍDER: ${t.lider}\nCONGREGACIÓN: ${t.congregacion}`)
        .join('\n');

      setContent(textContent);
      onContentChange?.(textContent);

      // Generar preview con los tiempos
      const slides = tiemposToPreviewSlides(oracionGenerada.tiempos, elementType);
      setPreviewSlides(slides);

    } catch (err) {
      console.error('Error generating prayer:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsGenerating(false);
    }
  }, [context, elementType, onContentChange]);

  // Manejar cambios en el texto manual
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    onContentChange?.(newContent);

    // Actualizar preview en tiempo real usando el formato SlidePreview
    if (newContent.trim()) {
      const tiempos = parseTextToTiempos(newContent);
      const slides = tiemposToPreviewSlides(tiempos, elementType);
      setPreviewSlides(slides);
    } else {
      setPreviewSlides([]);
    }
  }, [elementType, onContentChange]);

  // Guardar y generar slides finales
  const handleSave = useCallback(() => {
    if (!content.trim()) {
      setError('Por favor, ingresa o genera el contenido de la oración');
      return;
    }

    // Parsear el contenido a tiempos
    const tiempos = parseTextToTiempos(content);

    if (tiempos.length === 0) {
      setError('No se encontraron pares de líder/congregación válidos. Verifica el formato.');
      return;
    }

    // Generar slides en formato Slide[] para el SlideGroup
    const slides = parseAntiphonalPrayer(content, elementType);

    const slideGroup: SlideGroup = {
      id: generateId(),
      type: 'prayer',
      title: prayerInfo.title,
      slides,
      metadata: {
        sourceComponent: 'oracion-editor',
        createdAt: new Date().toISOString(),
        tiemposCount: tiempos.length,
      },
    };

    console.log('OracionEditor handleSave:', { slideGroup, tiempos });
    onSlidesGenerated(slideGroup);

    // Limpiar error si había y mostrar feedback de guardado
    setError(null);
    setIsSaved(true);

    // Resetear el estado de guardado después de 3 segundos
    setTimeout(() => setIsSaved(false), 3000);
  }, [content, elementType, prayerInfo.title, onSlidesGenerated]);

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
          {prayerInfo.title}
        </h3>
        <p
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
            color: CASA_BRAND.colors.secondary.grayMedium,
          }}
        >
          {prayerInfo.description}
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setIsManualMode(false)}
          className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${
            !isManualMode ? 'ring-2 ring-offset-1' : ''
          }`}
          style={{
            backgroundColor: !isManualMode
              ? CASA_BRAND.colors.primary.amber
              : CASA_BRAND.colors.secondary.grayLight,
            color: !isManualMode
              ? CASA_BRAND.colors.primary.white
              : CASA_BRAND.colors.secondary.grayMedium,
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '13px',
            ringColor: CASA_BRAND.colors.primary.amber,
          }}
        >
          <Sparkles size={14} />
          Generar
        </button>
        <button
          type="button"
          onClick={() => setIsManualMode(true)}
          className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${
            isManualMode ? 'ring-2 ring-offset-1' : ''
          }`}
          style={{
            backgroundColor: isManualMode
              ? CASA_BRAND.colors.primary.amber
              : CASA_BRAND.colors.secondary.grayLight,
            color: isManualMode
              ? CASA_BRAND.colors.primary.white
              : CASA_BRAND.colors.secondary.grayMedium,
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '13px',
            ringColor: CASA_BRAND.colors.primary.amber,
          }}
        >
          <Edit3 size={14} />
          Escribir manualmente
        </button>
      </div>

      {/* AI Generation Section */}
      {!isManualMode && (
        <div
          className="p-4 rounded-lg border"
          style={{
            backgroundColor: `${CASA_BRAND.colors.amber.light}10`,
            borderColor: CASA_BRAND.colors.amber.light,
          }}
        >
          <div className="flex items-start gap-4">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: CASA_BRAND.colors.primary.amber }}
            >
              <Sparkles size={20} color={CASA_BRAND.colors.primary.white} />
            </div>
            <div className="flex-1">
              <h4
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '14px',
                  fontWeight: 600,
                  color: CASA_BRAND.colors.primary.black,
                  marginBottom: '4px',
                }}
              >
                Generación Inteligente
              </h4>
              <p
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '13px',
                  color: CASA_BRAND.colors.secondary.grayMedium,
                  marginBottom: '12px',
                }}
              >
                El sistema generará una oración antifonal de {prayerInfo.title} basada en el
                contexto de la liturgia: Tema "{context.title}"{context.summary ? `, Resumen / Enfoque Temático` : ''}{context.readings && context.readings.length > 0 ? ` y Lecturas Bíblicas` : ''}.
              </p>
              <button
                type="button"
                onClick={handleGenerateWithAI}
                disabled={isGenerating}
                className="flex items-center gap-2 px-4 py-2 rounded-full transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: CASA_BRAND.colors.primary.black,
                  color: CASA_BRAND.colors.primary.white,
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '13px',
                }}
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Generando...
                  </>
                ) : content ? (
                  <>
                    <RefreshCw size={14} />
                    Regenerar
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    Generar oración
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div
          className="p-3 rounded-lg"
          style={{
            backgroundColor: '#FEE2E2',
            color: '#DC2626',
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '13px',
          }}
        >
          {error}
        </div>
      )}

      {/* Text Editor */}
      <div>
        <label
          className="block mb-2"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '13px',
            fontWeight: 500,
            color: CASA_BRAND.colors.primary.black,
          }}
        >
          {isManualMode ? 'Escribe la oración' : 'Editar oración generada'}
        </label>
        <textarea
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder={`LÍDER: Señor, te damos gracias por este día...\nCONGREGACIÓN: Te alabamos, Señor.\nLÍDER: Por tu amor que nos sostiene...\nCONGREGACIÓN: Gracias, Señor.`}
          rows={10}
          className="w-full p-4 rounded-lg border resize-none focus:outline-none focus:ring-2"
          style={{
            borderColor: CASA_BRAND.colors.secondary.grayLight,
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
            lineHeight: 1.6,
            // @ts-expect-error - CSS custom property for ring color
            '--tw-ring-color': CASA_BRAND.colors.primary.amber,
          }}
        />
        <p
          className="mt-2"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '12px',
            color: CASA_BRAND.colors.secondary.grayMedium,
          }}
        >
          Formato: LÍDER: [texto] / CONGREGACIÓN: [respuesta]
        </p>
      </div>

      {/* Preview Section - Usando SlidePreview del módulo liturgia */}
      {previewSlides.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-2 mb-3"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '13px',
              fontWeight: 500,
              color: CASA_BRAND.colors.primary.black,
            }}
          >
            <Eye size={14} />
            Vista previa de slides ({previewSlides.length})
            {showPreview ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showPreview && (
            <div className="grid grid-cols-3 gap-4">
              {previewSlides.map((slide, index) => (
                <SlidePreview key={index} slide={slide} scale={0.35} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Success Message */}
      {isSaved && (
        <div
          className="p-3 rounded-lg flex items-center gap-2"
          style={{
            backgroundColor: '#D1FAE5',
            color: '#065F46',
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '13px',
          }}
        >
          <Check size={16} />
          Oración agregada. Usa el botón "Guardar" principal para guardar en la nube.
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={!content.trim() || isSaved}
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
              Guardar oración
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default OracionEditor;
