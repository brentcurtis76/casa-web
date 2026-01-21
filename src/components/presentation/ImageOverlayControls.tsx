/**
 * ImageOverlayControls - Panel de control de image overlays en PresenterView
 * Permite agregar, editar, eliminar y gestionar visibilidad de overlays de imagen
 *
 * Use cases:
 * - Watermarks
 * - Decorative frames/borders
 * - Semi-transparent graphics
 * - Corner decorations
 * - Event logos (different from main CASA logo)
 */

import React, { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { CASA_BRAND } from '@/lib/brand-kit';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Plus,
  Trash2,
  Globe,
  Layers,
  Upload,
  RotateCcw,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ImageOverlay, ImageOverlayState, ImageOverlayStyle, FlattenedElement, OverlayScope } from '@/lib/presentation/types';
import { getScopeLabel, getVisibleImageOverlays, DEFAULT_IMAGE_OVERLAY_STYLE } from '@/lib/presentation/types';
import { ElementSelectorModal } from './ElementSelectorModal';

interface ImageOverlayControlsProps {
  imageOverlayState: ImageOverlayState;
  currentSlideIndex: number;
  /** Elemento actual (el que contiene el slide actual) */
  currentElement: FlattenedElement | null;
  /** Lista de todos los elementos */
  elements: FlattenedElement[];
  /** Agregar un nuevo overlay */
  onAdd: (overlay: ImageOverlay) => void;
  /** Actualizar un overlay existente */
  onUpdate: (id: string, updates: Partial<ImageOverlay>) => void;
  /** Eliminar un overlay */
  onRemove: (id: string) => void;
  /** When true, renders without header/expand (for use inside CollapsiblePanel) */
  compact?: boolean;
}

