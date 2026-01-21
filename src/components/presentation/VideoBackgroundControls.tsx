/**
 * VideoBackgroundControls - Panel de control de video backgrounds en PresenterView
 * Permite agregar, editar, eliminar y gestionar visibilidad de videos de fondo
 *
 * Use cases:
 * - Ambient motion backgrounds during worship
 * - Subtle animated textures behind lyrics
 * - Atmospheric visual effects during sermons
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { CASA_BRAND } from '@/lib/brand-kit';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ChevronDown,
  ChevronUp,
  Video,
  Plus,
  Trash2,
  Globe,
  Layers,
  Upload,
  RotateCcw,
  Link,
  Repeat,
  VolumeX,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type {
  VideoBackground,
  VideoBackgroundState,
  VideoBackgroundSettings,
  FlattenedElement,
  OverlayScope,
} from '@/lib/presentation/types';
import {
  getScopeLabel,
  getActiveVideoBackground,
  DEFAULT_VIDEO_BACKGROUND_SETTINGS,
} from '@/lib/presentation/types';
import { ElementSelectorModal } from './ElementSelectorModal';

interface VideoBackgroundControlsProps {
  videoBackgroundState: VideoBackgroundState;
  currentSlideIndex: number;
  currentElement: FlattenedElement | null;
  elements: FlattenedElement[];
  onAdd: (background: VideoBackground) => void;
  onUpdate: (id: string, updates: Partial<VideoBackground>) => void;
  onRemove: (id: string) => void;
  /** When true, renders without header/expand (for use inside CollapsiblePanel) */
  compact?: boolean;
}

