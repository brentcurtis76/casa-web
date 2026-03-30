/**
 * CustomElementEditor - Editor para elementos personalizados
 * Despacha el formulario correcto según el customType del elemento
 */

import React, { useState, useCallback } from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import { Save, Trash2, Plus, Minus } from 'lucide-react';
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

  const handleSave = useCallback(() => {
    const slides = customElementToSlides(config, { theme });
    onUpdate(config, slides);
  }, [config, theme, onUpdate]);

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
 * image-slide: title, subtitle, imageUrl, imageConfig sliders
 */
const ImageSlideForm: React.FC<SubtypeFormProps> = ({ config, onChange }) => (
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
    <div className="space-y-2">
      <Label style={{ fontFamily: CASA_BRAND.fonts.body, fontSize: '13px', color: CASA_BRAND.colors.secondary.grayDark }}>
        URL de imagen
      </Label>
      <Input
        value={config.imageUrl || ''}
        onChange={(e) => onChange({ imageUrl: e.target.value })}
        placeholder="https://ejemplo.com/imagen.jpg"
        type="url"
        style={{ fontFamily: CASA_BRAND.fonts.body }}
      />
    </div>
    {/* Image config sliders */}
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
  </div>
);

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
 * text-slide: bodyText textarea
 */
const TextSlideForm: React.FC<SubtypeFormProps> = ({ config, onChange }) => (
  <div className="space-y-4">
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
