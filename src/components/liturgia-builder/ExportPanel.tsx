/**
 * ExportPanel - Panel de exportación para liturgias
 * Permite exportar a múltiples formatos: PPTX, Google Slides, Keynote, PDF
 */

import React, { useState } from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import {
  Download,
  FileText,
  Presentation,
  Loader2,
  Check,
  ExternalLink,
  Apple,
  BookOpen,
} from 'lucide-react';
import type { LiturgyElement, LiturgyElementType, LiturgyContext } from '@/types/shared/liturgy';
import { exportLiturgy } from '@/lib/liturgia/exportService';

// Google Slides icon component
const GoogleSlidesIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#FBBC04" />
    <rect x="6" y="9" width="12" height="6" rx="1" fill="white" />
  </svg>
);

interface ExportPanelProps {
  elements: Map<LiturgyElementType, LiturgyElement>;
  elementOrder: LiturgyElementType[];
  liturgyContext: LiturgyContext | null;
  onExportComplete?: (format: string) => void;
}

type ExportFormat = 'pptx' | 'google-slides' | 'keynote' | 'pdf-projection' | 'pdf-celebrant';

interface ExportOption {
  id: ExportFormat;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    id: 'google-slides',
    title: 'Google Slides',
    description: 'Exportar PPTX para abrir en Google Drive',
    icon: <GoogleSlidesIcon />,
    color: '#FBBC04',
  },
  {
    id: 'pptx',
    title: 'PowerPoint',
    description: 'Descargar archivo .pptx',
    icon: <Presentation size={24} />,
    color: '#D24726',
  },
  {
    id: 'keynote',
    title: 'Keynote',
    description: 'Compatible con Keynote (Mac)',
    icon: <Apple size={24} />,
    color: '#007AFF',
  },
  {
    id: 'pdf-projection',
    title: 'PDF Proyección',
    description: 'Todos los slides para proyectar',
    icon: <FileText size={24} />,
    color: '#E53935',
  },
  {
    id: 'pdf-celebrant',
    title: 'Guía del Celebrante',
    description: 'PDF con textos para iPad/impreso',
    icon: <BookOpen size={24} />,
    color: CASA_BRAND.colors.primary.amber,
  },
];

const ExportPanel: React.FC<ExportPanelProps> = ({
  elements,
  elementOrder,
  liturgyContext,
  onExportComplete,
}) => {
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const [completedFormats, setCompletedFormats] = useState<Set<ExportFormat>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Count slides
  const totalSlides = elementOrder.reduce((count, type) => {
    const element = elements.get(type);
    const slides = element?.slides?.slides || element?.editedSlides?.slides || [];
    return count + slides.length;
  }, 0);

  // Handle export
  const handleExport = async (format: ExportFormat) => {
    setExportingFormat(format);
    setError(null);

    try {
      await exportLiturgy({
        format,
        elements,
        elementOrder,
        liturgyContext,
      });

      setCompletedFormats((prev) => new Set(prev).add(format));
      onExportComplete?.(format);

      // Show instructions for Google Slides
      if (format === 'google-slides') {
        // The PPTX will be downloaded, user needs to upload to Drive
        alert('El archivo PPTX ha sido descargado. Para usar en Google Slides:\n\n1. Ve a drive.google.com\n2. Arrastra el archivo descargado\n3. Haz clic derecho → "Abrir con" → "Google Slides"');
      }
    } catch (err) {
      console.error('Export error:', err);
      setError(err instanceof Error ? err.message : 'Error al exportar');
    } finally {
      setExportingFormat(null);
    }
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
      {/* Header */}
      <div className="text-center pb-6 border-b" style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}>
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: `${CASA_BRAND.colors.primary.amber}20` }}
        >
          <Download size={28} style={{ color: CASA_BRAND.colors.primary.amber }} />
        </div>
        <h2
          style={{
            fontFamily: CASA_BRAND.fonts.heading,
            fontSize: '24px',
            fontWeight: 300,
            color: CASA_BRAND.colors.primary.black,
            letterSpacing: '0.05em',
          }}
        >
          Exportar Liturgia
        </h2>
        <p
          className="mt-2"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
            color: CASA_BRAND.colors.secondary.grayMedium,
          }}
        >
          {liturgyTitle}
          {liturgyDate && ` • ${liturgyDate}`}
        </p>
        <p
          className="mt-1"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '13px',
            color: CASA_BRAND.colors.secondary.grayMedium,
          }}
        >
          {totalSlides} slides en total
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

      {/* Export Options Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {EXPORT_OPTIONS.map((option) => {
          const isExporting = exportingFormat === option.id;
          const isCompleted = completedFormats.has(option.id);

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handleExport(option.id)}
              disabled={isExporting || exportingFormat !== null}
              className={`p-6 rounded-xl border-2 text-center transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                isCompleted ? 'border-amber-400' : 'border-transparent'
              }`}
              style={{
                backgroundColor: CASA_BRAND.colors.primary.white,
                borderColor: isCompleted ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.secondary.grayLight,
              }}
            >
              {/* Icon */}
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{
                  backgroundColor: `${option.color}15`,
                  color: option.color,
                }}
              >
                {isExporting ? (
                  <Loader2 size={24} className="animate-spin" />
                ) : isCompleted ? (
                  <Check size={24} style={{ color: CASA_BRAND.colors.primary.amber }} />
                ) : (
                  option.icon
                )}
              </div>

              {/* Title */}
              <h3
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '15px',
                  fontWeight: 600,
                  color: CASA_BRAND.colors.primary.black,
                }}
              >
                {option.title}
              </h3>

              {/* Description */}
              <p
                className="mt-1"
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '12px',
                  color: CASA_BRAND.colors.secondary.grayMedium,
                }}
              >
                {isExporting ? 'Exportando...' : option.description}
              </p>

              {/* Completed indicator */}
              {isCompleted && (
                <p
                  className="mt-2 text-xs"
                  style={{ color: CASA_BRAND.colors.primary.amber }}
                >
                  ✓ Descargado
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Instructions */}
      <div
        className="p-4 rounded-lg"
        style={{
          backgroundColor: `${CASA_BRAND.colors.primary.amber}10`,
          border: `1px solid ${CASA_BRAND.colors.primary.amber}30`,
        }}
      >
        <h4
          className="flex items-center gap-2 mb-2"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
            fontWeight: 600,
            color: CASA_BRAND.colors.primary.black,
          }}
        >
          <ExternalLink size={16} style={{ color: CASA_BRAND.colors.primary.amber }} />
          Instrucciones
        </h4>
        <ul
          className="space-y-1 text-sm"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            color: CASA_BRAND.colors.secondary.grayDark,
          }}
        >
          <li>• <strong>Google Slides / Keynote:</strong> Descarga el PPTX y ábrelo en la aplicación deseada</li>
          <li>• <strong>PDF Proyección:</strong> Contiene todos los slides para proyectar</li>
          <li>• <strong>Guía del Celebrante:</strong> Documento con textos para leer, optimizado para iPad</li>
        </ul>
      </div>
    </div>
  );
};

export default ExportPanel;
