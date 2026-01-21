/**
 * CoverArtGenerator - AI-powered cover art generation with text overlay
 * PROMPT_005: Cover Art & Metadata
 *
 * Features:
 * - Generate AI background via existing generate-illustration edge function
 * - Add text overlay (sermon title + preacher name) using Canvas API
 * - 1400x1400 output (Spotify requirement)
 * - Regenerate option for new variations
 * - Custom image upload with crop tool
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Upload,
  Check,
  X,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CoverCropTool } from './CoverCropTool';
import type { SermonMetadata } from './MetadataForm';

// Spotify cover art requirements
const COVER_SIZE = 1400;

interface CoverArtGeneratorProps {
  metadata: SermonMetadata;
  coverImage: Blob | null;
  onCoverChange: (cover: Blob | null) => void;
  disabled?: boolean;
}

// Brand-consistent toast styles
const toastStyles = {
  success: {
    style: {
      background: '#292524',
      color: '#fef3c7',
      border: '1px solid #D97706',
    },
  },
  error: {
    style: {
      background: '#292524',
      color: '#fef3c7',
      border: '1px solid #dc2626',
    },
  },
};

/**
 * Load an image from a Blob
 * Note: Object URLs are revoked after image loads to prevent memory leaks
 */
function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

/**
 * Word wrap text for canvas
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Add text overlay to background image
 */
async function addTextOverlay(
  backgroundImage: Blob,
  title: string,
  speaker: string
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = COVER_SIZE;
  canvas.height = COVER_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create canvas context');

  // Draw background image
  const img = await loadImage(backgroundImage);
  ctx.drawImage(img, 0, 0, COVER_SIZE, COVER_SIZE);

  // Add semi-transparent overlay at bottom for text readability
  const gradient = ctx.createLinearGradient(0, COVER_SIZE * 0.65, 0, COVER_SIZE);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(0.3, 'rgba(0, 0, 0, 0.4)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.75)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, COVER_SIZE * 0.65, COVER_SIZE, COVER_SIZE * 0.35);

  // Set up text rendering
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Draw sermon title (large, bold)
  ctx.font = 'bold 72px "Georgia", serif';
  ctx.fillStyle = '#FFFFFF';

  // Word wrap title if needed
  const titleLines = wrapText(ctx, title, COVER_SIZE - 100);
  const lineHeight = 80;
  const titleStartY = COVER_SIZE - 180 - (titleLines.length - 1) * lineHeight / 2;

  // Add text shadow for better readability
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  titleLines.forEach((line, i) => {
    ctx.fillText(line, COVER_SIZE / 2, titleStartY + i * lineHeight);
  });

  // Draw preacher name (smaller, amber color)
  ctx.font = '48px "Georgia", serif';
  ctx.fillStyle = '#D4A03E'; // Brand amber
  ctx.shadowBlur = 4;
  const speakerY = titleStartY + titleLines.length * lineHeight + 20;
  ctx.fillText(speaker, COVER_SIZE / 2, speakerY);

  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create cover image'));
        }
      },
      'image/jpeg',
      0.9
    );
  });
}

/**
 * Generate AI background prompt based on illustration theme
 * Uses same style as Portadas in liturgia-builder (Matisse/Picasso)
 */
function generateBackgroundPrompt(illustrationTheme: string, fallbackTitle: string): string {
  const themeDescription = illustrationTheme.trim() || fallbackTitle;

  return `Minimalist line art illustration with PURE WHITE (#FFFFFF) solid flat background, no texture, no pattern, no gradients. Single continuous gray (#666666) line drawing in the style of Henri Matisse or Pablo Picasso one-line art. Subject: ${themeDescription}. Abstract and contemplative, suggestive of spiritual reflection. No text, no labels, no words. Elegant flowing lines with amber/gold (#D4A853) accent on 20-30% of the illustration.`;
}

