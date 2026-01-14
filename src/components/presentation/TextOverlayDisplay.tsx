/**
 * TextOverlayDisplay - Renderiza un text overlay en la vista de salida
 * Aplica estilos del brand kit y posicionamiento porcentual
 */

import React from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import type { TextOverlay, TextOverlayColor } from '@/lib/presentation/types';
import { TEXT_OVERLAY_SIZES } from '@/lib/presentation/types';

interface TextOverlayDisplayProps {
  overlay: TextOverlay;
  slideWidth: number;
  slideHeight: number;
  /** Whether this overlay is currently being dragged */
  isDragging?: boolean;
  /** Show hidden overlays (visible: false) with preview styling - for presenter view */
  showHidden?: boolean;
}

/**
 * Convierte un color del tipo TextOverlayColor a su valor CSS
 */
function getColorValue(color: TextOverlayColor): string {
  switch (color) {
    case 'primary-black':
      return CASA_BRAND.colors.primary.black;
    case 'primary-amber':
      return CASA_BRAND.colors.primary.amber;
    case 'primary-white':
      return CASA_BRAND.colors.primary.white;
    case 'secondary-carbon':
      return CASA_BRAND.colors.secondary.carbon;
    case 'secondary-gray':
      return CASA_BRAND.colors.secondary.grayDark;
    default:
      return CASA_BRAND.colors.primary.white;
  }
}

export const TextOverlayDisplay: React.FC<TextOverlayDisplayProps> = ({
  overlay,
  slideWidth,
  slideHeight,
  isDragging = false,
  showHidden = false,
}) => {
  // If not visible and not showing hidden overlays, don't render
  if (!overlay.visible && !showHidden) return null;

  const isHiddenPreview = !overlay.visible && showHidden;
  const { content, position, style } = overlay;

  // Calcular posición en píxeles
  const x = (position.x / 100) * slideWidth;
  const y = (position.y / 100) * slideHeight;

  // Obtener valores de estilo
  const fontFamily = style.font === 'heading' ? CASA_BRAND.fonts.heading : CASA_BRAND.fonts.body;
  const fontSize = TEXT_OVERLAY_SIZES[style.size];
  const textColor = getColorValue(style.color);
  const hasBackground = style.backgroundColor && style.backgroundColor !== 'none';
  const backgroundColor = hasBackground
    ? getColorValue(style.backgroundColor as TextOverlayColor)
    : 'transparent';
  const backgroundOpacity = style.backgroundOpacity ?? 0.7;

  // Calcular transform basado en alineación
  let translateX = '-50%'; // default center
  if (style.align === 'left') translateX = '0%';
  if (style.align === 'right') translateX = '-100%';

  return (
    <div
      className="absolute"
      style={{
        left: x,
        top: y,
        transform: `translate(${translateX}, -50%)`,
        zIndex: isDragging ? 100 : 10,
        pointerEvents: 'auto',
        opacity: isHiddenPreview ? 0.5 : 1,
      }}
    >
      <div
        style={{
          fontFamily,
          fontSize,
          color: textColor,
          fontWeight: style.bold ? 700 : 400,
          fontStyle: style.italic ? 'italic' : 'normal',
          textAlign: style.align,
          backgroundColor: hasBackground
            ? `rgba(${hexToRgb(backgroundColor)}, ${backgroundOpacity})`
            : 'transparent',
          padding: hasBackground ? '0.5em 1em' : 0,
          borderRadius: hasBackground ? '0.25em' : 0,
          whiteSpace: 'pre-wrap',
          lineHeight: 1.3,
          outline: isDragging
            ? `2px solid ${CASA_BRAND.colors.primary.amber}`
            : isHiddenPreview
            ? `2px dashed ${CASA_BRAND.colors.secondary.grayMedium}`
            : 'none',
          outlineOffset: '4px',
          boxShadow: isDragging ? `0 0 20px ${CASA_BRAND.colors.primary.amber}40` : 'none',
        }}
      >
        {content}
      </div>
    </div>
  );
};

/**
 * Convierte hex a RGB para usar con rgba()
 */
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '0, 0, 0';
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}

export default TextOverlayDisplay;
