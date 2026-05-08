/**
 * ImageSelector - Componente para seleccionar entre opciones de imágenes generadas
 * Usado tanto para character sheets como para escenas
 */

import React, { useEffect, useState } from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import { Check, RefreshCw, ImageIcon } from 'lucide-react';
import ImageRefineBox from '@/components/shared/ImageRefineBox';

interface ImageSelectorProps {
  title: string;
  subtitle?: string;
  imageOptions: string[];
  selectedImageUrl: string | null;
  onSelect: (imageUrl: string) => void;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
  onRefine?: (sourceImage: string, feedback: string) => Promise<void>;
  isRefining?: boolean;
  refineError?: string | null;
}

const ImageSelector: React.FC<ImageSelectorProps> = ({
  title,
  subtitle,
  imageOptions,
  selectedImageUrl,
  onSelect,
  onRegenerate,
  isRegenerating = false,
  onRefine,
  isRefining,
  refineError,
}) => {
  // Track the selected slot by index so the selection survives a parent that
  // swaps the image at the selected index in place (e.g. after a refine).
  const [selectedIdx, setSelectedIdx] = useState<number>(() =>
    selectedImageUrl ? imageOptions.indexOf(selectedImageUrl) : -1
  );

  useEffect(() => {
    if (selectedImageUrl == null) {
      setSelectedIdx(-1);
      return;
    }
    const idx = imageOptions.indexOf(selectedImageUrl);
    // Only sync when the URL maps to a known slot; if the parent swapped the
    // image in place, the URL won't match — keep the previous index.
    if (idx >= 0 && idx !== selectedIdx) {
      setSelectedIdx(idx);
    }
  }, [selectedImageUrl, imageOptions, selectedIdx]);

  const selectedImageBase64 =
    selectedIdx >= 0 && selectedIdx < imageOptions.length
      ? imageOptions[selectedIdx]
      : selectedImageUrl;

  const refining = !!isRefining;
  const showRefineBox = !!onRefine && selectedImageBase64 != null;

  return (
    <div
      className="p-4 rounded-lg border"
      style={{
        borderColor: selectedImageUrl
          ? CASA_BRAND.colors.primary.amber
          : CASA_BRAND.colors.secondary.grayLight,
        backgroundColor: CASA_BRAND.colors.primary.white,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              fontWeight: 600,
              color: CASA_BRAND.colors.primary.black,
            }}
          >
            {title}
          </h4>
          {subtitle && (
            <p
              className="mt-1"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '12px',
                color: CASA_BRAND.colors.secondary.grayMedium,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {onRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            disabled={isRegenerating || refining}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm transition-colors hover:bg-amber-50 disabled:opacity-50"
            style={{
              color: CASA_BRAND.colors.primary.amber,
              fontFamily: CASA_BRAND.fonts.body,
            }}
          >
            <RefreshCw
              size={14}
              className={isRegenerating ? 'animate-spin' : ''}
            />
            Regenerar
          </button>
        )}
      </div>

      {/* Grid de opciones */}
      {imageOptions.length > 0 ? (
        <div
          className={`grid grid-cols-2 md:grid-cols-4 gap-3 ${
            refining ? 'opacity-60 pointer-events-none' : ''
          }`}
          aria-disabled={refining || undefined}
        >
          {imageOptions.map((imageUrl, index) => {
            const isSelected = index === selectedIdx;

            return (
              <button
                key={index}
                type="button"
                disabled={refining}
                onClick={() => {
                  setSelectedIdx(index);
                  onSelect(imageUrl);
                }}
                className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:shadow-md ${
                  isSelected ? 'ring-2 ring-offset-2' : ''
                }`}
                style={{
                  borderColor: isSelected
                    ? CASA_BRAND.colors.primary.amber
                    : 'transparent',
                  ringColor: CASA_BRAND.colors.primary.amber,
                }}
              >
                <img
                  src={imageUrl}
                  alt={`Opción ${index + 1}`}
                  className="w-full h-full object-cover"
                />

                {/* Indicador de selección */}
                {isSelected && (
                  <div
                    className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: CASA_BRAND.colors.primary.amber }}
                  >
                    <Check size={14} color="white" strokeWidth={3} />
                  </div>
                )}

                {/* Número de opción */}
                <div
                  className="absolute bottom-2 left-2 px-2 py-0.5 rounded text-xs font-medium"
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    color: 'white',
                    fontFamily: CASA_BRAND.fonts.body,
                  }}
                >
                  {index + 1}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        // Placeholder cuando no hay imágenes
        <div
          className="flex flex-col items-center justify-center py-8 rounded-lg border-2 border-dashed"
          style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
        >
          <ImageIcon
            size={32}
            style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
          />
          <p
            className="mt-2"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              color: CASA_BRAND.colors.secondary.grayMedium,
            }}
          >
            {isRegenerating ? 'Generando imágenes...' : 'Sin imágenes disponibles'}
          </p>
        </div>
      )}

      {/* Estado de selección */}
      {imageOptions.length > 0 && (
        <p
          className="mt-3 text-sm"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            color: selectedImageUrl
              ? CASA_BRAND.colors.primary.amber
              : CASA_BRAND.colors.secondary.grayMedium,
          }}
        >
          {selectedImageUrl
            ? '✓ Imagen seleccionada'
            : 'Haz clic en una imagen para seleccionarla'}
        </p>
      )}

      {showRefineBox && (
        <div className="mt-4">
          <ImageRefineBox
            onRefine={(feedback) => onRefine!(selectedImageBase64!, feedback)}
            isRefining={isRefining ?? false}
            refineError={refineError}
          />
        </div>
      )}
    </div>
  );
};

export default ImageSelector;
