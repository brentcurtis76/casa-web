/**
 * ImageSlideCreator - Form for creating image slides
 * Supports drag & drop and file picker with optional text overlay
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CASA_BRAND } from '@/lib/brand-kit';
import { Image, Upload, X, Loader2 } from 'lucide-react';
import type { Slide } from '@/types/shared/slide';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface ImageSlideCreatorProps {
  onCancel: () => void;
  onCreateSlide: (slide: Slide, insertPosition: 'after' | 'end') => void;
  currentSlideIndex: number;
  totalSlides: number;
}

export const ImageSlideCreator: React.FC<ImageSlideCreatorProps> = ({
  onCancel,
  onCreateSlide,
  currentSlideIndex,
  totalSlides,
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string>('');
  const [overlayText, setOverlayText] = useState('');
  const [insertPosition, setInsertPosition] = useState<'after' | 'end'>('after');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup blob URL when component unmounts or imageUrl changes
  useEffect(() => {
    return () => {
      if (imageUrl && imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  const handleFile = useCallback((file: File) => {
    // Clear previous error
    setError(null);

    if (!file.type.startsWith('image/')) {
      setError('Por favor selecciona un archivo de imagen');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('La imagen es demasiado grande. Máximo 10MB.');
      return;
    }

    // Revoke previous URL if exists
    if (imageUrl && imageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imageUrl);
    }

    // Create blob URL for preview
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setImageName(file.name);
  }, [imageUrl]);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleClearImage = useCallback(() => {
    if (imageUrl && imageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imageUrl);
    }
    setImageUrl(null);
    setImageName('');
    setError(null);
  }, [imageUrl]);

  const handleImageError = useCallback(() => {
    setError('No se pudo cargar la imagen');
    handleClearImage();
  }, [handleClearImage]);

  const handleCreate = useCallback(async () => {
    if (!imageUrl || isCreating) return;

    setIsCreating(true);

    // Convert blob URL to data URL for persistence
    let finalImageUrl = imageUrl;
    try {
      if (imageUrl.startsWith('blob:')) {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        finalImageUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        // Now safe to revoke the blob URL
        URL.revokeObjectURL(imageUrl);
      }
    } catch (err) {
      console.error('Failed to convert image to data URL:', err);
      // Fall back to blob URL if conversion fails
    }

    const slide: Slide = {
      id: `temp-image-${Date.now()}`,
      type: 'announcement-image',
      content: {
        primary: overlayText.trim() || '',
        imageUrl: finalImageUrl,
      },
      style: {
        backgroundColor: '#000000',
        primaryColor: CASA_BRAND.colors.primary.white,
        primaryFont: CASA_BRAND.fonts.body,
      },
      metadata: {
        sourceComponent: 'quick-add-image',
        sourceId: `temp-${Date.now()}`,
        order: 0,
        groupTotal: 1,
      },
    };

    setIsCreating(false);
    onCreateSlide(slide, insertPosition);
  }, [imageUrl, overlayText, insertPosition, onCreateSlide, isCreating]);

  return (
    <div className="space-y-4 p-4">
      {/* Drop zone / Preview */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className="relative rounded-lg transition-all cursor-pointer"
        style={{
          backgroundColor: isDragging
            ? CASA_BRAND.colors.primary.amber + '20'
            : CASA_BRAND.colors.primary.black,
          border: `2px dashed ${
            isDragging
              ? CASA_BRAND.colors.primary.amber
              : error
              ? '#ef4444'
              : CASA_BRAND.colors.secondary.grayDark
          }`,
          minHeight: '160px',
        }}
        onClick={() => !imageUrl && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {imageUrl ? (
          <div className="relative">
            <img
              src={imageUrl}
              alt={imageName}
              className="w-full h-40 object-contain rounded-lg"
              onError={handleImageError}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClearImage();
              }}
              className="absolute top-2 right-2 p-1 rounded-full"
              style={{
                backgroundColor: CASA_BRAND.colors.primary.black + 'CC',
              }}
              aria-label="Eliminar imagen"
            >
              <X size={16} style={{ color: CASA_BRAND.colors.primary.white }} />
            </button>
            <p
              className="text-center mt-2 truncate px-2"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '12px',
                color: CASA_BRAND.colors.secondary.grayMedium,
              }}
            >
              {imageName}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <Upload
              size={32}
              style={{
                color: isDragging
                  ? CASA_BRAND.colors.primary.amber
                  : CASA_BRAND.colors.secondary.grayMedium,
              }}
            />
            <p
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '14px',
                color: CASA_BRAND.colors.secondary.grayMedium,
                textAlign: 'center',
              }}
            >
              Arrastra una imagen aquí
              <br />
              <span style={{ fontSize: '12px' }}>o haz clic para seleccionar</span>
            </p>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '13px',
            color: '#ef4444',
          }}
        >
          {error}
        </p>
      )}

      {/* Overlay text (optional) */}
      <div className="space-y-2">
        <Label
          htmlFor="overlay"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            color: CASA_BRAND.colors.primary.white,
          }}
        >
          Texto superpuesto (opcional)
        </Label>
        <Input
          id="overlay"
          value={overlayText}
          onChange={(e) => setOverlayText(e.target.value)}
          placeholder="Texto que aparece sobre la imagen"
          style={{
            backgroundColor: CASA_BRAND.colors.primary.black,
            borderColor: CASA_BRAND.colors.secondary.grayDark,
            color: CASA_BRAND.colors.primary.white,
          }}
        />
      </div>

      {/* Insert position */}
      <div className="space-y-2">
        <Label
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            color: CASA_BRAND.colors.primary.white,
          }}
        >
          Insertar
        </Label>
        <RadioGroup
          value={insertPosition}
          onValueChange={(v) => setInsertPosition(v as 'after' | 'end')}
          className="flex gap-4"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="after" id="after-img" />
            <Label
              htmlFor="after-img"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                color: CASA_BRAND.colors.secondary.grayLight,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Después de slide {currentSlideIndex + 1}
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="end" id="end-img" />
            <Label
              htmlFor="end-img"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                color: CASA_BRAND.colors.secondary.grayLight,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Al final ({totalSlides})
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          onClick={handleCreate}
          disabled={!imageUrl || isCreating}
          className="gap-2"
          style={{
            backgroundColor: CASA_BRAND.colors.primary.amber,
            color: CASA_BRAND.colors.primary.black,
          }}
          aria-label="Agregar imagen"
        >
          {isCreating ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Image size={16} />
          )}
          {isCreating ? 'Procesando...' : 'Agregar'}
        </Button>
      </div>
    </div>
  );
};

export default ImageSlideCreator;
