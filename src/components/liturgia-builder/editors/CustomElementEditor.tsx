/**
 * CustomElementEditor - Editor para elementos personalizados
 * Despacha el formulario correcto según el customType del elemento
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import { Save, Trash2, Plus, Minus, Upload, Loader2, X, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import useDebounce from '@/hooks/useDebounce';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import type {
  LiturgyElement,
  CustomElementConfig,
  CustomElementSubtype,
} from '@/types/shared/liturgy';
import { isCustomElement } from '@/types/shared/liturgy';
import type { SlideGroup } from '@/types/shared/slide';
import type { PresentationTheme } from '@/lib/presentation/themes';
import { customElementToSlides } from '@/lib/customElementToSlides';
import { UniversalSlide } from '@/components/liturgia-builder/UniversalSlide';

interface CustomElementEditorProps {
  element: LiturgyElement;
  onUpdate: (config: CustomElementConfig, slides: SlideGroup) => void;
  onDelete: () => void;
  theme?: PresentationTheme;
}

/**
 * Default labels for each subtype (Spanish)
 */
const SUBTYPE_LABELS: Record<CustomElementSubtype, string> = {
  'image-slide': 'Slide de Imagen',
  'title-slide': 'Slide de Título',
  'call-response': 'Llamado y Respuesta',
  'text-slide': 'Slide de Texto',
  'blank-slide': 'Slide en Blanco',
};

/**
 * Get initial config from element, or create a default one
 */
function getInitialConfig(element: LiturgyElement): CustomElementConfig {
  if (isCustomElement(element)) {
    return element.config;
  }
  return {
    customType: 'blank-slide',
    label: 'Elemento Personalizado',
  };
}

const CustomElementEditor: React.FC<CustomElementEditorProps> = ({
  element,
  onUpdate,
  onDelete,
  theme,
}) => {
  const [config, setConfig] = useState<CustomElementConfig>(getInitialConfig(element));
  const [previewIndex, setPreviewIndex] = useState(0);
  const { toast } = useToast();

  const debouncedConfig = useDebounce(config, 300);

  const previewSlides = useMemo(() => {
    try {
      const slideGroup = customElementToSlides(debouncedConfig, { theme });
      return slideGroup.slides;
    } catch {
      return null;
    }
  }, [debouncedConfig, theme]);

  // Clamp previewIndex when slide count changes
  const clampedPreviewIndex = previewSlides
    ? Math.min(previewIndex, previewSlides.length - 1)
    : 0;

  const handleSave = useCallback(() => {
    try {
      const slides = customElementToSlides(config, { theme, existingSlideGroup: element.slides });
      onUpdate(config, slides);
      toast({ title: 'Elemento guardado' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      toast({ variant: 'destructive', title: 'Error al guardar', description: message });
    }
  }, [config, theme, onUpdate, element.slides, toast]);

  const updateConfig = useCallback((partial: Partial<CustomElementConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  }, []);

  const renderSubtypeEditor = () => {
    switch (config.customType) {
      case 'image-slide':
        return <ImageSlideForm config={config} onChange={updateConfig} />;
      case 'title-slide':
        return <TitleSlideForm config={config} onChange={updateConfig} />;
      case 'call-response':
        return <CallResponseForm config={config} onChange={updateConfig} />;
      case 'text-slide':
        return <TextSlideForm config={config} onChange={updateConfig} />;
      case 'blank-slide':
        return <BlankSlideForm config={config} onChange={updateConfig} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4
          style={{
            fontFamily: CASA_BRAND.fonts.heading,
            fontSize: '18px',
            fontWeight: 400,
            color: CASA_BRAND.colors.primary.black,
          }}
        >
          {SUBTYPE_LABELS[config.customType]}
        </h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="text-red-500 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 size={16} className="mr-1" />
          Eliminar
        </Button>
      </div>

      {/* Label field (common to all subtypes) */}
      <div className="space-y-2">
        <Label
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '13px',
            color: CASA_BRAND.colors.secondary.grayDark,
          }}
        >
          Nombre del elemento
        </Label>
        <Input
          value={config.label}
          onChange={(e) => updateConfig({ label: e.target.value })}
          placeholder="Ej: Lectura especial, Slide de bienvenida..."
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
          }}
        />
      </div>

      {/* Subtype-specific form */}
      {renderSubtypeEditor()}

      {/* Live preview */}
      <div className="space-y-2 pt-2">
        <span
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '13px',
            fontWeight: 500,
            color: CASA_BRAND.colors.secondary.grayDark,
          }}
        >
          Vista previa
        </span>
        <div
          className="flex flex-col items-center rounded-lg border overflow-hidden"
          style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
        >
          {previewSlides && previewSlides.length > 0 ? (
            <>
              <div style={{ width: '100%', aspectRatio: '16 / 9', position: 'relative', overflow: 'hidden' }}>
                <div style={{ transform: 'scale(0.45)', transformOrigin: 'top left', width: `${100 / 0.45}%`, height: `${100 / 0.45}%` }}>
                  <UniversalSlide slide={previewSlides[clampedPreviewIndex]} scale={1} />
                </div>
              </div>
              {previewSlides.length > 1 && (
                <div
                  className="flex items-center justify-center gap-3 py-2 w-full border-t"
                  style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={clampedPreviewIndex === 0}
                    onClick={() => setPreviewIndex((i) => Math.max(0, i - 1))}
                  >
                    <ChevronLeft size={16} />
                  </Button>
                  <span
                    style={{
                      fontFamily: CASA_BRAND.fonts.body,
                      fontSize: '12px',
                      color: CASA_BRAND.colors.secondary.grayMedium,
                    }}
                  >
                    {clampedPreviewIndex + 1} / {previewSlides.length}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={clampedPreviewIndex === previewSlides.length - 1}
                    onClick={() => setPreviewIndex((i) => Math.min(previewSlides.length - 1, i + 1))}
                  >
                    <ChevronRight size={16} />
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div
              className="flex items-center justify-center w-full py-8"
              style={{ aspectRatio: '16 / 9' }}
            >
              <span
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '13px',
                  color: CASA_BRAND.colors.secondary.grayMedium,
                }}
              >
                Completa los campos para ver la vista previa
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end pt-4 border-t" style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}>
        <Button
          onClick={handleSave}
          style={{
            backgroundColor: CASA_BRAND.colors.primary.amber,
            color: CASA_BRAND.colors.primary.white,
            fontFamily: CASA_BRAND.fonts.body,
          }}
        >
          <Save size={16} className="mr-2" />
          Guardar Elemento
        </Button>
      </div>
    </div>
  );
};