export const ImageOverlayControls: React.FC<ImageOverlayControlsProps> = ({
  imageOverlayState,
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
  const [editingOverlay, setEditingOverlay] = useState<ImageOverlay | null>(null);

  // Editor state
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [style, setStyle] = useState<ImageOverlayStyle>(DEFAULT_IMAGE_OVERLAY_STYLE);
  const [scope, setScope] = useState<OverlayScope>({ type: 'all' });
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [selectorOpen, setSelectorOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get all overlays
  const allOverlays = imageOverlayState.overlays;

  // Get visible overlays for current slide (for display indicator)
  const visibleOnCurrentSlide = getVisibleImageOverlays(imageOverlayState, currentSlideIndex, elements);

  // Handle add new overlay
  const handleAddClick = () => {
    setEditingOverlay(null);
    setPreviewUrl('');
    setStyle(DEFAULT_IMAGE_OVERLAY_STYLE);
    setScope({ type: 'all' });
    setPosition({ x: 50, y: 50 });
    setEditorOpen(true);
  };

  // Handle edit overlay
  const handleEditClick = (overlay: ImageOverlay) => {
    setEditingOverlay(overlay);
    setPreviewUrl(overlay.imageUrl);
    setStyle(overlay.style);
    setScope(overlay.scope);
    setPosition(overlay.position);
    setEditorOpen(true);
  };

  // Max file size: 5MB (data URLs for larger images can cause performance issues)
  const MAX_FILE_SIZE_MB = 5;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate it's an image
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona un archivo de imagen');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error(`El archivo es demasiado grande. Máximo ${MAX_FILE_SIZE_MB}MB`);
      return;
    }

    // Read as data URL
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setPreviewUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // Handle save
  const handleSave = () => {
    if (!previewUrl) {
      toast.error('Por favor selecciona una imagen');
      return;
    }

    if (editingOverlay) {
      // Update existing overlay
      onUpdate(editingOverlay.id, {
        imageUrl: previewUrl,
        style,
        scope,
        position,
      });
    } else {
      // Create new overlay (starts as NOT visible so user can position it)
      const newOverlay: ImageOverlay = {
        id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        imageUrl: previewUrl,
        position,
        style,
        visible: false,
        scope,
      };
      onAdd(newOverlay);
    }
    setEditorOpen(false);
    setEditingOverlay(null);
  };

  // Handle visibility toggle for current element
  const handleVisibilityToggle = (overlay: ImageOverlay, shouldShow: boolean) => {
    const isCurrentlyVisible = isVisibleOnSlide(overlay);

    if (shouldShow && !isCurrentlyVisible) {
      // Turn ON for current element
      if (!overlay.visible) {
        onUpdate(overlay.id, { visible: true });
      }

      if (overlay.scope.type === 'elements' && currentElement) {
        if (!overlay.scope.elementIds.includes(currentElement.id)) {
          onUpdate(overlay.id, {
            scope: { type: 'elements', elementIds: [...overlay.scope.elementIds, currentElement.id] },
          });
        }
      } else if (overlay.scope.type === 'element' && currentElement) {
        if (overlay.scope.elementId !== currentElement.id) {
          onUpdate(overlay.id, { scope: { type: 'element', elementId: currentElement.id } });
        }
      } else if (overlay.scope.type === 'slide') {
        if (overlay.scope.slideIndex !== currentSlideIndex) {
          onUpdate(overlay.id, { scope: { type: 'slide', slideIndex: currentSlideIndex } });
        }
      }
    } else if (!shouldShow && isCurrentlyVisible) {
      // Turn OFF for current element
      if (overlay.scope.type === 'all') {
        if (currentElement) {
          const otherElementIds = elements
            .filter((e) => e.id !== currentElement.id)
            .map((e) => e.id);
          onUpdate(overlay.id, { scope: { type: 'elements', elementIds: otherElementIds } });
        }
      } else if (overlay.scope.type === 'elements' && currentElement) {
        const newIds = overlay.scope.elementIds.filter((id) => id !== currentElement.id);
        onUpdate(overlay.id, { scope: { type: 'elements', elementIds: newIds } });
      } else if (overlay.scope.type === 'element') {
        onUpdate(overlay.id, { scope: { type: 'elements', elementIds: [] } });
      } else if (overlay.scope.type === 'slide') {
        onUpdate(overlay.id, { scope: { type: 'elements', elementIds: [] } });
      }
    }
  };

  // Check if overlay is visible on current slide
  const isVisibleOnSlide = (overlay: ImageOverlay): boolean => {
    return visibleOnCurrentSlide.some((o) => o.id === overlay.id);
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
      {/* Overlay list */}
      {allOverlays.length === 0 ? (
        <p
          className="text-center py-4"
          style={{
            color: CASA_BRAND.colors.secondary.grayMedium,
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '13px',
          }}
        >
          No hay imágenes. Haz clic en "Agregar Imagen" para crear una.
        </p>
      ) : (
        <div className="space-y-2">
          {allOverlays.map((overlay) => {
            const scopeLabel = getScopeLabel(overlay.scope, elements);
            const isOnCurrentSlide = isVisibleOnSlide(overlay);

            return (
              <div
                key={overlay.id}
                className="flex items-center gap-2 p-2 rounded"
                style={{
                  backgroundColor: CASA_BRAND.colors.primary.black,
                  border: isOnCurrentSlide
                    ? `1px solid ${CASA_BRAND.colors.primary.amber}40`
                    : `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
                  opacity: overlay.visible ? 1 : 0.6,
                }}
              >
                {/* Image thumbnail */}
                <div
                  className="w-10 h-10 rounded overflow-hidden flex-shrink-0"
                  style={{
                    backgroundColor: CASA_BRAND.colors.secondary.grayDark,
                  }}
                >
                  <img
                    src={overlay.imageUrl}
                    alt=""
                    className="w-full h-full object-contain"
                  />
                </div>

                {/* Content info */}
                <div className="flex-1 min-w-0">
                  <p
                    className="truncate text-xs"
                    style={{
                      color: overlay.visible
                        ? CASA_BRAND.colors.primary.white
                        : CASA_BRAND.colors.secondary.grayMedium,
                      fontFamily: CASA_BRAND.fonts.body,
                    }}
                  >
                    {Math.round(overlay.style.size)}% • {Math.round(overlay.style.opacity * 100)}%
                    {overlay.style.rotation ? ` • ${overlay.style.rotation}°` : ''}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {overlay.scope.type === 'all' ? (
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
                        color: overlay.scope.type === 'all'
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
                  onClick={() => handleEditClick(overlay)}
                  className="p-1.5 rounded hover:bg-gray-700 transition-colors"
                  title="Editar"
                >
                  <ImageIcon
                    size={14}
                    style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                  />
                </button>

                {/* Visibility toggle */}
                <Switch
                  checked={isOnCurrentSlide}
                  onCheckedChange={(v) => handleVisibilityToggle(overlay, v)}
                  className="data-[state=checked]:bg-white data-[state=unchecked]:bg-gray-700"
                  thumbClassName="border-2 border-gray-400"
                  title={isOnCurrentSlide ? 'Visible en este elemento' : 'No visible en este elemento'}
                />

                {/* Delete button */}
                <button
                  onClick={() => onRemove(overlay.id)}
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
          disabled={allOverlays.length >= 10}
          style={{
            borderColor: CASA_BRAND.colors.secondary.grayMedium,
            backgroundColor: CASA_BRAND.colors.secondary.grayDark,
            color: CASA_BRAND.colors.primary.white,
          }}
        >
          <Plus size={14} />
          Agregar Imagen
        </Button>
      </div>

      {/* Limit indicator */}
      {allOverlays.length >= 10 && (
        <p
          className="text-xs text-center"
          style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
        >
          Máximo 10 imágenes alcanzado
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
              {editingOverlay ? 'Editar Imagen' : 'Agregar Imagen'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Image upload */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />

              {previewUrl ? (
                <div className="relative">
                  <div
                    className="w-full h-32 rounded overflow-hidden flex items-center justify-center"
                    style={{ backgroundColor: CASA_BRAND.colors.primary.black }}
                  >
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
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
                  <span>Seleccionar imagen</span>
                  <span className="text-xs opacity-70">PNG, JPG, GIF, WebP</span>
                </Button>
              )}
            </div>

            {/* Size slider */}
            <div>
              <label
                className="text-sm mb-2 block"
                style={{
                  color: CASA_BRAND.colors.secondary.grayLight,
                  fontFamily: CASA_BRAND.fonts.body,
                }}
              >
                Tamaño: {style.size}%
              </label>
              <Slider
                value={[style.size]}
                onValueChange={(v) => setStyle({ ...style, size: v[0] })}
                min={5}
                max={100}
                step={1}
                className="w-full"
              />
            </div>

            {/* Opacity slider */}
            <div>
              <label
                className="text-sm mb-2 block"
                style={{
                  color: CASA_BRAND.colors.secondary.grayLight,
                  fontFamily: CASA_BRAND.fonts.body,
                }}
              >
                Opacidad: {Math.round(style.opacity * 100)}%
              </label>
              <Slider
                value={[style.opacity * 100]}
                onValueChange={(v) => setStyle({ ...style, opacity: v[0] / 100 })}
                min={10}
                max={100}
                step={5}
                className="w-full"
              />
            </div>

            {/* Rotation slider */}
            <div>
              <label
                className="text-sm mb-2 block"
                style={{
                  color: CASA_BRAND.colors.secondary.grayLight,
                  fontFamily: CASA_BRAND.fonts.body,
                }}
              >
                Rotación: {style.rotation || 0}°
              </label>
              <Slider
                value={[style.rotation || 0]}
                onValueChange={(v) => setStyle({ ...style, rotation: v[0] })}
                min={-180}
                max={180}
                step={5}
                className="w-full"
              />
            </div>

            {/* Position presets */}
            <div>
              <label
                className="text-sm mb-2 block"
                style={{
                  color: CASA_BRAND.colors.secondary.grayLight,
                  fontFamily: CASA_BRAND.fonts.body,
                }}
              >
                Posición
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: '↖', x: 10, y: 10 },
                  { label: '↑', x: 50, y: 10 },
                  { label: '↗', x: 90, y: 10 },
                  { label: '←', x: 10, y: 50 },
                  { label: '●', x: 50, y: 50 },
                  { label: '→', x: 90, y: 50 },
                  { label: '↙', x: 10, y: 90 },
                  { label: '↓', x: 50, y: 90 },
                  { label: '↘', x: 90, y: 90 },
                ].map((pos) => (
                  <button
                    key={`${pos.x}-${pos.y}`}
                    onClick={() => setPosition({ x: pos.x, y: pos.y })}
                    className={`p-2 rounded text-lg transition-colors ${
                      position.x === pos.x && position.y === pos.y
                        ? 'bg-amber-500/30'
                        : 'bg-gray-800 hover:bg-gray-700'
                    }`}
                    style={{
                      color: position.x === pos.x && position.y === pos.y
                        ? CASA_BRAND.colors.primary.amber
                        : CASA_BRAND.colors.secondary.grayMedium,
                    }}
                  >
                    {pos.label}
                  </button>
                ))}
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
                disabled={!previewUrl}
                style={{
                  backgroundColor: CASA_BRAND.colors.primary.amber,
                  color: CASA_BRAND.colors.primary.black,
                }}
              >
                {editingOverlay ? 'Guardar' : 'Agregar'}
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
          <ImageIcon size={16} style={{ color: CASA_BRAND.colors.primary.amber }} />
          <span
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              fontWeight: 600,
              color: CASA_BRAND.colors.primary.white,
            }}
          >
            Imágenes
          </span>
          {allOverlays.length > 0 && (
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{
                backgroundColor: CASA_BRAND.colors.secondary.grayDark,
                color: CASA_BRAND.colors.secondary.grayMedium,
              }}
            >
              {allOverlays.length}
            </span>
          )}
          {visibleOnCurrentSlide.length > 0 && (
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{
                backgroundColor: CASA_BRAND.colors.primary.amber + '30',
                color: CASA_BRAND.colors.primary.amber,
              }}
            >
              {visibleOnCurrentSlide.length} activos
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

export default ImageOverlayControls;