export const VideoBackgroundControls: React.FC<VideoBackgroundControlsProps> = ({
  videoBackgroundState,
  currentSlideIndex,
  currentElement,
  elements,
  onAdd,
  onUpdate,
  onRemove,
  compact = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingBackground, setEditingBackground] = useState<VideoBackground | null>(null);

  // Editor state
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('url');
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [settings, setSettings] = useState<VideoBackgroundSettings>(DEFAULT_VIDEO_BACKGROUND_SETTINGS);
  const [scope, setScope] = useState<OverlayScope>({ type: 'all' });
  const [selectorOpen, setSelectorOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track blob URL for cleanup
  const blobUrlRef = useRef<string | null>(null);

  // Cleanup blob URL when component unmounts or when dialog closes
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  // Cleanup blob URL when editor closes
  useEffect(() => {
    if (!editorOpen && blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, [editorOpen]);

  // Get all backgrounds
  const allBackgrounds = videoBackgroundState.backgrounds;

  // Get active background for current slide
  const activeOnCurrentSlide = getActiveVideoBackground(videoBackgroundState, currentSlideIndex, elements);

  // Handle add new background
  const handleAddClick = () => {
    setEditingBackground(null);
    setVideoUrl('');
    setVideoFile(null);
    setVideoPreviewUrl(null);
    setSettings(DEFAULT_VIDEO_BACKGROUND_SETTINGS);
    setScope({ type: 'all' });
    setActiveTab('url');
    setEditorOpen(true);
  };

  // Handle edit background
  const handleEditClick = (background: VideoBackground) => {
    setEditingBackground(background);
    setVideoUrl(background.settings.videoUrl);
    setVideoPreviewUrl(background.settings.videoUrl);
    setSettings(background.settings);
    setScope(background.scope);
    setActiveTab('url');
    setEditorOpen(true);
  };

  // Max file size: 50MB (video files can be large)
  const MAX_FILE_SIZE_MB = 50;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate it's a video
    if (!file.type.startsWith('video/')) {
      toast.error('Por favor selecciona un archivo de video');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error(`El archivo es demasiado grande. Máximo ${MAX_FILE_SIZE_MB}MB`);
      return;
    }

    // Revoke previous blob URL if exists
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
    }

    // Create blob URL for preview
    const url = URL.createObjectURL(file);
    blobUrlRef.current = url;
    setVideoFile(file);
    setVideoPreviewUrl(url);
  };

  // Handle URL change
  const handleUrlChange = (url: string) => {
    setVideoUrl(url);
    // Only set preview if URL looks like a valid direct video URL
    // Note: YouTube/Vimeo URLs won't work with <video> element - they need embeds
    if (url.match(/^https?:\/\/.+\.(mp4|webm|mov|ogg)$/i)) {
      setVideoPreviewUrl(url);
    } else {
      // Clear preview for non-direct video URLs
      setVideoPreviewUrl(null);
    }
  };

  // Handle save
  const handleSave = async () => {
    let finalVideoUrl = videoUrl;

    if (activeTab === 'upload' && videoFile) {
      // For upload, convert to data URL (not ideal for large files, but works for MVP)
      // In production, this should upload to storage
      try {
        finalVideoUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(videoFile);
        });
      } catch {
        toast.error('Error al procesar el video');
        return;
      }
    }

    if (!finalVideoUrl) {
      toast.error('Por favor proporciona un video');
      return;
    }

    const newSettings: VideoBackgroundSettings = {
      ...settings,
      videoUrl: finalVideoUrl,
    };

    if (editingBackground) {
      // Update existing background
      onUpdate(editingBackground.id, {
        settings: newSettings,
        scope,
      });
    } else {
      // Create new background
      const newBackground: VideoBackground = {
        id: `vbg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        settings: newSettings,
        scope,
        visible: true, // Start visible
      };
      onAdd(newBackground);
    }

    // Cleanup
    if (videoPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(videoPreviewUrl);
    }
    setEditorOpen(false);
    setEditingBackground(null);
  };

  // Handle visibility toggle
  const handleVisibilityToggle = (background: VideoBackground, shouldShow: boolean) => {
    onUpdate(background.id, { visible: shouldShow });
  };

  // Check if background is active on current slide
  const isActiveOnSlide = (background: VideoBackground): boolean => {
    return activeOnCurrentSlide?.id === background.id;
  };

  // Get initial selected IDs for element selector modal
  const getInitialSelectedIds = useCallback((): string[] => {
    if (scope.type === 'elements') {
      return scope.elementIds;
    }
    if (scope.type === 'all') {
      return elements.map((e) => e.id);
    }
    return [];
  }, [scope, elements]);

  // Handle element selection from modal
  const handleElementsSelected = useCallback((elementIds: string[]) => {
    if (elementIds.length === 0) {
      setSelectorOpen(false);
      return;
    }
    if (elementIds.length === elements.length) {
      setScope({ type: 'all' });
    } else {
      setScope({ type: 'elements', elementIds });
    }
    setSelectorOpen(false);
  }, [elements]);

  const content = (
    <div className="space-y-3">
      {/* Background list */}
      {allBackgrounds.length === 0 ? (
        <p
          className="text-center py-4"
          style={{
            color: CASA_BRAND.colors.secondary.grayMedium,
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '13px',
          }}
        >
          No hay video de fondo. Haz clic en "Agregar Video" para crear uno.
        </p>
      ) : (
        <div className="space-y-2">
          {allBackgrounds.map((background) => {
            const scopeLabel = getScopeLabel(background.scope, elements);
            const isOnCurrentSlide = isActiveOnSlide(background);

            return (
              <div
                key={background.id}
                className="flex items-center gap-2 p-2 rounded"
                style={{
                  backgroundColor: CASA_BRAND.colors.primary.black,
                  border: isOnCurrentSlide
                    ? `1px solid ${CASA_BRAND.colors.primary.amber}40`
                    : `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
                  opacity: background.visible ? 1 : 0.6,
                }}
              >
                {/* Video thumbnail/icon */}
                <div
                  className="w-10 h-10 rounded overflow-hidden flex-shrink-0 flex items-center justify-center"
                  style={{
                    backgroundColor: CASA_BRAND.colors.secondary.grayDark,
                  }}
                >
                  <Video size={20} style={{ color: CASA_BRAND.colors.secondary.grayMedium }} />
                </div>

                {/* Content info */}
                <div className="flex-1 min-w-0">
                  <p
                    className="truncate text-xs"
                    style={{
                      color: background.visible
                        ? CASA_BRAND.colors.primary.white
                        : CASA_BRAND.colors.secondary.grayMedium,
                      fontFamily: CASA_BRAND.fonts.body,
                    }}
                  >
                    {Math.round(background.settings.opacity * 100)}% opacity
                    {background.settings.loop ? ' • Loop' : ''}
                    {background.settings.muted ? ' • Mudo' : ''}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {background.scope.type === 'all' ? (
                      <Globe
                        size={10}
                        style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                      />
                    ) : (
                      <Layers
                        size={10}
                        style={{ color: CASA_BRAND.colors.primary.amber }}
                      />
                    )}
                    <span
                      style={{
                        fontSize: '10px',
                        color: background.scope.type === 'all'
                          ? CASA_BRAND.colors.secondary.grayMedium
                          : CASA_BRAND.colors.primary.amber,
                      }}
                    >
                      {scopeLabel}
                    </span>
                    {isOnCurrentSlide && (
                      <span
                        className="ml-1 px-1.5 py-0.5 rounded text-[9px]"
                        style={{
                          backgroundColor: CASA_BRAND.colors.primary.amber + '30',
                          color: CASA_BRAND.colors.primary.amber,
                        }}
                      >
                        activo
                      </span>
                    )}
                  </div>
                </div>

                {/* Edit button */}
                <button
                  onClick={() => handleEditClick(background)}
                  className="p-1.5 rounded hover:bg-gray-700 transition-colors"
                  title="Editar"
                >
                  <Video
                    size={14}
                    style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                  />
                </button>

                {/* Visibility toggle */}
                <Switch
                  checked={background.visible}
                  onCheckedChange={(v) => handleVisibilityToggle(background, v)}
                  className="data-[state=checked]:bg-white data-[state=unchecked]:bg-gray-700"
                  thumbClassName="border-2 border-gray-400"
                  title={background.visible ? 'Visible' : 'Oculto'}
                />

                {/* Delete button */}
                <button
                  onClick={() => onRemove(background.id)}
                  className="p-1.5 rounded hover:bg-red-900/50 transition-colors"
                  title="Eliminar"
                >
                  <Trash2 size={14} style={{ color: '#ef4444' }} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add button */}
      <div className="pt-2">
        <Button
          onClick={handleAddClick}
          variant="outline"
          size="sm"
          className="w-full gap-2 hover:bg-white/10"
          disabled={allBackgrounds.length >= 1} // Only allow one video background for now
          style={{
            borderColor: CASA_BRAND.colors.secondary.grayMedium,
            backgroundColor: CASA_BRAND.colors.secondary.grayDark,
            color: CASA_BRAND.colors.primary.white,
          }}
        >
          <Plus size={14} />
          Agregar Video
        </Button>
      </div>

      {/* Limit indicator */}
      {allBackgrounds.length >= 1 && (
        <p
          className="text-xs text-center"
          style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
        >
          Solo se permite un video de fondo
        </p>
      )}

      {/* Editor dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent
          className="sm:max-w-md"
          style={{
            backgroundColor: CASA_BRAND.colors.secondary.carbon,
            border: `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
          }}
        >
          <DialogHeader>
            <DialogTitle
              style={{
                fontFamily: CASA_BRAND.fonts.heading,
                color: CASA_BRAND.colors.primary.white,
              }}
            >
              {editingBackground ? 'Editar Video de Fondo' : 'Agregar Video de Fondo'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Tabs for URL / Upload */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'upload' | 'url')}>
              <TabsList className="grid w-full grid-cols-2" style={{ backgroundColor: CASA_BRAND.colors.primary.black }}>
                <TabsTrigger
                  value="url"
                  className="data-[state=active]:bg-amber-600/20"
                  style={{ fontFamily: CASA_BRAND.fonts.body }}
                >
                  <Link size={16} className="mr-2" />
                  URL
                </TabsTrigger>
                <TabsTrigger
                  value="upload"
                  className="data-[state=active]:bg-amber-600/20"
                  style={{ fontFamily: CASA_BRAND.fonts.body }}
                >
                  <Upload size={16} className="mr-2" />
                  Subir
                </TabsTrigger>
              </TabsList>

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
                    value={videoUrl}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    placeholder="https://example.com/video.mp4"
                    style={{
                      backgroundColor: CASA_BRAND.colors.primary.black,
                      borderColor: CASA_BRAND.colors.secondary.grayDark,
                      color: CASA_BRAND.colors.primary.white,
                    }}
                  />
                  <p
                    className="text-xs"
                    style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                  >
                    Ingresa una URL directa a un archivo de video (MP4, WebM)
                  </p>
                </div>
              </TabsContent>

              {/* Upload Tab */}
              <TabsContent value="upload" className="mt-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                  className="hidden"
                  onChange={handleFileSelect}
                />

                {videoPreviewUrl && activeTab === 'upload' ? (
                  <div className="relative">
                    <video
                      src={videoPreviewUrl}
                      className="w-full h-32 object-cover rounded-lg bg-black"
                      controls={false}
                      muted
                      loop
                      autoPlay
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute top-2 right-2 gap-1"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        backgroundColor: CASA_BRAND.colors.secondary.carbon + 'cc',
                        borderColor: CASA_BRAND.colors.secondary.grayMedium,
                        color: CASA_BRAND.colors.primary.white,
                      }}
                    >
                      <RotateCcw size={12} />
                      Cambiar
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full h-32 gap-2 flex-col hover:bg-white/10"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      borderColor: CASA_BRAND.colors.secondary.grayMedium,
                      borderStyle: 'dashed',
                      backgroundColor: CASA_BRAND.colors.primary.black,
                      color: CASA_BRAND.colors.secondary.grayMedium,
                    }}
                  >
                    <Upload size={24} />
                    <span>Seleccionar video</span>
                    <span className="text-xs opacity-70">MP4, WebM (máx. {MAX_FILE_SIZE_MB}MB)</span>
                  </Button>
                )}
              </TabsContent>
            </Tabs>

            {/* Opacity slider */}
            <div>
              <label
                className="text-sm mb-2 block"
                style={{
                  color: CASA_BRAND.colors.secondary.grayLight,
                  fontFamily: CASA_BRAND.fonts.body,
                }}
              >
                Opacidad: {Math.round(settings.opacity * 100)}%
              </label>
              <Slider
                value={[settings.opacity * 100]}
                onValueChange={(v) => setSettings({ ...settings, opacity: v[0] / 100 })}
                min={10}
                max={100}
                step={5}
                className="w-full"
              />
            </div>

            {/* Blur slider */}
            <div>
              <label
                className="text-sm mb-2 block"
                style={{
                  color: CASA_BRAND.colors.secondary.grayLight,
                  fontFamily: CASA_BRAND.fonts.body,
                }}
              >
                Desenfoque: {settings.blur || 0}px
              </label>
              <Slider
                value={[settings.blur || 0]}
                onValueChange={(v) => setSettings({ ...settings, blur: v[0] })}
                min={0}
                max={20}
                step={1}
                className="w-full"
              />
            </div>

            {/* Playback Options */}
            <div className="space-y-3">
              <label
                className="text-sm block"
                style={{
                  color: CASA_BRAND.colors.secondary.grayLight,
                  fontFamily: CASA_BRAND.fonts.body,
                }}
              >
                Opciones de Reproducción
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div
                  className="flex items-center gap-2 p-2 rounded-lg"
                  style={{ backgroundColor: CASA_BRAND.colors.primary.black }}
                >
                  <Switch
                    id="loop"
                    checked={settings.loop}
                    onCheckedChange={(v) => setSettings({ ...settings, loop: v })}
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
                    checked={settings.muted}
                    onCheckedChange={(v) => setSettings({ ...settings, muted: v })}
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
                    Silenciar
                  </Label>
                </div>
              </div>
            </div>

            {/* Fit mode */}
            <div>
              <label
                className="text-sm mb-2 block"
                style={{
                  color: CASA_BRAND.colors.secondary.grayLight,
                  fontFamily: CASA_BRAND.fonts.body,
                }}
              >
                Ajuste
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSettings({ ...settings, fitMode: 'cover' })}
                  className="px-3 py-2 rounded transition-colors text-sm"
                  style={{
                    backgroundColor:
                      settings.fitMode === 'cover'
                        ? CASA_BRAND.colors.primary.amber
                        : CASA_BRAND.colors.primary.black,
                    color:
                      settings.fitMode === 'cover'
                        ? CASA_BRAND.colors.primary.black
                        : CASA_BRAND.colors.primary.white,
                    fontFamily: CASA_BRAND.fonts.body,
                    border:
                      settings.fitMode === 'cover'
                        ? `2px solid ${CASA_BRAND.colors.primary.amber}`
                        : `2px solid transparent`,
                  }}
                >
                  Cubrir
                </button>
                <button
                  onClick={() => setSettings({ ...settings, fitMode: 'contain' })}
                  className="px-3 py-2 rounded transition-colors text-sm"
                  style={{
                    backgroundColor:
                      settings.fitMode === 'contain'
                        ? CASA_BRAND.colors.primary.amber
                        : CASA_BRAND.colors.primary.black,
                    color:
                      settings.fitMode === 'contain'
                        ? CASA_BRAND.colors.primary.black
                        : CASA_BRAND.colors.primary.white,
                    fontFamily: CASA_BRAND.fonts.body,
                    border:
                      settings.fitMode === 'contain'
                        ? `2px solid ${CASA_BRAND.colors.primary.amber}`
                        : `2px solid transparent`,
                  }}
                >
                  Contener
                </button>
              </div>
            </div>

            {/* Scope selector */}
            <div>
              <label
                className="text-sm mb-2 block"
                style={{
                  color: CASA_BRAND.colors.secondary.grayLight,
                  fontFamily: CASA_BRAND.fonts.body,
                }}
              >
                Aplicar a
              </label>
              <div className="grid grid-cols-2 gap-2">
                {/* Diapositiva Actual */}
                <button
                  onClick={() => setScope({ type: 'slide', slideIndex: currentSlideIndex })}
                  className="px-3 py-2 rounded transition-colors flex items-center justify-center gap-2 text-sm"
                  style={{
                    backgroundColor:
                      scope.type === 'slide'
                        ? CASA_BRAND.colors.primary.amber
                        : CASA_BRAND.colors.primary.black,
                    color:
                      scope.type === 'slide'
                        ? CASA_BRAND.colors.primary.black
                        : CASA_BRAND.colors.primary.white,
                    fontFamily: CASA_BRAND.fonts.body,
                    border:
                      scope.type === 'slide'
                        ? `2px solid ${CASA_BRAND.colors.primary.amber}`
                        : `2px solid transparent`,
                  }}
                >
                  Diapositiva actual
                </button>

                {/* Elemento Actual */}
                <button
                  onClick={() => {
                    if (currentElement) {
                      setScope({ type: 'element', elementId: currentElement.id });
                    }
                  }}
                  disabled={!currentElement}
                  className="px-3 py-2 rounded transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                  style={{
                    backgroundColor:
                      scope.type === 'element'
                        ? CASA_BRAND.colors.primary.amber
                        : CASA_BRAND.colors.primary.black,
                    color:
                      scope.type === 'element'
                        ? CASA_BRAND.colors.primary.black
                        : CASA_BRAND.colors.primary.white,
                    fontFamily: CASA_BRAND.fonts.body,
                    border:
                      scope.type === 'element'
                        ? `2px solid ${CASA_BRAND.colors.primary.amber}`
                        : `2px solid transparent`,
                  }}
                >
                  Elemento actual
                </button>

                {/* Seleccionar Elementos */}
                <button
                  onClick={() => setSelectorOpen(true)}
                  className="px-3 py-2 rounded transition-colors flex items-center justify-center gap-2 text-sm"
                  style={{
                    backgroundColor:
                      scope.type === 'elements'
                        ? CASA_BRAND.colors.primary.amber
                        : CASA_BRAND.colors.primary.black,
                    color:
                      scope.type === 'elements'
                        ? CASA_BRAND.colors.primary.black
                        : CASA_BRAND.colors.primary.white,
                    fontFamily: CASA_BRAND.fonts.body,
                    border:
                      scope.type === 'elements'
                        ? `2px solid ${CASA_BRAND.colors.primary.amber}`
                        : `2px solid transparent`,
                  }}
                >
                  {scope.type === 'elements'
                    ? getScopeLabel(scope, elements)
                    : 'Seleccionar...'}
                </button>

                {/* Toda la Presentación */}
                <button
                  onClick={() => setScope({ type: 'all' })}
                  className="px-3 py-2 rounded transition-colors flex items-center justify-center gap-2 text-sm"
                  style={{
                    backgroundColor:
                      scope.type === 'all'
                        ? CASA_BRAND.colors.primary.amber
                        : CASA_BRAND.colors.primary.black,
                    color:
                      scope.type === 'all'
                        ? CASA_BRAND.colors.primary.black
                        : CASA_BRAND.colors.primary.white,
                    fontFamily: CASA_BRAND.fonts.body,
                    border:
                      scope.type === 'all'
                        ? `2px solid ${CASA_BRAND.colors.primary.amber}`
                        : `2px solid transparent`,
                  }}
                >
                  Toda la presentación
                </button>
              </div>
            </div>

            {/* Save button */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setEditorOpen(false)}
                style={{
                  borderColor: CASA_BRAND.colors.secondary.grayMedium,
                  color: CASA_BRAND.colors.primary.white,
                }}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handleSave}
                disabled={!videoUrl && !videoFile}
                style={{
                  backgroundColor: CASA_BRAND.colors.primary.amber,
                  color: CASA_BRAND.colors.primary.black,
                }}
              >
                {editingBackground ? 'Guardar' : 'Agregar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Element selector modal */}
      <ElementSelectorModal
        open={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        elements={elements}
        onSelect={handleElementsSelected}
        initialSelected={getInitialSelectedIds()}
      />
    </div>
  );

  // Compact mode: just render content without wrapper/header
  if (compact) {
    return content;
  }

  // Full mode: render with header and expand/collapse
  return (
    <div
      style={{
        borderTop: `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
      }}
    >
      {/* Header - collapsible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Video size={16} style={{ color: CASA_BRAND.colors.primary.amber }} />
          <span
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              fontWeight: 600,
              color: CASA_BRAND.colors.primary.white,
            }}
          >
            Video de Fondo
          </span>
          {allBackgrounds.length > 0 && (
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{
                backgroundColor: CASA_BRAND.colors.secondary.grayDark,
                color: CASA_BRAND.colors.secondary.grayMedium,
              }}
            >
              {allBackgrounds.length}
            </span>
          )}
          {activeOnCurrentSlide && (
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{
                backgroundColor: CASA_BRAND.colors.primary.amber + '30',
                color: CASA_BRAND.colors.primary.amber,
              }}
            >
              activo
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp size={16} style={{ color: CASA_BRAND.colors.secondary.grayMedium }} />
        ) : (
          <ChevronDown size={16} style={{ color: CASA_BRAND.colors.secondary.grayMedium }} />
        )}
      </button>

      {/* Content */}
      {isExpanded && <div className="px-4 pb-4">{content}</div>}
    </div>
  );
};

export default VideoBackgroundControls;
