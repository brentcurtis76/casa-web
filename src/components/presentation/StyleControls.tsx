/**
 * StyleControls - Panel de control de estilos en vivo
 * Permite ajustar fuentes, colores y fondos durante la presentación
 */

import React, { useState, useCallback, useEffect } from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Palette,
  Type,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  RotateCcw,
} from 'lucide-react';
import type {
  SlideStyles,
  StyleState,
  StyleScope,
  FontStyles,
  TextBackgroundStyles,
  SlideBackgroundStyles,
  FlattenedElement,
} from '@/lib/presentation/types';
import {
  STYLE_COLORS,
  FONT_FAMILIES,
  DEFAULT_SLIDE_STYLES,
  getResolvedStyles,
} from '@/lib/presentation/types';
import type { Slide } from '@/types/shared/slide';

interface StyleControlsProps {
  styleState: StyleState;
  currentSlide: Slide | null;
  currentSlideIndex: number;
  currentElement: FlattenedElement | null;
  /** Aplica estilos al scope seleccionado */
  onApplyStyles: (styles: SlideStyles, scope: StyleScope) => void;
  /** Restablece estilos del scope seleccionado */
  onResetStyles: (scope: StyleScope) => void;
}

export const StyleControls: React.FC<StyleControlsProps> = ({
  styleState,
  currentSlide,
  currentSlideIndex,
  currentElement,
  onApplyStyles,
  onResetStyles,
}) => {
  // Get resolved styles for the current slide to show current values
  const resolvedStyles = currentSlide
    ? getResolvedStyles(styleState, currentSlide.id, currentElement?.id ?? null)
    : DEFAULT_SLIDE_STYLES;

  // Local state for editing (before applying)
  const [fontFamily, setFontFamily] = useState(resolvedStyles.font?.family ?? 'Montserrat');
  const [fontSize, setFontSize] = useState(resolvedStyles.font?.size ?? 40);
  const [fontColor, setFontColor] = useState(resolvedStyles.font?.color ?? '#FFFFFF');
  const [bold, setBold] = useState(resolvedStyles.font?.bold ?? false);
  const [italic, setItalic] = useState(resolvedStyles.font?.italic ?? false);
  const [align, setAlign] = useState<'left' | 'center' | 'right'>(resolvedStyles.font?.align ?? 'center');

  const [textBgStyle, setTextBgStyle] = useState<'none' | 'solid' | 'semi-transparent' | 'gradient'>(
    resolvedStyles.textBackground?.style ?? 'none'
  );
  const [textBgColor, setTextBgColor] = useState(resolvedStyles.textBackground?.color ?? '#000000');
  const [textBgOpacity, setTextBgOpacity] = useState(resolvedStyles.textBackground?.opacity ?? 70);
  const [textBgPadding, setTextBgPadding] = useState(resolvedStyles.textBackground?.padding ?? 16);

  const [slideBgOverlay, setSlideBgOverlay] = useState(resolvedStyles.slideBackground?.overlayOpacity ?? 0);

  const [scope, setScope] = useState<StyleScope>('slide');

  // Sync local state when resolved styles change (e.g., when slide changes)
  useEffect(() => {
    setFontFamily(resolvedStyles.font?.family ?? 'Montserrat');
    setFontSize(resolvedStyles.font?.size ?? 40);
    setFontColor(resolvedStyles.font?.color ?? '#FFFFFF');
    setBold(resolvedStyles.font?.bold ?? false);
    setItalic(resolvedStyles.font?.italic ?? false);
    setAlign(resolvedStyles.font?.align ?? 'center');
    setTextBgStyle(resolvedStyles.textBackground?.style ?? 'none');
    setTextBgColor(resolvedStyles.textBackground?.color ?? '#000000');
    setTextBgOpacity(resolvedStyles.textBackground?.opacity ?? 70);
    setTextBgPadding(resolvedStyles.textBackground?.padding ?? 16);
    setSlideBgOverlay(resolvedStyles.slideBackground?.overlayOpacity ?? 0);
  }, [currentSlide?.id, currentElement?.id, styleState]);

  // Build styles object from local state
  const buildStyles = useCallback((): SlideStyles => {
    return {
      font: {
        family: fontFamily,
        size: fontSize,
        color: fontColor,
        bold,
        italic,
        align,
      },
      textBackground: {
        style: textBgStyle,
        color: textBgColor,
        opacity: textBgOpacity,
        padding: textBgPadding,
      },
      slideBackground: {
        overlayOpacity: slideBgOverlay,
      },
    };
  }, [fontFamily, fontSize, fontColor, bold, italic, align, textBgStyle, textBgColor, textBgOpacity, textBgPadding, slideBgOverlay]);

  // Handle apply
  const handleApply = () => {
    onApplyStyles(buildStyles(), scope);
  };

  // Handle reset
  const handleReset = () => {
    onResetStyles(scope);
    // Reset local state to defaults using DEFAULT_SLIDE_STYLES constants
    setFontFamily(DEFAULT_SLIDE_STYLES.font?.family ?? 'Montserrat');
    setFontSize(DEFAULT_SLIDE_STYLES.font?.size ?? 40);
    setFontColor(DEFAULT_SLIDE_STYLES.font?.color ?? '#FFFFFF');
    setBold(DEFAULT_SLIDE_STYLES.font?.bold ?? false);
    setItalic(DEFAULT_SLIDE_STYLES.font?.italic ?? false);
    setAlign(DEFAULT_SLIDE_STYLES.font?.align ?? 'center');
    setTextBgStyle(DEFAULT_SLIDE_STYLES.textBackground?.style ?? 'none');
    setTextBgColor(DEFAULT_SLIDE_STYLES.textBackground?.color ?? '#000000');
    setTextBgOpacity(DEFAULT_SLIDE_STYLES.textBackground?.opacity ?? 70);
    setTextBgPadding(DEFAULT_SLIDE_STYLES.textBackground?.padding ?? 16);
    setSlideBgOverlay(DEFAULT_SLIDE_STYLES.slideBackground?.overlayOpacity ?? 0);
  };

  // Color options for picker
  const colorOptions = Object.entries(STYLE_COLORS).map(([key, value]) => ({
    key,
    value,
    label: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
  }));

  return (
    <div className="space-y-4">
      {/* FUENTE Section */}
      <div className="space-y-3">
        <h4
          className="text-xs font-semibold uppercase tracking-wider border-b pb-1"
          style={{
            color: CASA_BRAND.colors.secondary.grayMedium,
            borderColor: CASA_BRAND.colors.secondary.grayDark,
          }}
        >
          Fuente
        </h4>

        {/* Font Family */}
        <div className="space-y-1">
          <Label
            className="text-xs"
            style={{ color: CASA_BRAND.colors.secondary.grayLight }}
          >
            Familia
          </Label>
          <Select value={fontFamily} onValueChange={setFontFamily}>
            <SelectTrigger
              className="h-8"
              style={{
                backgroundColor: CASA_BRAND.colors.primary.black,
                borderColor: CASA_BRAND.colors.secondary.grayDark,
                color: CASA_BRAND.colors.primary.white,
              }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              style={{
                backgroundColor: CASA_BRAND.colors.secondary.carbon,
                borderColor: CASA_BRAND.colors.secondary.grayDark,
              }}
            >
              {FONT_FAMILIES.map((font) => (
                <SelectItem
                  key={font.value}
                  value={font.value}
                  style={{ color: CASA_BRAND.colors.primary.white }}
                >
                  <span style={{ fontFamily: font.value }}>{font.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Font Size */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label
              className="text-xs"
              style={{ color: CASA_BRAND.colors.secondary.grayLight }}
            >
              Tamaño
            </Label>
            <span
              className="text-xs"
              style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
            >
              {fontSize}pt
            </span>
          </div>
          <Slider
            value={[fontSize]}
            onValueChange={(v) => setFontSize(v[0])}
            min={24}
            max={72}
            step={2}
            className="w-full"
            trackClassName="bg-gray-700"
            rangeClassName="bg-white"
            thumbClassName="border-white bg-gray-900"
          />
        </div>

        {/* Font Color */}
        <div className="space-y-1">
          <Label
            className="text-xs"
            style={{ color: CASA_BRAND.colors.secondary.grayLight }}
          >
            Color
          </Label>
          <Select value={fontColor} onValueChange={setFontColor}>
            <SelectTrigger
              className="h-8"
              style={{
                backgroundColor: CASA_BRAND.colors.primary.black,
                borderColor: CASA_BRAND.colors.secondary.grayDark,
                color: CASA_BRAND.colors.primary.white,
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: fontColor, border: '1px solid #555' }}
                />
                <span>{colorOptions.find((c) => c.value === fontColor)?.label || fontColor}</span>
              </div>
            </SelectTrigger>
            <SelectContent
              style={{
                backgroundColor: CASA_BRAND.colors.secondary.carbon,
                borderColor: CASA_BRAND.colors.secondary.grayDark,
              }}
            >
              {colorOptions.map((color) => (
                <SelectItem
                  key={color.key}
                  value={color.value}
                  style={{ color: CASA_BRAND.colors.primary.white }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: color.value, border: '1px solid #555' }}
                    />
                    <span>{color.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Bold/Italic and Alignment */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className={`w-8 h-8 p-0 ${bold ? 'bg-white/20' : ''}`}
              onClick={() => setBold(!bold)}
              aria-label={bold ? 'Desactivar negrita' : 'Activar negrita'}
              style={{
                borderColor: bold ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.secondary.grayDark,
              }}
            >
              <Bold size={14} style={{ color: bold ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.primary.white }} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={`w-8 h-8 p-0 ${italic ? 'bg-white/20' : ''}`}
              onClick={() => setItalic(!italic)}
              aria-label={italic ? 'Desactivar cursiva' : 'Activar cursiva'}
              style={{
                borderColor: italic ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.secondary.grayDark,
              }}
            >
              <Italic size={14} style={{ color: italic ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.primary.white }} />
            </Button>
          </div>

          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className={`w-8 h-8 p-0 ${align === 'left' ? 'bg-white/20' : ''}`}
              onClick={() => setAlign('left')}
              aria-label="Alinear a la izquierda"
              style={{
                borderColor: align === 'left' ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.secondary.grayDark,
              }}
            >
              <AlignLeft size={14} style={{ color: align === 'left' ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.primary.white }} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={`w-8 h-8 p-0 ${align === 'center' ? 'bg-white/20' : ''}`}
              onClick={() => setAlign('center')}
              aria-label="Centrar texto"
              style={{
                borderColor: align === 'center' ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.secondary.grayDark,
              }}
            >
              <AlignCenter size={14} style={{ color: align === 'center' ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.primary.white }} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={`w-8 h-8 p-0 ${align === 'right' ? 'bg-white/20' : ''}`}
              onClick={() => setAlign('right')}
              aria-label="Alinear a la derecha"
              style={{
                borderColor: align === 'right' ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.secondary.grayDark,
              }}
            >
              <AlignRight size={14} style={{ color: align === 'right' ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.primary.white }} />
            </Button>
          </div>
        </div>
      </div>

      {/* FONDO DEL TEXTO Section */}
      <div className="space-y-3">
        <h4
          className="text-xs font-semibold uppercase tracking-wider border-b pb-1"
          style={{
            color: CASA_BRAND.colors.secondary.grayMedium,
            borderColor: CASA_BRAND.colors.secondary.grayDark,
          }}
        >
          Fondo del Texto
        </h4>

        {/* Background Style */}
        <div className="space-y-1">
          <Label
            className="text-xs"
            style={{ color: CASA_BRAND.colors.secondary.grayLight }}
          >
            Estilo
          </Label>
          <Select value={textBgStyle} onValueChange={(v) => setTextBgStyle(v as typeof textBgStyle)}>
            <SelectTrigger
              className="h-8"
              style={{
                backgroundColor: CASA_BRAND.colors.primary.black,
                borderColor: CASA_BRAND.colors.secondary.grayDark,
                color: CASA_BRAND.colors.primary.white,
              }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              style={{
                backgroundColor: CASA_BRAND.colors.secondary.carbon,
                borderColor: CASA_BRAND.colors.secondary.grayDark,
              }}
            >
              <SelectItem value="none" style={{ color: CASA_BRAND.colors.primary.white }}>
                Ninguno
              </SelectItem>
              <SelectItem value="solid" style={{ color: CASA_BRAND.colors.primary.white }}>
                Sólido
              </SelectItem>
              <SelectItem value="semi-transparent" style={{ color: CASA_BRAND.colors.primary.white }}>
                Semi-transparente
              </SelectItem>
              <SelectItem value="gradient" style={{ color: CASA_BRAND.colors.primary.white }}>
                Gradiente
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Only show these when background is enabled */}
        {textBgStyle !== 'none' && (
          <>
            {/* Background Color */}
            <div className="space-y-1">
              <Label
                className="text-xs"
                style={{ color: CASA_BRAND.colors.secondary.grayLight }}
              >
                Color
              </Label>
              <Select value={textBgColor} onValueChange={setTextBgColor}>
                <SelectTrigger
                  className="h-8"
                  style={{
                    backgroundColor: CASA_BRAND.colors.primary.black,
                    borderColor: CASA_BRAND.colors.secondary.grayDark,
                    color: CASA_BRAND.colors.primary.white,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: textBgColor, border: '1px solid #555' }}
                    />
                    <span>{colorOptions.find((c) => c.value === textBgColor)?.label || textBgColor}</span>
                  </div>
                </SelectTrigger>
                <SelectContent
                  style={{
                    backgroundColor: CASA_BRAND.colors.secondary.carbon,
                    borderColor: CASA_BRAND.colors.secondary.grayDark,
                  }}
                >
                  {colorOptions.map((color) => (
                    <SelectItem
                      key={color.key}
                      value={color.value}
                      style={{ color: CASA_BRAND.colors.primary.white }}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: color.value, border: '1px solid #555' }}
                        />
                        <span>{color.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Opacity */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label
                  className="text-xs"
                  style={{ color: CASA_BRAND.colors.secondary.grayLight }}
                >
                  Opacidad
                </Label>
                <span
                  className="text-xs"
                  style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                >
                  {textBgOpacity}%
                </span>
              </div>
              <Slider
                value={[textBgOpacity]}
                onValueChange={(v) => setTextBgOpacity(v[0])}
                min={0}
                max={100}
                step={5}
                className="w-full"
                trackClassName="bg-gray-700"
                rangeClassName="bg-white"
                thumbClassName="border-white bg-gray-900"
              />
            </div>

            {/* Padding */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label
                  className="text-xs"
                  style={{ color: CASA_BRAND.colors.secondary.grayLight }}
                >
                  Padding
                </Label>
                <span
                  className="text-xs"
                  style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                >
                  {textBgPadding}px
                </span>
              </div>
              <Slider
                value={[textBgPadding]}
                onValueChange={(v) => setTextBgPadding(v[0])}
                min={8}
                max={32}
                step={4}
                className="w-full"
                trackClassName="bg-gray-700"
                rangeClassName="bg-white"
                thumbClassName="border-white bg-gray-900"
              />
            </div>
          </>
        )}
      </div>

      {/* FONDO DE DIAPOSITIVA Section */}
      <div className="space-y-3">
        <h4
          className="text-xs font-semibold uppercase tracking-wider border-b pb-1"
          style={{
            color: CASA_BRAND.colors.secondary.grayMedium,
            borderColor: CASA_BRAND.colors.secondary.grayDark,
          }}
        >
          Fondo de Diapositiva
        </h4>

        {/* Overlay Opacity */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label
              className="text-xs"
              style={{ color: CASA_BRAND.colors.secondary.grayLight }}
            >
              Opacidad overlay
            </Label>
            <span
              className="text-xs"
              style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
            >
              {slideBgOverlay}%
            </span>
          </div>
          <Slider
            value={[slideBgOverlay]}
            onValueChange={(v) => setSlideBgOverlay(v[0])}
            min={0}
            max={60}
            step={5}
            className="w-full"
            trackClassName="bg-gray-700"
            rangeClassName="bg-white"
            thumbClassName="border-white bg-gray-900"
          />
        </div>
      </div>

      {/* APLICAR A Section */}
      <div className="space-y-3">
        <h4
          className="text-xs font-semibold uppercase tracking-wider border-b pb-1"
          style={{
            color: CASA_BRAND.colors.secondary.grayMedium,
            borderColor: CASA_BRAND.colors.secondary.grayDark,
          }}
        >
          Aplicar A
        </h4>

        <RadioGroup
          value={scope}
          onValueChange={(v) => setScope(v as StyleScope)}
          className="space-y-2"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="slide" id="scope-slide" />
            <Label
              htmlFor="scope-slide"
              className="text-sm cursor-pointer"
              style={{ color: CASA_BRAND.colors.secondary.grayLight }}
            >
              Diapositiva actual
              {currentSlide && (
                <span className="text-xs ml-1" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                  (#{currentSlideIndex + 1})
                </span>
              )}
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="element" id="scope-element" />
            <Label
              htmlFor="scope-element"
              className="text-sm cursor-pointer"
              style={{ color: CASA_BRAND.colors.secondary.grayLight }}
            >
              Este elemento
              {currentElement && (
                <span className="text-xs ml-1" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                  ({currentElement.title})
                </span>
              )}
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="all" id="scope-all" />
            <Label
              htmlFor="scope-all"
              className="text-sm cursor-pointer"
              style={{ color: CASA_BRAND.colors.secondary.grayLight }}
            >
              Toda la presentación
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2 border-t" style={{ borderColor: CASA_BRAND.colors.secondary.grayDark }}>
        <Button
          onClick={handleApply}
          className="flex-1 gap-2"
          style={{
            backgroundColor: CASA_BRAND.colors.primary.amber,
            color: CASA_BRAND.colors.primary.black,
          }}
        >
          <Palette size={14} />
          Aplicar cambios
        </Button>
        <Button
          variant="outline"
          onClick={handleReset}
          className="gap-2"
          style={{
            borderColor: CASA_BRAND.colors.secondary.grayDark,
            color: CASA_BRAND.colors.secondary.grayLight,
          }}
        >
          <RotateCcw size={14} />
          Restablecer
        </Button>
      </div>
    </div>
  );
};

export default StyleControls;