// ==============================
// Subtype-specific form components
// ==============================

interface SubtypeFormProps {
  config: CustomElementConfig;
  onChange: (partial: Partial<CustomElementConfig>) => void;
}

/**
 * image-slide: title, subtitle, imageUrl (upload zone), imageConfig sliders
 */
const ImageSlideForm: React.FC<SubtypeFormProps> = ({ config, onChange }) => {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const deleteStorageImage = async (imageUrl: string) => {
    try {
      const url = new URL(imageUrl);
      const pathParts = url.pathname.split('/cuentacuentos-drafts/');
      if (pathParts.length < 2) return;
      const filePath = decodeURIComponent(pathParts[1]);
      await supabase.storage.from('cuentacuentos-drafts').remove([filePath]);
    } catch (err) {
      console.error('Failed to delete old image:', err);
    }
  };

  const handleRemoveImage = () => {
    if (config.imageUrl) {
      deleteStorageImage(config.imageUrl);
    }
    onChange({ imageUrl: '' });
  };

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Error', description: 'Solo se permiten archivos de imagen.' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Error', description: 'La imagen no puede superar los 10MB.' });
      return;
    }

    try {
      setUploading(true);
      // Delete old image before uploading new one (fire-and-forget)
      if (config.imageUrl) {
        deleteStorageImage(config.imageUrl);
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No se pudo obtener el usuario');

      const ext = file.name.split('.').pop() || 'png';
      const filePath = `${user.id}/custom-elements/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('cuentacuentos-drafts')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('cuentacuentos-drafts').getPublicUrl(filePath);
      onChange({ imageUrl: data.publicUrl });

      toast({ title: 'Imagen subida', description: 'La imagen se ha subido correctamente.' });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo subir la imagen. Por favor, intenta de nuevo.' });
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    // Reset input so re-selecting the same file triggers onChange
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label style={{ fontFamily: CASA_BRAND.fonts.body, fontSize: '13px', color: CASA_BRAND.colors.secondary.grayDark }}>
          Título
        </Label>
        <Input
          value={config.title || ''}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Título sobre la imagen"
          style={{ fontFamily: CASA_BRAND.fonts.body }}
        />
      </div>
      <div className="space-y-2">
        <Label style={{ fontFamily: CASA_BRAND.fonts.body, fontSize: '13px', color: CASA_BRAND.colors.secondary.grayDark }}>
          Subtítulo
        </Label>
        <Input
          value={config.subtitle || ''}
          onChange={(e) => onChange({ subtitle: e.target.value })}
          placeholder="Subtítulo (opcional)"
          style={{ fontFamily: CASA_BRAND.fonts.body }}
        />
      </div>

      {/* Image upload zone */}
      <div className="space-y-2">
        <Label style={{ fontFamily: CASA_BRAND.fonts.body, fontSize: '13px', color: CASA_BRAND.colors.secondary.grayDark }}>
          Imagen
        </Label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
          disabled={uploading}
        />
        {config.imageUrl ? (
          <div className="relative rounded-lg overflow-hidden border" style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}>
            <img
              src={config.imageUrl}
              alt="Vista previa"
              className="w-full h-40 object-cover"
            />
            <div className="absolute top-2 right-2 flex gap-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                title="Cambiar imagen"
              >
                <RefreshCw size={14} />
              </button>
              <button
                type="button"
                onClick={handleRemoveImage}
                className="p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                title="Eliminar imagen"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => !uploading && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className="flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed transition-colors cursor-pointer"
            style={{
              borderColor: dragOver ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.secondary.grayLight,
              backgroundColor: dragOver ? `${CASA_BRAND.colors.amber.light}15` : 'transparent',
              pointerEvents: uploading ? 'none' : 'auto',
              opacity: uploading ? 0.6 : 1,
            }}
          >
            {uploading ? (
              <Loader2 size={24} className="animate-spin" style={{ color: CASA_BRAND.colors.primary.amber }} />
            ) : (
              <Upload size={24} style={{ color: CASA_BRAND.colors.secondary.grayMedium }} />
            )}
            <span
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '13px',
                color: CASA_BRAND.colors.secondary.grayMedium,
              }}
            >
              {uploading ? 'Subiendo imagen...' : 'Arrastra una imagen o haz clic para seleccionar'}
            </span>
          </div>
        )}
      </div>

      {/* Image config sliders — only visible when an image is set */}
      {config.imageUrl && (
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label style={{ fontFamily: CASA_BRAND.fonts.body, fontSize: '13px', color: CASA_BRAND.colors.secondary.grayDark }}>
              Opacidad: {config.imageConfig?.opacity ?? 100}%
            </Label>
            <Slider
              value={[config.imageConfig?.opacity ?? 100]}
              min={0}
              max={100}
              step={5}
              onValueChange={([val]) =>
                onChange({
                  imageConfig: { ...(config.imageConfig || { opacity: 100, scale: 100, positionX: 0, positionY: 0 }), opacity: val },
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label style={{ fontFamily: CASA_BRAND.fonts.body, fontSize: '13px', color: CASA_BRAND.colors.secondary.grayDark }}>
              Escala: {config.imageConfig?.scale ?? 100}%
            </Label>
            <Slider
              value={[config.imageConfig?.scale ?? 100]}
              min={50}
              max={200}
              step={5}
              onValueChange={([val]) =>
                onChange({
                  imageConfig: { ...(config.imageConfig || { opacity: 100, scale: 100, positionX: 0, positionY: 0 }), scale: val },
                })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * title-slide: titleText, subtitleText
 */
const TitleSlideForm: React.FC<SubtypeFormProps> = ({ config, onChange }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label style={{ fontFamily: CASA_BRAND.fonts.body, fontSize: '13px', color: CASA_BRAND.colors.secondary.grayDark }}>
        Texto del título
      </Label>
      <Input
        value={config.titleText || ''}
        onChange={(e) => onChange({ titleText: e.target.value })}
        placeholder="Texto principal del título"
        style={{ fontFamily: CASA_BRAND.fonts.body }}
      />
    </div>
    <div className="space-y-2">
      <Label style={{ fontFamily: CASA_BRAND.fonts.body, fontSize: '13px', color: CASA_BRAND.colors.secondary.grayDark }}>
        Subtítulo
      </Label>
      <Input
        value={config.subtitleText || ''}
        onChange={(e) => onChange({ subtitleText: e.target.value })}
        placeholder="Subtítulo (opcional)"
        style={{ fontFamily: CASA_BRAND.fonts.body }}
      />
    </div>
  </div>
);

/**
 * call-response: label + dynamic list of {lider, congregacion} pairs
 */
const CallResponseForm: React.FC<SubtypeFormProps> = ({ config, onChange }) => {
  const tiempos = config.tiempos || [];

  const addTiempo = () => {
    onChange({ tiempos: [...tiempos, { lider: '', congregacion: '' }] });
  };

  const removeTiempo = (index: number) => {
    onChange({ tiempos: tiempos.filter((_, i) => i !== index) });
  };

  const updateTiempo = (index: number, field: 'lider' | 'congregacion', value: string) => {
    const updated = tiempos.map((t, i) =>
      i === index ? { ...t, [field]: value } : t
    );
    onChange({ tiempos: updated });
  };

  return (
    <div className="space-y-4">
      {tiempos.map((tiempo, index) => (
        <div
          key={index}
          className="p-3 rounded-lg border space-y-3"
          style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
        >
          <div className="flex items-center justify-between">
            <span
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '12px',
                fontWeight: 500,
                color: CASA_BRAND.colors.secondary.grayMedium,
              }}
            >
              Intercambio {index + 1}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeTiempo(index)}
              className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
            >
              <Minus size={14} />
            </Button>
          </div>
          <div className="space-y-2">
            <Label style={{ fontFamily: CASA_BRAND.fonts.body, fontSize: '12px', color: CASA_BRAND.colors.secondary.grayDark }}>
              Líder
            </Label>
            <Textarea
              value={tiempo.lider}
              onChange={(e) => updateTiempo(index, 'lider', e.target.value)}
              placeholder="Texto del líder..."
              rows={2}
              style={{ fontFamily: CASA_BRAND.fonts.body, fontSize: '13px' }}
            />
          </div>
          <div className="space-y-2">
            <Label style={{ fontFamily: CASA_BRAND.fonts.body, fontSize: '12px', color: CASA_BRAND.colors.secondary.grayDark }}>
              Congregación
            </Label>
            <Textarea
              value={tiempo.congregacion}
              onChange={(e) => updateTiempo(index, 'congregacion', e.target.value)}
              placeholder="Respuesta de la congregación..."
              rows={2}
              style={{ fontFamily: CASA_BRAND.fonts.body, fontSize: '13px' }}
            />
          </div>
        </div>
      ))}

      <Button
        variant="outline"
        onClick={addTiempo}
        className="w-full"
        style={{
          fontFamily: CASA_BRAND.fonts.body,
          borderColor: CASA_BRAND.colors.secondary.grayLight,
        }}
      >
        <Plus size={16} className="mr-2" />
        Agregar intercambio
      </Button>
    </div>
  );
};

/**
 * text-slide: titleText, bodyText
 */
const TextSlideForm: React.FC<SubtypeFormProps> = ({ config, onChange }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label style={{ fontFamily: CASA_BRAND.fonts.body, fontSize: '13px', color: CASA_BRAND.colors.secondary.grayDark }}>
        Título del slide
      </Label>
      <Input
        value={config.titleText || ''}
        onChange={(e) => onChange({ titleText: e.target.value })}
        placeholder="Título o encabezado (opcional)"
        style={{ fontFamily: CASA_BRAND.fonts.body }}
      />
    </div>
    <div className="space-y-2">
      <Label style={{ fontFamily: CASA_BRAND.fonts.body, fontSize: '13px', color: CASA_BRAND.colors.secondary.grayDark }}>
        Texto del slide
      </Label>
      <Textarea
        value={config.bodyText || ''}
        onChange={(e) => onChange({ bodyText: e.target.value })}
        placeholder="Escribe el contenido del slide..."
        rows={6}
        style={{ fontFamily: CASA_BRAND.fonts.body, fontSize: '14px' }}
      />
    </div>
  </div>
);

/**
 * blank-slide: backgroundColor color picker with hex input
 */
const BlankSlideForm: React.FC<SubtypeFormProps> = ({ config, onChange }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label style={{ fontFamily: CASA_BRAND.fonts.body, fontSize: '13px', color: CASA_BRAND.colors.secondary.grayDark }}>
        Color de fondo
      </Label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={config.backgroundColor || '#000000'}
          onChange={(e) => onChange({ backgroundColor: e.target.value })}
          className="w-10 h-10 rounded border cursor-pointer"
          style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
        />
        <Input
          value={config.backgroundColor || '#000000'}
          onChange={(e) => onChange({ backgroundColor: e.target.value })}
          placeholder="#000000"
          className="flex-1"
          style={{ fontFamily: CASA_BRAND.fonts.body, fontSize: '14px' }}
        />
      </div>
    </div>
  </div>
);

export default CustomElementEditor;
