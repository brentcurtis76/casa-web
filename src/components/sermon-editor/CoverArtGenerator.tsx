/**
 * CoverArtGenerator — Sermon cover with baked-in-text generation
 *
 * Calls Gemini 3 Pro Image Preview (via the generate-illustration edge function)
 * with a JSON prompt that renders the sermon title, preacher name, and CASA
 * logo directly inside the image. No Canvas/React text overlay.
 *
 * Format: 4:3 (1024x768). CASA logo is passed as referenceImage so Gemini uses
 * the real logo rather than inventing one.
 *
 * Custom image upload is still supported (via the crop tool) for users who
 * want to provide a pre-designed cover. That path produces a 1:1 image and
 * does NOT have text overlaid — the uploaded image is saved verbatim.
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
import {
  buildSermonCoverPrompt,
  getCasaLogoAsBase64,
} from '@/lib/covers/coverPromptBuilder';

// Gemini generates at 4:3 (1024x768). The custom-upload path still uses the
// crop tool's single-size square target until the crop tool supports rectangles.
const GEMINI_COVER_WIDTH = 1024;
const GEMINI_COVER_HEIGHT = 768;
const CUSTOM_CROP_SIZE = 1400;

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

export function CoverArtGenerator({
  metadata,
  coverImage,
  onCoverChange,
  disabled = false,
}: CoverArtGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [coverOptions, setCoverOptions] = useState<string[]>([]);
  const [selectedCover, setSelectedCover] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showCropTool, setShowCropTool] = useState(false);
  const [customImageFile, setCustomImageFile] = useState<File | null>(null);
  const [illustrationTheme, setIllustrationTheme] = useState<string>('');
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load CASA logo (passed to Gemini as reference image so the logo renders
  // from the real asset rather than being hallucinated).
  useEffect(() => {
    let cancelled = false;
    getCasaLogoAsBase64()
      .then((b64) => {
        if (!cancelled) setLogoBase64(b64);
      })
      .catch((err) => {
        console.error('[CoverArtGenerator] Failed to load CASA logo:', err);
        if (!cancelled) {
          toast.error(
            'No se pudo cargar el logo CASA. Recarga la página para reintentar.',
            toastStyles.error,
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Update preview when cover image changes
  useEffect(() => {
    if (coverImage) {
      const url = URL.createObjectURL(coverImage);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [coverImage]);

  // Generate 4 variations of the cover via Gemini with title + preacher + logo baked in
  const generateCovers = useCallback(async () => {
    if (!metadata.title || !metadata.speaker) {
      toast.error('Ingresa título y predicador antes de generar', toastStyles.error);
      return;
    }
    if (!logoBase64) {
      toast.error(
        'El logo CASA aún se está cargando. Intenta de nuevo en un momento.',
        toastStyles.error,
      );
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(10);
    setCoverOptions([]);
    setSelectedCover(null);

    try {
      const jsonPrompt = buildSermonCoverPrompt({
        title: metadata.title,
        preacher: metadata.speaker,
        illustrationTheme,
      });
      setGenerationProgress(20);

      const { data, error } = await supabase.functions.invoke('generate-illustration', {
        body: {
          jsonPrompt,
          referenceImage: logoBase64,
          count: 4,
          aspectRatio: '4:3',
        },
      });

      setGenerationProgress(80);

      if (error) throw error;

      const valid = (data.illustrations || []).filter((i: string) => i && i.length > 0);
      if (valid.length === 0) {
        throw new Error('No se pudieron generar portadas');
      }

      setCoverOptions(valid);
      setGenerationProgress(100);

      toast.success(
        `${valid.length} portadas generadas. Selecciona una.`,
        toastStyles.success,
      );
    } catch (err) {
      console.error('Error generating covers:', err);
      toast.error(
        err instanceof Error ? err.message : 'Error al generar portadas',
        toastStyles.error,
      );
    } finally {
      setIsGenerating(false);
    }
  }, [metadata.title, metadata.speaker, illustrationTheme, logoBase64]);

  // Select a baked-in cover — convert base64 to Blob and save directly.
  // Uses a distinct saving flag so the brief "saving" state is separate from
  // the "generating 4 variations" state for both UI affordances and AT.
  const selectCover = useCallback(
    async (base64: string) => {
      setSelectedCover(base64);
      setIsSaving(true);
      try {
        const response = await fetch(`data:image/png;base64,${base64}`);
        const blob = await response.blob();
        onCoverChange(blob);
        toast.success('Portada guardada', toastStyles.success);
      } catch (err) {
        console.error('Error saving cover:', err);
        toast.error('Error al guardar la portada', toastStyles.error);
      } finally {
        setIsSaving(false);
      }
    },
    [onCoverChange],
  );

  // Handle custom image upload
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        toast.error('Por favor selecciona un archivo de imagen', toastStyles.error);
        return;
      }
      setCustomImageFile(file);
      setShowCropTool(true);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [],
  );

  // Handle cropped custom image — save as-is (no text overlay applied)
  const handleCroppedImage = useCallback(
    (croppedBlob: Blob) => {
      setShowCropTool(false);
      setCustomImageFile(null);
      setSelectedCover(null);
      setCoverOptions([]);
      onCoverChange(croppedBlob);
      toast.success('Portada personalizada guardada', toastStyles.success);
    },
    [onCoverChange],
  );

  // Clear cover image
  const clearCover = useCallback(() => {
    onCoverChange(null);
    setSelectedCover(null);
    setCoverOptions([]);
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
          targetSize={CUSTOM_CROP_SIZE}
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

      {/* Screen-reader-only live region for async status */}
      <div className="sr-only" role="status" aria-live="polite">
        {isGenerating
          ? 'Generando portadas con texto y logo integrados'
          : isSaving
            ? 'Guardando portada seleccionada'
            : ''}
      </div>

      {/* Cover Preview — 4:3 frame. Custom uploads (1:1) letterbox inside it. */}
      <div className="relative aspect-[4/3] w-full max-w-[320px] mx-auto rounded-lg overflow-hidden bg-muted border-2 border-dashed border-muted-foreground/25">
        {previewUrl ? (
          <>
            <img
              src={previewUrl}
              alt="Cover preview"
              className="w-full h-full object-contain"
            />
            <button
              onClick={clearCover}
              aria-label="Eliminar portada"
              className="absolute top-2 right-2 p-1 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
              title="Eliminar portada"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="absolute bottom-2 left-2 px-2 py-1 rounded text-xs bg-black/60 text-white">
              {GEMINI_COVER_WIDTH} x {GEMINI_COVER_HEIGHT}
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
            <ImageIcon className="h-12 w-12 mb-2 opacity-50" aria-hidden="true" />
            <span className="text-sm">Sin portada</span>
            <span className="text-xs mt-1">
              {GEMINI_COVER_WIDTH} x {GEMINI_COVER_HEIGHT}
            </span>
          </div>
        )}

        {/* Overlay only during the long-running generation call — not during
            the brief Blob save that follows variation selection. */}
        {isGenerating && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-white animate-spin" aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Generation Progress */}
      {isGenerating && generationProgress > 0 && generationProgress < 100 && (
        <Progress value={generationProgress} className="h-2" />
      )}

      {/* Illustration Theme Input */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          ¿Qué ilustración quieres?
        </label>
        <input
          type="text"
          value={illustrationTheme}
          onChange={(e) => setIllustrationTheme(e.target.value)}
          placeholder="Ej: pescadores en un bote, manos orando, paloma volando..."
          maxLength={200}
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
          onClick={generateCovers}
          disabled={!canGenerate || isGenerating || !logoBase64}
          className="w-full bg-amber-600 hover:bg-amber-700"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generando portadas con texto...
            </>
          ) : coverOptions.length > 0 ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerar portadas
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

      {/* Cover Options Grid */}
      {coverOptions.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground text-center">
            Selecciona una portada:
          </p>
          <div className="grid grid-cols-2 gap-2">
            {coverOptions.map((bg, index) => {
              const isSelected = selectedCover === bg;
              return (
                <button
                  key={index}
                  onClick={() => selectCover(bg)}
                  disabled={isGenerating || isSaving}
                  aria-label={`Seleccionar portada opción ${index + 1}`}
                  aria-pressed={isSelected}
                  className={`relative aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all hover:shadow-md ${
                    isSelected
                      ? 'border-amber-500 ring-2 ring-amber-500 ring-offset-2'
                      : 'border-transparent'
                  }`}
                >
                  <img
                    src={`data:image/png;base64,${bg}`}
                    alt=""
                    aria-hidden="true"
                    className="w-full h-full object-cover"
                  />
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" aria-hidden="true" />
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
