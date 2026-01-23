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
  AlertTriangle,
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

  // Track initial mount to skip auto-apply on first render
  const isFirstRenderRef = React.useRef(true);
  // Track if we're currently syncing from navigation (to skip auto-apply)
  const isSyncingFromNavigationRef = React.useRef(false);
  // Track if user has made any changes - only auto-apply after user interaction
  const [hasUserChanges, setHasUserChanges] = React.useState(false);
  // Debounce timer for slider performance
  const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Navigation key - ONLY changes when slide/element changes, NOT when styles change
  // This prevents the infinite loop caused by styleState in the dependency
  const navigationKey = `${currentSlide?.id ?? 'none'}-${currentElement?.id ?? 'none'}`;

  // Sync local state ONLY when navigating to a different slide/element
  useEffect(() => {
    // Mark that we're syncing from navigation to skip the auto-apply effect
    isSyncingFromNavigationRef.current = true;
    // Reset user changes flag when navigating to a new slide
    setHasUserChanges(false);

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

    // Reset the sync flag after React has processed the state updates
    // Using requestAnimationFrame to ensure it happens after the render cycle
    requestAnimationFrame(() => {
      isSyncingFromNavigationRef.current = false;
    });
  }, [navigationKey]); // Only depend on navigation, not resolvedStyles or styleState

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

  // Detect multi-color slides (slides with both primary and secondary content)
  // Moved above auto-apply effect so it can be used there
  const isMultiColorSlide = !!(currentSlide?.content?.secondary && currentSlide?.content?.primary);

  // Auto-apply styles in real-time with debounce for slider performance
  // Use refs to avoid triggering effect on every style change (which causes infinite loop)
  const onApplyStylesRef = React.useRef(onApplyStyles);
  onApplyStylesRef.current = onApplyStyles;
  const buildStylesRef = React.useRef(buildStyles);
  buildStylesRef.current = buildStyles;
  const scopeRef = React.useRef(scope);
  scopeRef.current = scope;

  useEffect(() => {
    // Skip on initial mount
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }

    // Skip if we're syncing from navigation (don't auto-apply when initializing controls)
    if (isSyncingFromNavigationRef.current) {
      return;
    }

    // Skip if user hasn't made any changes yet - don't apply defaults on navigation
    if (!hasUserChanges) {
      return;
    }

    // Skip auto-apply for multi-color slides - require manual "Aplicar cambios"
    // This prevents accidentally unifying distinct text colors
    if (isMultiColorSlide) {
      return;
    }

    // Clear any pending debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce the apply call for smooth slider performance
    debounceTimerRef.current = setTimeout(() => {
      const styles = buildStylesRef.current();
      onApplyStylesRef.current(styles, scopeRef.current);
    }, 50);

    // Cleanup on unmount or before next effect run
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
    // Only trigger when user makes changes or slide type changes
    // Using refs for callbacks/builders to avoid infinite loops
  }, [isMultiColorSlide, hasUserChanges, fontFamily, fontSize, fontColor, bold, italic, align, textBgStyle, textBgColor, textBgOpacity, textBgPadding, slideBgOverlay]);

  // Handle manual apply (button click) - still useful for explicit confirmation
  const handleApply = () => {
    // Clear any pending debounce to apply immediately
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    const styles = buildStyles();
    onApplyStyles(styles, scope);
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
      {/* Warning about temporary styles */}
      <div
        className="flex items-start gap-2 p-2 rounded text-xs"
        style={{
          backgroundColor: `${CASA_BRAND.colors.primary.amber}15`,
          border: `1px solid ${CASA_BRAND.colors.primary.amber}40`,
        }}
      >
        <AlertTriangle
          size={14}
          className="flex-shrink-0 mt-0.5"
          style={{ color: CASA_BRAND.colors.primary.amber }}
        />
        <span style={{ color: CASA_BRAND.colors.secondary.grayLight }}>
          Los estilos son temporales (esta sesión). Los cambios se aplican a la vista previa y se sincronizan al proyector al publicar.
        </span>
      </div>

      {/* Warning for multi-color slides */}
      {isMultiColorSlide && (
        <div
          className="flex items-start gap-2 p-2 rounded text-xs"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
          }}
        >
          <AlertTriangle
            size={14}
            className="flex-shrink-0 mt-0.5"
            style={{ color: '#ef4444' }}
          />
          <span style={{ color: CASA_BRAND.colors.secondary.grayLight }}>
            Este slide tiene múltiples colores. Los cambios de color unificarán todo el texto. Use "Aplicar cambios" para confirmar.
          </span>
        </div>
      )}

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
          <Select value={fontFamily} onValueChange={(value) => { setFontFamily(value); setHasUserChanges(true); }}>
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
            onValueChange={(v) => { setFontSize(v[0]); setHasUserChanges(true); }}
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
          <Select value={fontColor} onValueChange={(value) => { setFontColor(value); setHasUserChanges(true); }}>
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
              variant="ghost"
              size="sm"
              className="w-8 h-8 p-0 [&_svg]:!size-3.5"
              onClick={() => { setBold(!bold); setHasUserChanges(true); }}
              aria-label={bold ? 'Desactivar negrita' : 'Activar negrita'}
              style={{
                border: `1px solid ${bold ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.secondary.grayDark}`,
                backgroundColor: bold ? 'rgba(255,255,255,0.1)' : 'transparent',
              }}
            >
              <Bold color={bold ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.primary.white} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-8 h-8 p-0 [&_svg]:!size-3.5"
              onClick={() => { setItalic(!italic); setHasUserChanges(true); }}
              aria-label={italic ? 'Desactivar cursiva' : 'Activar cursiva'}
              style={{
                border: `1px solid ${italic ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.secondary.grayDark}`,
                backgroundColor: italic ? 'rgba(255,255,255,0.1)' : 'transparent',
              }}
            >
              <Italic color={italic ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.primary.white} />
            </Button>
          </div>

          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-8 h-8 p-0 [&_svg]:!size-3.5"
              onClick={() => { setAlign('left'); setHasUserChanges(true); }}
              aria-label="Alinear a la izquierda"
              style={{
                border: `1px solid ${align === 'left' ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.secondary.grayDark}`,
                backgroundColor: align === 'left' ? 'rgba(255,255,255,0.1)' : 'transparent',
              }}
            >
              <AlignLeft color={align === 'left' ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.primary.white} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-8 h-8 p-0 [&_svg]:!size-3.5"
              onClick={() => { setAlign('center'); setHasUserChanges(true); }}
              aria-label="Centrar texto"
              style={{
                border: `1px solid ${align === 'center' ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.secondary.grayDark}`,
                backgroundColor: align === 'center' ? 'rgba(255,255,255,0.1)' : 'transparent',
              }}
            >
              <AlignCenter color={align === 'center' ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.primary.white} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-8 h-8 p-0 [&_svg]:!size-3.5"
              onClick={() => { setAlign('right'); setHasUserChanges(true); }}
              aria-label="Alinear a la derecha"
              style={{
                border: `1px solid ${align === 'right' ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.secondary.grayDark}`,
                backgroundColor: align === 'right' ? 'rgba(255,255,255,0.1)' : 'transparent',
              }}
            >
              <AlignRight color={align === 'right' ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.primary.white} />
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
          <Select value={textBgStyle} onValueChange={(v) => { setTextBgStyle(v as typeof textBgStyle); setHasUserChanges(true); }}>
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
              <Select value={textBgColor} onValueChange={(value) => { setTextBgColor(value); setHasUserChanges(true); }}>
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
                onValueChange={(v) => { setTextBgOpacity(v[0]); setHasUserChanges(true); }}
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
                onValueChange={(v) => { setTextBgPadding(v[0]); setHasUserChanges(true); }}
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
            onValueChange={(v) => { setSlideBgOverlay(v[0]); setHasUserChanges(true); }}
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
      <div className="pt-2 border-t space-y-2" style={{ borderColor: CASA_BRAND.colors.secondary.grayDark }}>
        <Button
          onClick={handleApply}
          className="w-full gap-2"
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
          className="w-full gap-2"
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
