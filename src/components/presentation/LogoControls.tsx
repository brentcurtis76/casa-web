/**
 * LogoControls - Panel de control del logo en PresenterView
 * Permite ajustar posición, tamaño y visibilidad del logo
 * Soporta configuración global y overrides por slide
 * Soporta modo compact para uso dentro de CollapsiblePanel
 */

import React, { useState, useRef, useCallback } from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  RotateCcw,
  Check,
  Globe,
  FileText,
} from 'lucide-react';
import type { LogoState, LogoSettings, LogoPosition } from '@/lib/presentation/types';
import type { Slide } from '@/types/shared/slide';

// Path to CASA logo
const CASA_LOGO_PATH = '/lovable-uploads/47301834-0831-465c-ae5e-47a978038312.png';

interface LogoControlsProps {
  logoState: LogoState;
  currentSlideIndex: number;
  currentSlide: Slide | null;
  onUpdateGlobal: (settings: Partial<LogoSettings>) => void;
  onSetOverride: (slideIndex: number, settings: Partial<LogoSettings>) => void;
  onRemoveOverride: (slideIndex: number) => void;
  onApplyToAll: (settings: LogoSettings) => void;
  /** When true, renders without header/expand (for use inside CollapsiblePanel) */
  compact?: boolean;
}

export const LogoControls: React.FC<LogoControlsProps> = ({
  logoState,
  currentSlideIndex,
  currentSlide,
  onUpdateGlobal,
  onSetOverride,
  onRemoveOverride,
  onApplyToAll,
  compact = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // Check if current slide has an override
  const hasOverride = currentSlideIndex in logoState.overrides;
  const currentOverride = logoState.overrides[currentSlideIndex];

  // Get effective settings for current slide
  const effectiveSettings: LogoSettings = {
    visible: currentOverride?.visible ?? logoState.global.visible,
    position: currentOverride?.position ?? logoState.global.position,
    size: currentOverride?.size ?? logoState.global.size,
  };

  // Handle drag on preview
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!previewRef.current) return;
    setIsDragging(true);

    const updatePosition = (clientX: number, clientY: number) => {
      if (!previewRef.current) return;
      const rect = previewRef.current.getBoundingClientRect();

      // Calculate position as percentage
      const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));

      const newPosition: LogoPosition = {
        x: Math.round(x),
        y: Math.round(y),
      };

      // If we have an override, update the override; otherwise update global
      if (hasOverride) {
        onSetOverride(currentSlideIndex, { position: newPosition });
      } else {
        onUpdateGlobal({ position: newPosition });
      }
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      updatePosition(moveEvent.clientX, moveEvent.clientY);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    // Initial position update
    updatePosition(e.clientX, e.clientY);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [hasOverride, currentSlideIndex, onSetOverride, onUpdateGlobal]);

  // Handle size change
  const handleSizeChange = (value: number[]) => {
    const newSize = value[0];
    if (hasOverride) {
      onSetOverride(currentSlideIndex, { size: newSize });
    } else {
      onUpdateGlobal({ size: newSize });
    }
  };

  // Handle visibility toggle
  const handleVisibilityChange = (visible: boolean) => {
    if (hasOverride) {
      onSetOverride(currentSlideIndex, { visible });
    } else {
      onUpdateGlobal({ visible });
    }
  };

  // Apply current settings to this slide only
  const handleApplyToSlide = () => {
    onSetOverride(currentSlideIndex, {
      visible: effectiveSettings.visible,
      position: effectiveSettings.position,
      size: effectiveSettings.size,
    });
  };

  // Preview dimensions (4:3 aspect ratio)
  const previewWidth = 200;
  const previewHeight = 150;
  const logoPreviewSize = (effectiveSettings.size / 100) * previewWidth;
  const logoPreviewX = (effectiveSettings.position.x / 100) * previewWidth - logoPreviewSize / 2;
  const logoPreviewY = (effectiveSettings.position.y / 100) * previewHeight - logoPreviewSize / 2;

  const content = (
    <div className="space-y-4">
          {/* Mini preview with draggable logo */}
          <div>
            <p
              className="text-xs mb-2"
              style={{
                color: CASA_BRAND.colors.secondary.grayMedium,
                fontFamily: CASA_BRAND.fonts.body,
              }}
            >
              Arrastra el logo para reposicionar
            </p>
            <div
              ref={previewRef}
              onMouseDown={handleMouseDown}
              className="relative rounded-lg overflow-hidden cursor-crosshair"
              style={{
                width: previewWidth,
                height: previewHeight,
                backgroundColor: currentSlide?.style?.backgroundColor || CASA_BRAND.colors.primary.white,
                border: isDragging
                  ? `2px solid ${CASA_BRAND.colors.primary.amber}`
                  : `2px solid ${CASA_BRAND.colors.secondary.grayDark}`,
              }}
            >
              {/* Slide content preview (simplified) */}
              <div
                className="absolute inset-0 flex items-center justify-center text-xs"
                style={{
                  color: CASA_BRAND.colors.secondary.grayMedium,
                  fontFamily: CASA_BRAND.fonts.body,
                }}
              >
                {currentSlide?.content?.primary?.substring(0, 30) || 'Slide Preview'}
              </div>

              {/* Logo preview */}
              {effectiveSettings.visible && (
                <img
                  src={CASA_LOGO_PATH}
                  alt="Logo"
                  style={{
                    position: 'absolute',
                    left: Math.max(0, Math.min(previewWidth - logoPreviewSize, logoPreviewX)),
                    top: Math.max(0, Math.min(previewHeight - logoPreviewSize, logoPreviewY)),
                    width: logoPreviewSize,
                    height: logoPreviewSize,
                    opacity: 0.85,
                    pointerEvents: 'none',
                    objectFit: 'contain',
                  }}
                />
              )}
            </div>
          </div>

          {/* Visibility toggle */}
          <div className="flex items-center justify-between">
            <span
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '13px',
                color: CASA_BRAND.colors.primary.white,
              }}
            >
              Mostrar Logo
            </span>
            <Switch
              checked={effectiveSettings.visible}
              onCheckedChange={handleVisibilityChange}
              className="data-[state=checked]:bg-white data-[state=unchecked]:bg-gray-700"
              thumbClassName="border-2 border-gray-400"
            />
          </div>

          {/* Size slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '13px',
                  color: CASA_BRAND.colors.primary.white,
                }}
              >
                Tamaño
              </span>
              <span
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '12px',
                  color: CASA_BRAND.colors.secondary.grayMedium,
                }}
              >
                {effectiveSettings.size}%
              </span>
            </div>
            <Slider
              value={[effectiveSettings.size]}
              onValueChange={handleSizeChange}
              min={5}
              max={25}
              step={1}
              className="w-full"
              trackClassName="bg-gray-700"
              rangeClassName="bg-white"
              thumbClassName="border-white bg-gray-900"
            />
          </div>

          {/* Position info */}
          <div
            className="text-xs"
            style={{
              color: CASA_BRAND.colors.secondary.grayMedium,
              fontFamily: CASA_BRAND.fonts.body,
            }}
          >
            Posición: ({effectiveSettings.position.x}%, {effectiveSettings.position.y}%)
          </div>

          {/* Mode indicator */}
          <div
            className="flex items-center gap-2 p-2 rounded"
            style={{
              backgroundColor: CASA_BRAND.colors.primary.black,
            }}
          >
            {hasOverride ? (
              <>
                <FileText size={14} style={{ color: CASA_BRAND.colors.primary.amber }} />
                <span
                  style={{
                    fontFamily: CASA_BRAND.fonts.body,
                    fontSize: '12px',
                    color: CASA_BRAND.colors.primary.amber,
                  }}
                >
                  Este slide (override)
                </span>
              </>
            ) : (
              <>
                <Globe size={14} style={{ color: CASA_BRAND.colors.secondary.grayMedium }} />
                <span
                  style={{
                    fontFamily: CASA_BRAND.fonts.body,
                    fontSize: '12px',
                    color: CASA_BRAND.colors.secondary.grayMedium,
                  }}
                >
                  Global (todos los slides)
                </span>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="space-y-2">
            {!hasOverride && (
              <Button
                onClick={handleApplyToSlide}
                variant="outline"
                size="sm"
                className="w-full gap-2 hover:bg-white/10"
                style={{
                  borderColor: CASA_BRAND.colors.secondary.grayMedium,
                  backgroundColor: CASA_BRAND.colors.secondary.grayDark,
                  color: CASA_BRAND.colors.primary.white,
                }}
              >
                <FileText size={14} />
                Aplicar solo a este slide
              </Button>
            )}

            {hasOverride && (
              <Button
                onClick={() => onRemoveOverride(currentSlideIndex)}
                variant="outline"
                size="sm"
                className="w-full gap-2 hover:bg-white/10"
                style={{
                  borderColor: CASA_BRAND.colors.secondary.grayMedium,
                  backgroundColor: CASA_BRAND.colors.secondary.grayDark,
                  color: CASA_BRAND.colors.primary.white,
                }}
              >
                <RotateCcw size={14} />
                Restablecer a global
              </Button>
            )}

            <Button
              onClick={() => onApplyToAll(effectiveSettings)}
              variant="outline"
              size="sm"
              className="w-full gap-2 hover:bg-white/10"
              style={{
                borderColor: CASA_BRAND.colors.secondary.grayMedium,
                backgroundColor: CASA_BRAND.colors.secondary.grayDark,
                color: CASA_BRAND.colors.primary.white,
              }}
            >
              <Check size={14} />
              Aplicar a todos
            </Button>
          </div>
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
            Logo CASA
          </span>
          {hasOverride && (
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{
                backgroundColor: CASA_BRAND.colors.primary.amber + '30',
                color: CASA_BRAND.colors.primary.amber,
              }}
            >
              Override
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

export default LogoControls;
