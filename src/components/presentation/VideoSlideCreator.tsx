/**
 * VideoSlideCreator - Formulario para crear slides de video
 * Soporta upload de archivos y URLs de video (YouTube, Vimeo, URLs directas)
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CASA_BRAND } from '@/lib/brand-kit';
import { Video, Upload, X, Loader2, Link, Play, Repeat, VolumeX } from 'lucide-react';
import { validateVideoFile, validateVideoUrl, getYouTubeThumbnail, uploadVideo } from '@/lib/presentation/videoService';
import type { Slide, VideoSettings } from '@/types/shared/slide';

interface VideoSlideCreatorProps {
  onCancel: () => void;
  onCreateSlide: (slide: Slide, insertPosition: 'after' | 'end') => void;
  currentSlideIndex: number;
  totalSlides: number;
}

export const VideoSlideCreator: React.FC<VideoSlideCreatorProps> = ({
  onCancel,
  onCreateSlide,
  currentSlideIndex,
  totalSlides,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [urlValidation, setUrlValidation] = useState<{ valid: boolean; type: string | null; error?: string } | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  // Playback options
  const [autoPlay, setAutoPlay] = useState(true);
  const [loop, setLoop] = useState(false);
  const [muted, setMuted] = useState(false);

  const [insertPosition, setInsertPosition] = useState<'after' | 'end'>('after');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup blob URL when component unmounts or videoPreviewUrl changes
  useEffect(() => {
    return () => {
      if (videoPreviewUrl && videoPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(videoPreviewUrl);
      }
    };
  }, [videoPreviewUrl]);

  // Validate URL as user types (debounced)
  useEffect(() => {
    if (!urlInput.trim()) {
      setUrlValidation(null);
      setThumbnailUrl(null);
      return;
    }

    const timer = setTimeout(() => {
      const validation = validateVideoUrl(urlInput.trim());
      setUrlValidation(validation);

      // Try to get YouTube thumbnail
      if (validation.valid && validation.type === 'youtube') {
        const thumb = getYouTubeThumbnail(urlInput.trim());
        setThumbnailUrl(thumb);
      } else {
        setThumbnailUrl(null);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [urlInput]);

  const handleFile = useCallback((file: File) => {
    setError(null);

    const validation = validateVideoFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Archivo no válido');
      return;
    }

    // Revoke previous URL if exists
    if (videoPreviewUrl && videoPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(videoPreviewUrl);
    }

    // Create blob URL for preview
    const url = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoPreviewUrl(url);
  }, [videoPreviewUrl]);

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

  const handleClearVideo = useCallback(() => {
    if (videoPreviewUrl && videoPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(videoPreviewUrl);
    }
    setVideoFile(null);
    setVideoPreviewUrl(null);
    setError(null);
  }, [videoPreviewUrl]);

  const handleCreate = useCallback(async () => {
    if (isCreating) return;

    setIsCreating(true);
    setError(null);

    let finalVideoUrl: string | null = null;

    try {
      if (activeTab === 'upload' && videoFile) {
        // Upload the video file
        setIsUploading(true);
        try {
          finalVideoUrl = await uploadVideo(videoFile);
        } catch (uploadError) {
          console.warn('Supabase upload failed:', uploadError);

          // For small files (<5MB), use data URL as fallback for local dev
          // For larger files, fail gracefully - data URLs cause memory issues
          const MAX_LOCAL_SIZE = 5 * 1024 * 1024; // 5MB
          if (videoFile.size <= MAX_LOCAL_SIZE) {
            const response = await fetch(videoPreviewUrl!);
            const blob = await response.blob();
            finalVideoUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          } else {
            throw new Error(
              'No se pudo subir el video al servidor. Para videos mayores a 5MB, configure el almacenamiento de Supabase.'
            );
          }
        }
        setIsUploading(false);
      } else if (activeTab === 'url' && urlValidation?.valid) {
        finalVideoUrl = urlInput.trim();
      }

      if (!finalVideoUrl) {
        setError('No se pudo procesar el video');
        setIsCreating(false);
        return;
      }

      const videoSettings: VideoSettings = {
        autoPlay,
        loop,
        muted,
      };

      const slide: Slide = {
        id: `temp-video-${Date.now()}`,
        type: 'video',
        content: {
          primary: '',
          videoUrl: finalVideoUrl,
          videoSettings,
        },
        style: {
          backgroundColor: '#000000',
        },
        metadata: {
          sourceComponent: 'quick-add-video',
          sourceId: `temp-${Date.now()}`,
          order: 0,
          groupTotal: 1,
        },
      };

      // Cleanup blob URL since we've uploaded or converted
      if (videoPreviewUrl && videoPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(videoPreviewUrl);
      }

      onCreateSlide(slide, insertPosition);
    } catch (err) {
      console.error('Error creating video slide:', err);
      setError(err instanceof Error ? err.message : 'Error al crear slide de video');
    } finally {
      setIsCreating(false);
      setIsUploading(false);
    }
  }, [
    activeTab,
    videoFile,
    videoPreviewUrl,
    urlInput,
    urlValidation,
    autoPlay,
    loop,
    muted,
    insertPosition,
    onCreateSlide,
    isCreating,
  ]);

  const hasValidVideo =
    (activeTab === 'upload' && videoFile) ||
    (activeTab === 'url' && urlValidation?.valid);

  return (
    <div className="space-y-4 p-4">
      {/* Tabs for Upload / URL */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'upload' | 'url')}>
        <TabsList className="grid w-full grid-cols-2" style={{ backgroundColor: CASA_BRAND.colors.primary.black }}>
          <TabsTrigger
            value="upload"
            className="data-[state=active]:bg-amber-600/20"
            style={{ fontFamily: CASA_BRAND.fonts.body }}
          >
            <Upload size={16} className="mr-2" />
            Subir Archivo
          </TabsTrigger>
          <TabsTrigger
            value="url"
            className="data-[state=active]:bg-amber-600/20"
            style={{ fontFamily: CASA_BRAND.fonts.body }}
          >
            <Link size={16} className="mr-2" />
            URL
          </TabsTrigger>
        </TabsList>

        {/* Upload Tab */}
        <TabsContent value="upload" className="mt-4">
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
            onClick={() => !videoFile && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
              onChange={handleFileSelect}
              className="hidden"
            />

            {videoPreviewUrl ? (
              <div className="relative">
                <video
                  src={videoPreviewUrl}
                  className="w-full h-40 object-contain rounded-lg bg-black"
                  controls={false}
                  muted
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClearVideo();
                  }}
                  className="absolute top-2 right-2 p-1 rounded-full"
                  style={{
                    backgroundColor: CASA_BRAND.colors.primary.black + 'CC',
                  }}
                  aria-label="Eliminar video"
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
                  {videoFile?.name}
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
                  Arrastra un video aquí
                  <br />
                  <span style={{ fontSize: '12px' }}>o haz clic para seleccionar</span>
                  <br />
                  <span style={{ fontSize: '11px', color: CASA_BRAND.colors.secondary.grayDark }}>
                    MP4, WebM, MOV (máx. 100MB)
                  </span>
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* URL Tab */}
        <TabsContent value="url" className="mt-4 space-y-3">
          <div className="space-y-2">
            <Label
              htmlFor="videoUrl"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                color: CASA_BRAND.colors.primary.white,
              }}
            >
              URL del Video
            </Label>
            <Input
              id="videoUrl"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=... o URL directa"
              style={{
                backgroundColor: CASA_BRAND.colors.primary.black,
                borderColor: urlValidation?.valid === false
                  ? '#ef4444'
                  : urlValidation?.valid
                  ? '#22c55e'
                  : CASA_BRAND.colors.secondary.grayDark,
                color: CASA_BRAND.colors.primary.white,
              }}
            />
            {urlValidation && (
              <p
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '12px',
                  color: urlValidation.valid ? '#22c55e' : '#ef4444',
                }}
              >
                {urlValidation.valid
                  ? `Video ${urlValidation.type === 'youtube' ? 'de YouTube' : urlValidation.type === 'vimeo' ? 'de Vimeo' : 'directo'} detectado`
                  : urlValidation.error}
              </p>
            )}
          </div>

          {/* YouTube Thumbnail Preview */}
          {thumbnailUrl && (
            <div className="relative rounded-lg overflow-hidden bg-black">
              <img
                src={thumbnailUrl}
                alt="Video thumbnail"
                className="w-full h-32 object-cover"
                onError={() => setThumbnailUrl(null)}
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: CASA_BRAND.colors.primary.amber }}
                >
                  <Play size={24} fill={CASA_BRAND.colors.primary.black} style={{ color: CASA_BRAND.colors.primary.black }} />
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

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

      {/* Playback Options */}
      <div className="space-y-3 pt-2">
        <Label
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            color: CASA_BRAND.colors.primary.white,
            fontWeight: 600,
          }}
        >
          Opciones de Reproducción
        </Label>

        <div className="grid grid-cols-3 gap-3">
          <div
            className="flex items-center gap-2 p-2 rounded-lg"
            style={{ backgroundColor: CASA_BRAND.colors.primary.black }}
          >
            <Switch
              id="autoplay"
              checked={autoPlay}
              onCheckedChange={setAutoPlay}
            />
            <Label
              htmlFor="autoplay"
              className="flex items-center gap-1 cursor-pointer"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '12px',
                color: CASA_BRAND.colors.secondary.grayLight,
              }}
            >
              <Play size={14} />
              Auto
            </Label>
          </div>

          <div
            className="flex items-center gap-2 p-2 rounded-lg"
            style={{ backgroundColor: CASA_BRAND.colors.primary.black }}
          >
            <Switch
              id="loop"
              checked={loop}
              onCheckedChange={setLoop}
            />
            <Label
              htmlFor="loop"
              className="flex items-center gap-1 cursor-pointer"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '12px',
                color: CASA_BRAND.colors.secondary.grayLight,
              }}
            >
              <Repeat size={14} />
              Repetir
            </Label>
          </div>

          <div
            className="flex items-center gap-2 p-2 rounded-lg"
            style={{ backgroundColor: CASA_BRAND.colors.primary.black }}
          >
            <Switch
              id="muted"
              checked={muted}
              onCheckedChange={setMuted}
            />
            <Label
              htmlFor="muted"
              className="flex items-center gap-1 cursor-pointer"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '12px',
                color: CASA_BRAND.colors.secondary.grayLight,
              }}
            >
              <VolumeX size={14} />
              Mudo
            </Label>
          </div>
        </div>
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
            <RadioGroupItem value="after" id="after-vid" />
            <Label
              htmlFor="after-vid"
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
            <RadioGroupItem value="end" id="end-vid" />
            <Label
              htmlFor="end-vid"
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
          disabled={!hasValidVideo || isCreating}
          className="gap-2"
          style={{
            backgroundColor: CASA_BRAND.colors.primary.amber,
            color: CASA_BRAND.colors.primary.black,
          }}
          aria-label="Agregar video"
        >
          {isCreating ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Video size={16} />
          )}
          {isUploading ? 'Subiendo...' : isCreating ? 'Procesando...' : 'Agregar Video'}
        </Button>
      </div>
    </div>
  );
};

export default VideoSlideCreator;
