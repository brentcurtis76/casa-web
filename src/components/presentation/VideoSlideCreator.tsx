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
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CASA_BRAND } from '@/lib/brand-kit';
import { Video, Upload, X, Loader2, Link, Play, Repeat, VolumeX, Maximize, Move } from 'lucide-react';
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

  // Size and position options
  const [videoSize, setVideoSize] = useState(100);
  const [videoPosition, setVideoPosition] = useState({ x: 50, y: 50 });
  const [fitMode, setFitMode] = useState<'contain' | 'cover'>('contain');
  const [videoOpacity, setVideoOpacity] = useState(100);
  const [videoRotation, setVideoRotation] = useState(0);

  const [insertPosition, setInsertPosition] = useState<'after' | 'end'>('after');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const slideCreatedRef = useRef(false);

  // Cleanup blob URL when component unmounts
  useEffect(() => {
    return () => {
      if (videoPreviewUrl && videoPreviewUrl.startsWith('blob:') && !slideCreatedRef.current) {
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
        setIsUploading(true);
        try {
          finalVideoUrl = await uploadVideo(videoFile);
        } catch (uploadError) {
          console.warn('Supabase upload failed, using blob URL for local dev:', uploadError);
          finalVideoUrl = videoPreviewUrl!;
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
        size: videoSize,
        position: videoPosition,
        fitMode,
        opacity: videoOpacity,
        rotation: videoRotation,
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

      slideCreatedRef.current = true;
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
    videoSize,
    videoPosition,
    fitMode,
    videoOpacity,
    videoRotation,
    insertPosition,
    onCreateSlide,
    isCreating,
  ]);

  const hasValidVideo =
    (activeTab === 'upload' && videoFile) ||
    (activeTab === 'url' && urlValidation?.valid);

  return (
    <div className="space-y-4 p-4 max-h-[80vh] overflow-y-auto">
      {/* Tabs for Upload / URL */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'upload' | 'url')}>
        <TabsList className="grid w-full grid-cols-2" style={{ backgroundColor: CASA_BRAND.colors.primary.black }}>
          <TabsTrigger
            value="upload"
            className="data-[state=active]:text-black"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              backgroundColor: activeTab === 'upload' ? CASA_BRAND.colors.primary.amber : 'transparent',
              color: activeTab === 'upload' ? CASA_BRAND.colors.primary.black : CASA_BRAND.colors.secondary.grayLight,
            }}
          >
            <Upload size={16} className="mr-2" />
            Subir Archivo
          </TabsTrigger>
          <TabsTrigger
            value="url"
            className="data-[state=active]:text-black"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              backgroundColor: activeTab === 'url' ? CASA_BRAND.colors.primary.amber : 'transparent',
              color: activeTab === 'url' ? CASA_BRAND.colors.primary.black : CASA_BRAND.colors.secondary.grayLight,
            }}
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
            className="relative rounded-lg transition-all cursor-pointer overflow-hidden"
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
              <div
                className="relative w-full overflow-hidden rounded-lg"
                style={{
                  aspectRatio: '4 / 3',
                  backgroundColor: CASA_BRAND.colors.primary.black,
                }}
              >
                <video
                  src={videoPreviewUrl}
                  className="absolute"
                  style={{
                    width: `${videoSize}%`,
                    height: `${videoSize}%`,
                    left: `${videoPosition.x}%`,
                    top: `${videoPosition.y}%`,
                    transform: `translate(-50%, -50%) rotate(${videoRotation}deg)`,
                    objectFit: fitMode,
                    opacity: videoOpacity / 100,
                  }}
                  controls
                  muted={muted}
                  preload="auto"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClearVideo();
                  }}
                  className="absolute top-2 right-2 p-1.5 rounded-full z-20"
                  style={{
                    backgroundColor: CASA_BRAND.colors.secondary.carbon + 'CC',
                  }}
                  aria-label="Eliminar video"
                >
                  <X size={16} style={{ color: CASA_BRAND.colors.primary.white }} />
                </button>
                <p
                  className="absolute bottom-2 left-2 right-2 text-center truncate px-2 py-1 rounded z-20"
                  style={{
                    fontFamily: CASA_BRAND.fonts.body,
                    fontSize: '12px',
                    color: CASA_BRAND.colors.secondary.grayLight,
                    backgroundColor: CASA_BRAND.colors.secondary.carbon + 'CC',
                  }}
                >
                  {videoFile?.name}
                </p>
              </div>
            ) : (
              <div
                className="flex flex-col items-center justify-center gap-2 w-full"
                style={{ aspectRatio: '4 / 3' }}
              >
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
                    MP4, WebM, MOV (máx. 500MB)
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

        <div className="flex flex-wrap gap-2">
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ backgroundColor: CASA_BRAND.colors.primary.black }}
          >
            <Switch
              id="autoplay"
              checked={autoPlay}
              onCheckedChange={setAutoPlay}
              className="border-2"
              style={{
                borderColor: autoPlay ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.secondary.grayMedium,
                backgroundColor: autoPlay ? CASA_BRAND.colors.primary.amber : undefined,
              }}
            />
            <Label
              htmlFor="autoplay"
              className="flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '13px',
                color: CASA_BRAND.colors.primary.white,
              }}
            >
              <Play size={14} />
              Auto
            </Label>
          </div>

          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ backgroundColor: CASA_BRAND.colors.primary.black }}
          >
            <Switch
              id="loop"
              checked={loop}
              onCheckedChange={setLoop}
              className="border-2"
              style={{
                borderColor: loop ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.secondary.grayMedium,
                backgroundColor: loop ? CASA_BRAND.colors.primary.amber : undefined,
              }}
            />
            <Label
              htmlFor="loop"
              className="flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '13px',
                color: CASA_BRAND.colors.primary.white,
              }}
            >
              <Repeat size={14} />
              Repetir
            </Label>
          </div>

          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ backgroundColor: CASA_BRAND.colors.primary.black }}
          >
            <Switch
              id="muted"
              checked={muted}
              onCheckedChange={setMuted}
              className="border-2"
              style={{
                borderColor: muted ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.secondary.grayMedium,
                backgroundColor: muted ? CASA_BRAND.colors.primary.amber : undefined,
              }}
            />
            <Label
              htmlFor="muted"
              className="flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '13px',
                color: CASA_BRAND.colors.primary.white,
              }}
            >
              <VolumeX size={14} />
              Mudo
            </Label>
          </div>
        </div>
      </div>

      {/* Size and Fit Options */}
      <div className="space-y-3 pt-2">
        <Label
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            color: CASA_BRAND.colors.primary.white,
            fontWeight: 600,
          }}
        >
          <Maximize size={14} className="inline mr-2" />
          Tamaño y Ajuste
        </Label>

        {/* Fit Mode Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setFitMode('contain')}
            className="flex-1 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{
              backgroundColor: fitMode === 'contain' ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.primary.black,
              color: fitMode === 'contain' ? CASA_BRAND.colors.primary.black : CASA_BRAND.colors.secondary.grayLight,
              fontFamily: CASA_BRAND.fonts.body,
            }}
          >
            Contener
          </button>
          <button
            onClick={() => setFitMode('cover')}
            className="flex-1 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{
              backgroundColor: fitMode === 'cover' ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.primary.black,
              color: fitMode === 'cover' ? CASA_BRAND.colors.primary.black : CASA_BRAND.colors.secondary.grayLight,
              fontFamily: CASA_BRAND.fonts.body,
            }}
          >
            Cubrir
          </button>
        </div>

        {/* Size Slider */}
        <div>
          <label
            className="text-xs mb-2 block"
            style={{
              color: CASA_BRAND.colors.secondary.grayLight,
              fontFamily: CASA_BRAND.fonts.body,
            }}
          >
            Tamaño: {videoSize}%
          </label>
          <Slider
            value={[videoSize]}
            onValueChange={(v) => setVideoSize(v[0])}
            min={10}
            max={150}
            step={5}
            className="w-full"
            trackClassName="bg-gray-700"
            rangeStyle={{ backgroundColor: CASA_BRAND.colors.primary.amber }}
            thumbStyle={{ borderColor: CASA_BRAND.colors.primary.amber }}
          />
        </div>

        {/* Position presets */}
        <div>
          <label
            className="text-xs mb-2 block"
            style={{
              color: CASA_BRAND.colors.secondary.grayLight,
              fontFamily: CASA_BRAND.fonts.body,
            }}
          >
            <Move size={12} className="inline mr-1" />
            Posición
          </label>
          <div className="grid grid-cols-3 gap-1">
            {[
              { label: '↖', x: 25, y: 25 },
              { label: '↑', x: 50, y: 25 },
              { label: '↗', x: 75, y: 25 },
              { label: '←', x: 25, y: 50 },
              { label: '●', x: 50, y: 50 },
              { label: '→', x: 75, y: 50 },
              { label: '↙', x: 25, y: 75 },
              { label: '↓', x: 50, y: 75 },
              { label: '↘', x: 75, y: 75 },
            ].map((pos) => {
              const isSelected = videoPosition.x === pos.x && videoPosition.y === pos.y;
              return (
                <button
                  key={`${pos.x}-${pos.y}`}
                  onClick={() => setVideoPosition({ x: pos.x, y: pos.y })}
                  className="p-1.5 rounded text-sm transition-colors"
                  style={{
                    backgroundColor: isSelected
                      ? CASA_BRAND.colors.primary.amber + '4D'
                      : CASA_BRAND.colors.primary.black,
                    color: isSelected
                      ? CASA_BRAND.colors.primary.amber
                      : CASA_BRAND.colors.secondary.grayMedium,
                  }}
                >
                  {pos.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Opacity Slider */}
        <div>
          <label
            className="text-xs mb-2 block"
            style={{
              color: CASA_BRAND.colors.secondary.grayLight,
              fontFamily: CASA_BRAND.fonts.body,
            }}
          >
            Opacidad: {videoOpacity}%
          </label>
          <Slider
            value={[videoOpacity]}
            onValueChange={(v) => setVideoOpacity(v[0])}
            min={10}
            max={100}
            step={5}
            className="w-full"
            trackClassName="bg-gray-700"
            rangeStyle={{ backgroundColor: CASA_BRAND.colors.primary.amber }}
            thumbStyle={{ borderColor: CASA_BRAND.colors.primary.amber }}
          />
        </div>

        {/* Rotation Slider */}
        <div>
          <label
            className="text-xs mb-2 block"
            style={{
              color: CASA_BRAND.colors.secondary.grayLight,
              fontFamily: CASA_BRAND.fonts.body,
            }}
          >
            Rotación: {videoRotation}°
          </label>
          <Slider
            value={[videoRotation]}
            onValueChange={(v) => setVideoRotation(v[0])}
            min={-180}
            max={180}
            step={5}
            className="w-full"
            trackClassName="bg-gray-700"
            rangeStyle={{ backgroundColor: CASA_BRAND.colors.primary.amber }}
            thumbStyle={{ borderColor: CASA_BRAND.colors.primary.amber }}
          />
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
        <Button
          variant="ghost"
          onClick={onCancel}
          style={{
            color: CASA_BRAND.colors.secondary.grayLight,
          }}
        >
          Cancelar
        </Button>
        <Button
          onClick={handleCreate}
          disabled={!hasValidVideo || isCreating}
          className="gap-2 disabled:opacity-50"
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
