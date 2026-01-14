/**
 * TextOverlayEditor - Modal para agregar/editar text overlays
 * Permite configurar contenido, estilo, posición y alcance (scope)
 *
 * SISTEMA SIMPLIFICADO (v2):
 * - Incluye selector de scope directamente en el editor
 * - Cada overlay define su propio alcance
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
  Globe,
  CheckSquare,
  FileText,
  Layers,
} from 'lucide-react';
import type {
  TextOverlay,
  TextOverlayStyle,
  TextOverlayColor,
  TextOverlaySize,
  OverlayScope,
  FlattenedElement,
} from '@/lib/presentation/types';
import { DEFAULT_TEXT_OVERLAY_STYLE, TEXT_OVERLAY_SIZES, getScopeLabel } from '@/lib/presentation/types';
import { ElementSelectorModal } from './ElementSelectorModal';

interface TextOverlayEditorProps {
  open: boolean;
  onClose: () => void;
  overlay?: TextOverlay | null;
  elements: FlattenedElement[];
  currentSlideIndex: number;
  currentElement: FlattenedElement | null;
  onSave: (content: string, style: TextOverlayStyle, scope: OverlayScope) => void;
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
  { value: 'sm', label: 'Pequeño' },
  { value: 'md', label: 'Mediano' },
  { value: 'lg', label: 'Grande' },
  { value: 'xl', label: 'Extra Grande' },
];

// Font options
const FONT_OPTIONS: { value: 'heading' | 'body'; label: string }[] = [
  { value: 'heading', label: 'Título (Merriweather)' },
  { value: 'body', label: 'Cuerpo (Montserrat)' },
];

export const TextOverlayEditor: React.FC<TextOverlayEditorProps> = ({
  open,
  onClose,
  overlay,
  elements,
  currentSlideIndex,
  currentElement,
  onSave,
}) => {
  const [content, setContent] = useState('');
  const [style, setStyle] = useState<TextOverlayStyle>(DEFAULT_TEXT_OVERLAY_STYLE);
  const [scope, setScope] = useState<OverlayScope>({ type: 'all' });
  const [selectorOpen, setSelectorOpen] = useState(false);

  // Load overlay data when editing
  useEffect(() => {
    if (overlay) {
      setContent(overlay.content);
      setStyle(overlay.style);
      setScope(overlay.scope);
    } else {
      setContent('');
      setStyle(DEFAULT_TEXT_OVERLAY_STYLE);
      setScope({ type: 'all' });
    }
  }, [overlay, open]);

  const handleSave = () => {
    if (!content.trim()) return;
    onSave(content, style, scope);
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

  // Get initial selected IDs for modal
  const getInitialSelectedIds = (): string[] => {
    if (scope.type === 'elements') {
      return scope.elementIds;
    }
    if (scope.type === 'all') {
      return elements.map((e) => e.id);
    }
    return [];
  };

  // Handle element selection from modal
  const handleElementsSelected = (elementIds: string[]) => {
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
  };

  return (
    <>
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
                placeholder="Escribe el texto aquí..."
                className="resize-none"
                style={{
                  backgroundColor: CASA_BRAND.colors.primary.black,
                  color: CASA_BRAND.colors.primary.white,
                  borderColor: CASA_BRAND.colors.secondary.grayDark,
                  fontFamily: CASA_BRAND.fonts.body,
                }}
              />
            </div>

            {/* Scope selector - 4 options */}
            <div className="space-y-2">
              <Label
                style={{
                  color: CASA_BRAND.colors.primary.white,
                  fontFamily: CASA_BRAND.fonts.body,
                }}
              >
                Aplicar a
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {/* 1. Diapositiva Actual */}
                <button
                  onClick={() => setScope({ type: 'slide', slideIndex: currentSlideIndex })}
                  className="px-3 py-2 rounded transition-colors flex items-center justify-center gap-2"
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
                    fontSize: '13px',
                    border:
                      scope.type === 'slide'
                        ? `2px solid ${CASA_BRAND.colors.primary.amber}`
                        : `2px solid transparent`,
                  }}
                >
                  <FileText size={16} />
                  Diapositiva actual
                </button>

                {/* 2. Elemento Actual */}
                <button
                  onClick={() => {
                    if (currentElement) {
                      setScope({ type: 'element', elementId: currentElement.id });
                    }
                  }}
                  disabled={!currentElement}
                  className="px-3 py-2 rounded transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
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
                    fontSize: '13px',
                    border:
                      scope.type === 'element'
                        ? `2px solid ${CASA_BRAND.colors.primary.amber}`
                        : `2px solid transparent`,
                  }}
                >
                  <Layers size={16} />
                  Elemento actual
                </button>

                {/* 3. Seleccionar Elementos */}
                <button
                  onClick={() => setSelectorOpen(true)}
                  className="px-3 py-2 rounded transition-colors flex items-center justify-center gap-2"
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
                    fontSize: '13px',
                    border:
                      scope.type === 'elements'
                        ? `2px solid ${CASA_BRAND.colors.primary.amber}`
                        : `2px solid transparent`,
                  }}
                >
                  <CheckSquare size={16} />
                  {scope.type === 'elements'
                    ? getScopeLabel(scope, elements)
                    : 'Seleccionar elementos...'}
                </button>

                {/* 4. Toda la Presentación */}
                <button
                  onClick={() => setScope({ type: 'all' })}
                  className="px-3 py-2 rounded transition-colors flex items-center justify-center gap-2"
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
                    fontSize: '13px',
                    border:
                      scope.type === 'all'
                        ? `2px solid ${CASA_BRAND.colors.primary.amber}`
                        : `2px solid transparent`,
                  }}
                >
                  <Globe size={16} />
                  Toda la presentación
                </button>
              </div>
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
                {FONT_OPTIONS.map((option) => {
                  const isSelected = style.font === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() => updateStyle({ font: option.value })}
                      className="flex-1 px-3 py-2 rounded transition-colors"
                      style={{
                        backgroundColor: isSelected
                          ? CASA_BRAND.colors.primary.amber
                          : CASA_BRAND.colors.primary.black,
                        color: isSelected
                          ? CASA_BRAND.colors.primary.black
                          : CASA_BRAND.colors.primary.white,
                        fontFamily:
                          option.value === 'heading'
                            ? CASA_BRAND.fonts.heading
                            : CASA_BRAND.fonts.body,
                        fontSize: '13px',
                        border: isSelected
                          ? `2px solid ${CASA_BRAND.colors.primary.amber}`
                          : `2px solid transparent`,
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
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
                Tamaño
              </Label>
              <div className="flex gap-2">
                {SIZE_OPTIONS.map((option) => {
                  const isSelected = style.size === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() => updateStyle({ size: option.value })}
                      className="flex-1 px-3 py-2 rounded transition-colors"
                      style={{
                        backgroundColor: isSelected
                          ? CASA_BRAND.colors.primary.amber
                          : CASA_BRAND.colors.primary.black,
                        color: isSelected
                          ? CASA_BRAND.colors.primary.black
                          : CASA_BRAND.colors.primary.white,
                        fontFamily: CASA_BRAND.fonts.body,
                        fontSize: '13px',
                        border: isSelected
                          ? `2px solid ${CASA_BRAND.colors.primary.amber}`
                          : `2px solid transparent`,
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
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
                Alineación
              </Label>
              <div className="flex gap-2">
                {[
                  { value: 'left', icon: AlignLeft },
                  { value: 'center', icon: AlignCenter },
                  { value: 'right', icon: AlignRight },
                ].map(({ value, icon: Icon }) => {
                  const isSelected = style.align === value;
                  return (
                    <button
                      key={value}
                      onClick={() => updateStyle({ align: value as 'left' | 'center' | 'right' })}
                      className="p-3 rounded transition-colors"
                      style={{
                        backgroundColor: isSelected
                          ? CASA_BRAND.colors.primary.amber
                          : CASA_BRAND.colors.primary.black,
                        color: isSelected
                          ? CASA_BRAND.colors.primary.black
                          : CASA_BRAND.colors.primary.white,
                        border: isSelected
                          ? `2px solid ${CASA_BRAND.colors.primary.amber}`
                          : `2px solid transparent`,
                      }}
                    >
                      <Icon size={18} />
                    </button>
                  );
                })}
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
                    border: style.bold
                      ? `2px solid ${CASA_BRAND.colors.primary.amber}`
                      : `2px solid transparent`,
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
                    border: style.italic
                      ? `2px solid ${CASA_BRAND.colors.primary.amber}`
                      : `2px solid transparent`,
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
                className="p-8 rounded-lg flex items-center min-h-[120px]"
                style={{
                  backgroundColor: CASA_BRAND.colors.secondary.grayDark,
                }}
              >
                <div
                  style={{
                    width: '100%',
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

      {/* Element selector modal */}
      <ElementSelectorModal
        open={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        elements={elements}
        onSelect={handleElementsSelected}
        initialSelected={getInitialSelectedIds()}
      />
    </>
  );
};

export default TextOverlayEditor;
