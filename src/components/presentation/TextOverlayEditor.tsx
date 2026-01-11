/**
 * TextOverlayEditor - Modal para agregar/editar text overlays
 * Permite configurar contenido, estilo y posición
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { CASA_BRAND } from '@/lib/brand-kit';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Save,
  X,
} from 'lucide-react';
import type {
  TextOverlay,
  TextOverlayStyle,
  TextOverlayColor,
  TextOverlaySize,
} from '@/lib/presentation/types';
import { DEFAULT_TEXT_OVERLAY_STYLE, TEXT_OVERLAY_SIZES } from '@/lib/presentation/types';

interface TextOverlayEditorProps {
  open: boolean;
  onClose: () => void;
  overlay?: TextOverlay | null;
  onSave: (content: string, style: TextOverlayStyle) => void;
}

// Color options from brand kit
const COLOR_OPTIONS: { value: TextOverlayColor; label: string; color: string }[] = [
  { value: 'primary-white', label: 'Blanco', color: CASA_BRAND.colors.primary.white },
  { value: 'primary-black', label: 'Negro', color: CASA_BRAND.colors.primary.black },
  { value: 'primary-amber', label: 'Dorado', color: CASA_BRAND.colors.primary.amber },
  { value: 'secondary-carbon', label: 'Carbon', color: CASA_BRAND.colors.secondary.carbon },
  { value: 'secondary-gray', label: 'Gris', color: CASA_BRAND.colors.secondary.grayDark },
];

// Size options
const SIZE_OPTIONS: { value: TextOverlaySize; label: string }[] = [
  { value: 'sm', label: 'Pequeno' },
  { value: 'md', label: 'Mediano' },
  { value: 'lg', label: 'Grande' },
  { value: 'xl', label: 'Extra Grande' },
];

// Font options
const FONT_OPTIONS: { value: 'heading' | 'body'; label: string }[] = [
  { value: 'heading', label: 'Titulo (Merriweather)' },
  { value: 'body', label: 'Cuerpo (Montserrat)' },
];

export const TextOverlayEditor: React.FC<TextOverlayEditorProps> = ({
  open,
  onClose,
  overlay,
  onSave,
}) => {
  const [content, setContent] = useState('');
  const [style, setStyle] = useState<TextOverlayStyle>(DEFAULT_TEXT_OVERLAY_STYLE);

  // Load overlay data when editing
  useEffect(() => {
    if (overlay) {
      setContent(overlay.content);
      setStyle(overlay.style);
    } else {
      setContent('');
      setStyle(DEFAULT_TEXT_OVERLAY_STYLE);
    }
  }, [overlay, open]);

  const handleSave = () => {
    if (!content.trim()) return;
    onSave(content, style);
    onClose();
  };

  const updateStyle = (updates: Partial<TextOverlayStyle>) => {
    setStyle((prev) => ({ ...prev, ...updates }));
  };

  // Get color value for preview
  const getColorValue = (color: TextOverlayColor): string => {
    const option = COLOR_OPTIONS.find((o) => o.value === color);
    return option?.color || CASA_BRAND.colors.primary.white;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
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
            {overlay ? 'Editar Texto' : 'Agregar Texto'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Content textarea */}
          <div className="space-y-2">
            <Label
              style={{
                color: CASA_BRAND.colors.primary.white,
                fontFamily: CASA_BRAND.fonts.body,
              }}
            >
              Contenido
            </Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              placeholder="Escribe el texto aqui..."
              className="resize-none"
              style={{
                backgroundColor: CASA_BRAND.colors.primary.black,
                color: CASA_BRAND.colors.primary.white,
                borderColor: CASA_BRAND.colors.secondary.grayDark,
                fontFamily: CASA_BRAND.fonts.body,
              }}
            />
          </div>

          {/* Font selector */}
          <div className="space-y-2">
            <Label
              style={{
                color: CASA_BRAND.colors.primary.white,
                fontFamily: CASA_BRAND.fonts.body,
              }}
            >
              Fuente
            </Label>
            <div className="flex gap-2">
              {FONT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => updateStyle({ font: option.value })}
                  className="flex-1 px-3 py-2 rounded transition-colors"
                  style={{
                    backgroundColor:
                      style.font === option.value
                        ? CASA_BRAND.colors.primary.amber
                        : CASA_BRAND.colors.primary.black,
                    color:
                      style.font === option.value
                        ? CASA_BRAND.colors.primary.black
                        : CASA_BRAND.colors.primary.white,
                    fontFamily:
                      option.value === 'heading'
                        ? CASA_BRAND.fonts.heading
                        : CASA_BRAND.fonts.body,
                    fontSize: '13px',
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Size selector */}
          <div className="space-y-2">
            <Label
              style={{
                color: CASA_BRAND.colors.primary.white,
                fontFamily: CASA_BRAND.fonts.body,
              }}
            >
              Tamano
            </Label>
            <div className="flex gap-2">
              {SIZE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => updateStyle({ size: option.value })}
                  className="flex-1 px-3 py-2 rounded transition-colors"
                  style={{
                    backgroundColor:
                      style.size === option.value
                        ? CASA_BRAND.colors.primary.amber
                        : CASA_BRAND.colors.primary.black,
                    color:
                      style.size === option.value
                        ? CASA_BRAND.colors.primary.black
                        : CASA_BRAND.colors.primary.white,
                    fontFamily: CASA_BRAND.fonts.body,
                    fontSize: '13px',
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Color selector */}
          <div className="space-y-2">
            <Label
              style={{
                color: CASA_BRAND.colors.primary.white,
                fontFamily: CASA_BRAND.fonts.body,
              }}
            >
              Color del Texto
            </Label>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => updateStyle({ color: option.value })}
                  className="w-10 h-10 rounded-full transition-all"
                  style={{
                    backgroundColor: option.color,
                    border:
                      style.color === option.value
                        ? `3px solid ${CASA_BRAND.colors.primary.amber}`
                        : `2px solid ${CASA_BRAND.colors.secondary.grayDark}`,
                  }}
                  title={option.label}
                />
              ))}
            </div>
          </div>

          {/* Background selector */}
          <div className="space-y-2">
            <Label
              style={{
                color: CASA_BRAND.colors.primary.white,
                fontFamily: CASA_BRAND.fonts.body,
              }}
            >
              Fondo
            </Label>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => updateStyle({ backgroundColor: 'none' })}
                className="px-4 py-2 rounded transition-colors"
                style={{
                  backgroundColor:
                    style.backgroundColor === 'none'
                      ? CASA_BRAND.colors.primary.amber
                      : CASA_BRAND.colors.primary.black,
                  color:
                    style.backgroundColor === 'none'
                      ? CASA_BRAND.colors.primary.black
                      : CASA_BRAND.colors.primary.white,
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '13px',
                }}
              >
                Sin fondo
              </button>
              {COLOR_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => updateStyle({ backgroundColor: option.value })}
                  className="w-10 h-10 rounded transition-all"
                  style={{
                    backgroundColor: option.color,
                    border:
                      style.backgroundColor === option.value
                        ? `3px solid ${CASA_BRAND.colors.primary.amber}`
                        : `2px solid ${CASA_BRAND.colors.secondary.grayDark}`,
                  }}
                  title={option.label}
                />
              ))}
            </div>

            {/* Background opacity slider */}
            {style.backgroundColor && style.backgroundColor !== 'none' && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-2">
                  <span
                    style={{
                      fontFamily: CASA_BRAND.fonts.body,
                      fontSize: '12px',
                      color: CASA_BRAND.colors.secondary.grayMedium,
                    }}
                  >
                    Opacidad del fondo
                  </span>
                  <span
                    style={{
                      fontFamily: CASA_BRAND.fonts.body,
                      fontSize: '12px',
                      color: CASA_BRAND.colors.secondary.grayMedium,
                    }}
                  >
                    {Math.round((style.backgroundOpacity ?? 0.7) * 100)}%
                  </span>
                </div>
                <Slider
                  value={[(style.backgroundOpacity ?? 0.7) * 100]}
                  onValueChange={(v) => updateStyle({ backgroundOpacity: v[0] / 100 })}
                  min={10}
                  max={100}
                  step={5}
                  className="w-full"
                  trackClassName="bg-gray-700"
                  rangeClassName="bg-white"
                  thumbClassName="border-white bg-gray-900"
                />
              </div>
            )}
          </div>

          {/* Alignment */}
          <div className="space-y-2">
            <Label
              style={{
                color: CASA_BRAND.colors.primary.white,
                fontFamily: CASA_BRAND.fonts.body,
              }}
            >
              Alineacion
            </Label>
            <div className="flex gap-2">
              {[
                { value: 'left', icon: AlignLeft },
                { value: 'center', icon: AlignCenter },
                { value: 'right', icon: AlignRight },
              ].map(({ value, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => updateStyle({ align: value as 'left' | 'center' | 'right' })}
                  className="p-3 rounded transition-colors"
                  style={{
                    backgroundColor:
                      style.align === value
                        ? CASA_BRAND.colors.primary.amber
                        : CASA_BRAND.colors.primary.black,
                    color:
                      style.align === value
                        ? CASA_BRAND.colors.primary.black
                        : CASA_BRAND.colors.primary.white,
                  }}
                >
                  <Icon size={18} />
                </button>
              ))}
            </div>
          </div>

          {/* Bold/Italic toggles */}
          <div className="space-y-2">
            <Label
              style={{
                color: CASA_BRAND.colors.primary.white,
                fontFamily: CASA_BRAND.fonts.body,
              }}
            >
              Estilo
            </Label>
            <div className="flex gap-2">
              <button
                onClick={() => updateStyle({ bold: !style.bold })}
                className="p-3 rounded transition-colors"
                style={{
                  backgroundColor: style.bold
                    ? CASA_BRAND.colors.primary.amber
                    : CASA_BRAND.colors.primary.black,
                  color: style.bold
                    ? CASA_BRAND.colors.primary.black
                    : CASA_BRAND.colors.primary.white,
                }}
              >
                <Bold size={18} />
              </button>
              <button
                onClick={() => updateStyle({ italic: !style.italic })}
                className="p-3 rounded transition-colors"
                style={{
                  backgroundColor: style.italic
                    ? CASA_BRAND.colors.primary.amber
                    : CASA_BRAND.colors.primary.black,
                  color: style.italic
                    ? CASA_BRAND.colors.primary.black
                    : CASA_BRAND.colors.primary.white,
                }}
              >
                <Italic size={18} />
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label
              style={{
                color: CASA_BRAND.colors.primary.white,
                fontFamily: CASA_BRAND.fonts.body,
              }}
            >
              Vista Previa
            </Label>
            <div
              className="p-8 rounded-lg flex items-center justify-center min-h-[120px]"
              style={{
                backgroundColor: CASA_BRAND.colors.secondary.grayDark,
              }}
            >
              <div
                style={{
                  fontFamily:
                    style.font === 'heading'
                      ? CASA_BRAND.fonts.heading
                      : CASA_BRAND.fonts.body,
                  fontSize: TEXT_OVERLAY_SIZES[style.size],
                  color: getColorValue(style.color),
                  fontWeight: style.bold ? 700 : 400,
                  fontStyle: style.italic ? 'italic' : 'normal',
                  textAlign: style.align,
                  backgroundColor:
                    style.backgroundColor && style.backgroundColor !== 'none'
                      ? `${getColorValue(style.backgroundColor as TextOverlayColor)}${Math.round(
                          (style.backgroundOpacity ?? 0.7) * 255
                        )
                          .toString(16)
                          .padStart(2, '0')}`
                      : 'transparent',
                  padding:
                    style.backgroundColor && style.backgroundColor !== 'none'
                      ? '0.5em 1em'
                      : 0,
                  borderRadius:
                    style.backgroundColor && style.backgroundColor !== 'none'
                      ? '0.25em'
                      : 0,
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.3,
                }}
              >
                {content || 'Texto de ejemplo'}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="gap-2 hover:bg-white/10"
            style={{
              borderColor: CASA_BRAND.colors.secondary.grayMedium,
              backgroundColor: CASA_BRAND.colors.secondary.grayDark,
              color: CASA_BRAND.colors.primary.white,
            }}
          >
            <X size={16} />
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!content.trim()}
            className="gap-2"
            style={{
              backgroundColor: CASA_BRAND.colors.primary.amber,
              color: CASA_BRAND.colors.primary.black,
            }}
          >
            <Save size={16} />
            {overlay ? 'Guardar Cambios' : 'Agregar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TextOverlayEditor;
