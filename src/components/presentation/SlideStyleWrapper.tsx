/**
 * SlideStyleWrapper - Wrapper that applies live style overrides to slides
 * Wraps UniversalSlide to apply font, text background, and slide background styles
 */

import React from 'react';
import type { SlideStyles } from '@/lib/presentation/types';

interface SlideStyleWrapperProps {
  children: React.ReactNode;
  styles: SlideStyles | null;
  scale?: number;
}

/**
 * Generates CSS variables for style overrides that can be applied to slide text
 */
function getStyleOverrideCss(styles: SlideStyles, scale: number = 1): React.CSSProperties {
  // Validate scale to prevent weird CSS output
  const validScale = Math.max(0.1, scale);
  const css: React.CSSProperties = {};

  if (styles.font) {
    if (styles.font.family) {
      css['--slide-font-family'] = styles.font.family;
    }
    if (styles.font.size) {
      css['--slide-font-size'] = `${styles.font.size * validScale}px`;
    }
    if (styles.font.color) {
      css['--slide-font-color'] = styles.font.color;
    }
    if (styles.font.bold !== undefined) {
      css['--slide-font-weight'] = styles.font.bold ? '700' : '400';
    }
    if (styles.font.italic !== undefined) {
      css['--slide-font-style'] = styles.font.italic ? 'italic' : 'normal';
    }
    if (styles.font.align) {
      css['--slide-text-align'] = styles.font.align;
    }
  }

  return css;
}

/**
 * Gets overlay style for slide background darkening
 */
function getOverlayStyle(styles: SlideStyles): React.CSSProperties | null {
  if (!styles.slideBackground?.overlayOpacity || styles.slideBackground.overlayOpacity <= 0) {
    return null;
  }

  return {
    position: 'absolute' as const,
    inset: 0,
    backgroundColor: `rgba(0, 0, 0, ${styles.slideBackground.overlayOpacity / 100})`,
    pointerEvents: 'none' as const,
    zIndex: 1,
  };
}

/**
 * Gets text background style
 * Note: Text background is now applied directly inside UniversalSlide
 * This function is kept for potential future use but returns null
 */
function getTextBackgroundStyle(styles: SlideStyles, _scale: number = 1): React.CSSProperties | null {
  // Text background is now handled inside UniversalSlide component
  // to properly wrap around the text content
  if (!styles.textBackground || styles.textBackground.style === 'none') {
    return null;
  }
  // Return null - text background is applied in UniversalSlide
  return null;
}

export const SlideStyleWrapper: React.FC<SlideStyleWrapperProps> = ({
  children,
  styles,
  scale = 1,
}) => {
  // If no styles, just render children
  if (!styles) {
    return <>{children}</>;
  }

  const cssVars = getStyleOverrideCss(styles, scale);
  const overlayStyle = getOverlayStyle(styles);
  const textBgStyle = getTextBackgroundStyle(styles, scale);

  // If there are font overrides, apply them via CSS class
  const hasOverrides = Object.keys(cssVars).length > 0 || overlayStyle || textBgStyle;

  if (!hasOverrides) {
    return <>{children}</>;
  }

  return (
    <div className="slide-style-wrapper relative w-full h-full" style={cssVars as React.CSSProperties}>
      {/* Slide background overlay */}
      {overlayStyle && <div style={overlayStyle} />}

      {/* Main content with style overrides applied */}
      <div
        className="relative w-full h-full z-10"
        style={{
          fontFamily: 'var(--slide-font-family, inherit)',
          fontSize: 'var(--slide-font-size, inherit)',
          color: 'var(--slide-font-color, inherit)',
          fontWeight: 'var(--slide-font-weight, inherit)' as React.CSSProperties['fontWeight'],
          fontStyle: 'var(--slide-font-style, inherit)' as React.CSSProperties['fontStyle'],
          textAlign: 'var(--slide-text-align, inherit)' as React.CSSProperties['textAlign'],
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default SlideStyleWrapper;