export function CoverArtGenerator({
  metadata,
  coverImage,
  onCoverChange,
  disabled = false,
}: CoverArtGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [backgroundOptions, setBackgroundOptions] = useState<string[]>([]);
  const [selectedBackground, setSelectedBackground] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showCropTool, setShowCropTool] = useState(false);
  const [customImageFile, setCustomImageFile] = useState<File | null>(null);
  const [illustrationTheme, setIllustrationTheme] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update preview when cover image changes (handles cleanup via return statement)
  useEffect(() => {
    if (coverImage) {
      const url = URL.createObjectURL(coverImage);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [coverImage]);

  // Generate AI backgrounds
  const generateBackgrounds = useCallback(async () => {
    if (!metadata.title) {
      toast.error('Ingresa un título para generar la portada', toastStyles.error);
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(10);
    setBackgroundOptions([]);
    setSelectedBackground(null);

    try {
      const prompt = generateBackgroundPrompt(illustrationTheme, metadata.title);
      setGenerationProgress(20);

      const { data, error } = await supabase.functions.invoke('generate-illustration', {
        body: {
          eventType: 'culto_dominical',
          count: 4,
          customPrompt: prompt,
        },
      });

      setGenerationProgress(80);

      if (error) throw error;

      // Filter valid illustrations
      const validIllustrations = (data.illustrations || []).filter(
        (i: string) => i && i.length > 0
      );

      if (validIllustrations.length === 0) {
        throw new Error('No se pudieron generar ilustraciones');
      }

      setBackgroundOptions(validIllustrations);
      setGenerationProgress(100);

      toast.success(
        `${validIllustrations.length} fondos generados. Selecciona uno.`,
        toastStyles.success
      );
    } catch (err) {
      console.error('Error generating backgrounds:', err);
      toast.error(
        err instanceof Error ? err.message : 'Error al generar fondos',
        toastStyles.error
      );
    } finally {
      setIsGenerating(false);
    }
  }, [metadata, illustrationTheme]);

  // Select a background and apply text overlay
  const selectBackground = useCallback(async (base64: string) => {
    if (!metadata.title || !metadata.speaker) {
      toast.error('Completa el título y predicador antes de generar la portada', toastStyles.error);
      return;
    }

    setSelectedBackground(base64);
    setIsGenerating(true);

    try {
      // Convert base64 to blob
      const response = await fetch(`data:image/png;base64,${base64}`);
      const backgroundBlob = await response.blob();

      // Resize to 1400x1400 first
      const resizedBlob = await resizeImage(backgroundBlob, COVER_SIZE, COVER_SIZE);

      // Add text overlay
      const coverWithText = await addTextOverlay(
        resizedBlob,
        metadata.title,
        metadata.speaker
      );

      onCoverChange(coverWithText);
      toast.success('Portada generada con éxito', toastStyles.success);
    } catch (err) {
      console.error('Error creating cover:', err);
      toast.error('Error al crear la portada', toastStyles.error);
    } finally {
      setIsGenerating(false);
    }
  }, [metadata, onCoverChange]);

  // Handle custom image upload
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona un archivo de imagen', toastStyles.error);
      return;
    }

    setCustomImageFile(file);
    setShowCropTool(true);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Handle cropped image from crop tool
  const handleCroppedImage = useCallback(async (croppedBlob: Blob) => {
    if (!metadata.title || !metadata.speaker) {
      toast.error('Completa el título y predicador antes de usar la imagen', toastStyles.error);
      setShowCropTool(false);
      return;
    }

    setShowCropTool(false);
    setIsGenerating(true);

    try {
      // Add text overlay to cropped image
      const coverWithText = await addTextOverlay(
        croppedBlob,
        metadata.title,
        metadata.speaker
      );

      onCoverChange(coverWithText);
      setSelectedBackground(null);
      setBackgroundOptions([]);
      toast.success('Portada personalizada creada', toastStyles.success);
    } catch (err) {
      console.error('Error creating custom cover:', err);
      toast.error('Error al crear la portada personalizada', toastStyles.error);
    } finally {
      setIsGenerating(false);
      setCustomImageFile(null);
    }
  }, [metadata, onCoverChange]);

  // Clear cover image
  const clearCover = useCallback(() => {
    onCoverChange(null);
    setSelectedBackground(null);
    setBackgroundOptions([]);
  }, [onCoverChange]);

  // Check if metadata is complete for cover generation
  const canGenerate = metadata.title && metadata.speaker && !disabled;

  return (
    <div className="space-y-4">
      {/* Crop Tool Modal */}
      {showCropTool && customImageFile && (
        <CoverCropTool
          file={customImageFile}
          onCrop={handleCroppedImage}
          onCancel={() => {
            setShowCropTool(false);
            setCustomImageFile(null);
          }}
          targetSize={COVER_SIZE}
        />
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileSelect}
        onClick={(e) => e.stopPropagation()}
        className="hidden"
      />

      {/* Cover Preview */}
      <div className="relative aspect-square w-full max-w-[280px] mx-auto rounded-lg overflow-hidden bg-muted border-2 border-dashed border-muted-foreground/25">
        {previewUrl ? (
          <>
            <img
              src={previewUrl}
              alt="Cover preview"
              className="w-full h-full object-cover"
            />
            <button
              onClick={clearCover}
              className="absolute top-2 right-2 p-1 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
              title="Eliminar portada"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="absolute bottom-2 left-2 px-2 py-1 rounded text-xs bg-black/60 text-white">
              {COVER_SIZE} x {COVER_SIZE}
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
            <ImageIcon className="h-12 w-12 mb-2 opacity-50" />
            <span className="text-sm">Sin portada</span>
            <span className="text-xs mt-1">{COVER_SIZE} x {COVER_SIZE}</span>
          </div>
        )}

        {isGenerating && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-white animate-spin" />
          </div>
        )}
      </div>

      {/* Generation Progress */}
      {isGenerating && generationProgress > 0 && generationProgress < 100 && (
        <Progress value={generationProgress} className="h-2" />
      )}

      {/* Illustration Theme Input - Simple field like Portadas */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          ¿Qué ilustración quieres?
        </label>
        <input
          type="text"
          value={illustrationTheme}
          onChange={(e) => setIllustrationTheme(e.target.value)}
          placeholder="Ej: pescadores en un bote, manos orando, paloma volando..."
          className="w-full p-3 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500"
          disabled={disabled || isGenerating}
        />
        <p className="text-xs text-muted-foreground">
          Describe en español lo que quieres ver. Deja vacío para usar el título de la reflexión.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-2">
        <Button
          onClick={generateBackgrounds}
          disabled={!canGenerate || isGenerating}
          className="w-full bg-amber-600 hover:bg-amber-700"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generando estilo Matisse/Picasso...
            </>
          ) : backgroundOptions.length > 0 ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerar fondos
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Generar portada IA
            </>
          )}
        </Button>

        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={!canGenerate || isGenerating}
          className="w-full"
        >
          <Upload className="h-4 w-4 mr-2" />
          Subir imagen personalizada
        </Button>
      </div>

      {/* Metadata Warning */}
      {!canGenerate && !disabled && (
        <p className="text-xs text-amber-600 text-center">
          Completa el título y predicador para generar la portada
        </p>
      )}

      {/* Background Options Grid */}
      {backgroundOptions.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground text-center">
            Selecciona un fondo para tu portada:
          </p>
          <div className="grid grid-cols-2 gap-2">
            {backgroundOptions.map((bg, index) => {
              const isSelected = selectedBackground === bg;
              return (
                <button
                  key={index}
                  onClick={() => selectBackground(bg)}
                  disabled={isGenerating}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:shadow-md ${
                    isSelected
                      ? 'border-amber-500 ring-2 ring-amber-500 ring-offset-2'
                      : 'border-transparent'
                  }`}
                >
                  <img
                    src={`data:image/png;base64,${bg}`}
                    alt={`Background option ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                  <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-xs bg-black/60 text-white">
                    {index + 1}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Resize image to target dimensions
 */
async function resizeImage(
  blob: Blob,
  width: number,
  height: number
): Promise<Blob> {
  const img = await loadImage(blob);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create canvas context');

  // Draw image scaled to fill canvas (cover mode)
  const scale = Math.max(width / img.width, height / img.height);
  const scaledWidth = img.width * scale;
  const scaledHeight = img.height * scale;
  const x = (width - scaledWidth) / 2;
  const y = (height - scaledHeight) / 2;

  ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to resize image'));
      },
      'image/jpeg',
      0.9
    );
  });
}
