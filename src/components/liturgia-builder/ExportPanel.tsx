/**
 * ExportPanel - Panel de exportación para liturgias
 * Permite presentar liturgia y descargar materiales para familias y celebrantes
 */

import React, { useState, useMemo } from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import {
  Download,
  Loader2,
  Check,
  BookOpen,
  Play,
  Monitor,
  Heart,
  ExternalLink,
} from 'lucide-react';
import type { LiturgyElement, LiturgyElementType, LiturgyContext } from '@/types/shared/liturgy';
import type { Story } from '@/types/shared/story';
import { exportLiturgy } from '@/lib/liturgia/exportService';
import { exportStoryToPDF } from '@/lib/cuentacuentos/storyPdfExporter';

interface ExportPanelProps {
  elements: Map<LiturgyElementType, LiturgyElement>;
  elementOrder: LiturgyElementType[];
  liturgyContext: LiturgyContext | null;
  onExportComplete?: (format: string) => void;
}

const ExportPanel: React.FC<ExportPanelProps> = ({
  elements,
  elementOrder,
  liturgyContext,
  onExportComplete,
}) => {
  const [exportingCelebrant, setExportingCelebrant] = useState(false);
  const [celebrantCompleted, setCelebrantCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Story PDF export state
  const [exportingStoryPDF, setExportingStoryPDF] = useState(false);
  const [storyPDFCompleted, setStoryPDFCompleted] = useState(false);
  const [storyPDFProgress, setStoryPDFProgress] = useState({ value: 0, message: '' });

  // Detect if there's a story in the elements
  const storyData = useMemo(() => {
    const cuentacuentosElement = elements.get('cuentacuentos');
    const story = cuentacuentosElement?.config?.storyData as Story | undefined;
    // Story is valid if it has cover image and at least one scene with image
    const isValid = !!(
      story?.coverImageUrl &&
      story?.scenes?.length > 0 &&
      story?.scenes?.some((s) => s.selectedImageUrl)
    );
    return isValid ? story : null;
  }, [elements]);

  // Count slides
  const totalSlides = elementOrder.reduce((count, type) => {
    const element = elements.get(type);
    const slides = element?.slides?.slides || element?.editedSlides?.slides || [];
    return count + slides.length;
  }, 0);

  // Handle celebrant guide export
  const handleExportCelebrant = async () => {
    setExportingCelebrant(true);
    setError(null);

    try {
      await exportLiturgy({
        format: 'pdf-celebrant',
        elements,
        elementOrder,
        liturgyContext,
      });

      setCelebrantCompleted(true);
      onExportComplete?.('pdf-celebrant');
    } catch (err) {
      console.error('Export error:', err);
      setError(err instanceof Error ? err.message : 'Error al exportar');
    } finally {
      setExportingCelebrant(false);
    }
  };

  // Handle story PDF export
  const handleExportStoryPDF = async () => {
    if (!storyData) return;

    setExportingStoryPDF(true);
    setError(null);
    setStoryPDFProgress({ value: 0, message: 'Iniciando...' });

    try {
      const blob = await exportStoryToPDF(storyData, (value, message) => {
        setStoryPDFProgress({ value, message });
      });

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${storyData.title.replace(/\s+/g, '_')}_cuento.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStoryPDFCompleted(true);
      onExportComplete?.('story-pdf');
    } catch (err) {
      console.error('Story PDF export error:', err);
      setError(err instanceof Error ? err.message : 'Error al exportar el cuento');
    } finally {
      setExportingStoryPDF(false);
    }
  };

  // Open presenter in new tab
  const handleOpenPresenter = () => {
    window.open('/presenter', '_blank');
  };

  const liturgyTitle = liturgyContext?.title || 'Liturgia';
  const liturgyDate = liturgyContext?.date
    ? new Date(liturgyContext.date).toLocaleDateString('es-CL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  return (
    <div className="space-y-6">
      {/* Presenter Section */}
      <div
        className="p-6 rounded-xl text-center"
        style={{
          background: `linear-gradient(135deg, ${CASA_BRAND.colors.primary.black} 0%, ${CASA_BRAND.colors.secondary.carbon} 100%)`,
        }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: CASA_BRAND.colors.primary.amber }}
        >
          <Monitor size={28} style={{ color: CASA_BRAND.colors.primary.black }} />
        </div>
        <h2
          style={{
            fontFamily: CASA_BRAND.fonts.heading,
            fontSize: '24px',
            fontWeight: 300,
            color: CASA_BRAND.colors.primary.white,
            letterSpacing: '0.05em',
          }}
        >
          Presentar Liturgia
        </h2>
        <p
          className="mt-2 mb-4"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
            color: CASA_BRAND.colors.secondary.grayLight,
          }}
        >
          {liturgyTitle}
          {liturgyDate && ` • ${liturgyDate}`}
          {' • '}{totalSlides} slides
        </p>
        <button
          onClick={handleOpenPresenter}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all hover:scale-105"
          style={{
            backgroundColor: CASA_BRAND.colors.primary.amber,
            color: CASA_BRAND.colors.primary.black,
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '16px',
          }}
        >
          <Play size={20} />
          Abrir Presentador
          <ExternalLink size={16} />
        </button>
        <p
          className="mt-3"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '12px',
            color: CASA_BRAND.colors.secondary.grayMedium,
          }}
        >
          Se abrirá en una nueva pestaña
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div
          className="p-4 rounded-lg"
          style={{
            backgroundColor: '#FEE2E2',
            color: '#DC2626',
          }}
        >
          <p style={{ fontFamily: CASA_BRAND.fonts.body, fontSize: '14px' }}>{error}</p>
        </div>
      )}

      {/* Downloadables Section */}
      <div className="space-y-4">
        <h3
          className="text-center"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '16px',
            fontWeight: 600,
            color: CASA_BRAND.colors.primary.black,
          }}
        >
          Materiales para descargar
        </h3>

        {/* Story PDF - Only show if there's a valid story */}
        {storyData && (
          <div
            className="p-5 rounded-xl"
            style={{
              background: `linear-gradient(135deg, ${CASA_BRAND.colors.primary.amber}15 0%, ${CASA_BRAND.colors.primary.amber}05 100%)`,
              border: `2px solid ${CASA_BRAND.colors.primary.amber}40`,
            }}
          >
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: CASA_BRAND.colors.primary.amber }}
              >
                <Heart size={22} style={{ color: CASA_BRAND.colors.primary.white }} />
              </div>

              {/* Content */}
              <div className="flex-1">
                <h4
                  style={{
                    fontFamily: CASA_BRAND.fonts.heading,
                    fontSize: '16px',
                    fontWeight: 600,
                    color: CASA_BRAND.colors.primary.black,
                  }}
                >
                  Cuento para Familias
                </h4>
                <p
                  className="mt-1"
                  style={{
                    fontFamily: CASA_BRAND.fonts.body,
                    fontSize: '13px',
                    color: CASA_BRAND.colors.secondary.grayDark,
                  }}
                >
                  PDF ilustrado de "{storyData.title}" para leer en casa
                </p>

                {/* Progress bar when exporting */}
                {exportingStoryPDF && (
                  <div className="mt-3">
                    <div
                      className="h-2 rounded-full overflow-hidden"
                      style={{ backgroundColor: CASA_BRAND.colors.secondary.grayLight }}
                    >
                      <div
                        className="h-full transition-all duration-300"
                        style={{
                          width: `${storyPDFProgress.value}%`,
                          backgroundColor: CASA_BRAND.colors.primary.amber,
                        }}
                      />
                    </div>
                    <p
                      className="mt-1 text-sm"
                      style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                    >
                      {storyPDFProgress.message}
                    </p>
                  </div>
                )}

                {/* Download button */}
                <button
                  onClick={handleExportStoryPDF}
                  disabled={exportingStoryPDF}
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  style={{
                    backgroundColor: CASA_BRAND.colors.primary.amber,
                    color: CASA_BRAND.colors.primary.white,
                    fontFamily: CASA_BRAND.fonts.body,
                    fontSize: '13px',
                  }}
                >
                  {exportingStoryPDF ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Generando...
                    </>
                  ) : storyPDFCompleted ? (
                    <>
                      <Check size={16} />
                      Descargado
                    </>
                  ) : (
                    <>
                      <Download size={16} />
                      Descargar PDF
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Celebrant Guide */}
        <div
          className="p-5 rounded-xl"
          style={{
            backgroundColor: CASA_BRAND.colors.primary.white,
            border: `1px solid ${CASA_BRAND.colors.secondary.grayLight}`,
          }}
        >
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${CASA_BRAND.colors.primary.amber}20` }}
            >
              <BookOpen size={22} style={{ color: CASA_BRAND.colors.primary.amber }} />
            </div>

            {/* Content */}
            <div className="flex-1">
              <h4
                style={{
                  fontFamily: CASA_BRAND.fonts.heading,
                  fontSize: '16px',
                  fontWeight: 600,
                  color: CASA_BRAND.colors.primary.black,
                }}
              >
                Guía del Celebrante
              </h4>
              <p
                className="mt-1"
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '13px',
                  color: CASA_BRAND.colors.secondary.grayDark,
                }}
              >
                PDF con todos los textos, optimizado para iPad o impresión
              </p>

              {/* Download button */}
              <button
                onClick={handleExportCelebrant}
                disabled={exportingCelebrant}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{
                  backgroundColor: celebrantCompleted
                    ? CASA_BRAND.colors.secondary.grayLight
                    : CASA_BRAND.colors.primary.amber,
                  color: celebrantCompleted
                    ? CASA_BRAND.colors.primary.black
                    : CASA_BRAND.colors.primary.white,
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '13px',
                }}
              >
                {exportingCelebrant ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Generando...
                  </>
                ) : celebrantCompleted ? (
                  <>
                    <Check size={16} />
                    Descargado
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    Descargar PDF
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportPanel;
