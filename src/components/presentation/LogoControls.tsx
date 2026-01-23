/**
 * LogoControls - Panel de control del logo en PresenterView
 * Permite ajustar posición, tamaño y visibilidad del logo
 *
 * SISTEMA SIMPLIFICADO (v2):
 * - settings: configuración visual (visible, position, size)
 * - scope: dónde se aplica (all o elements)
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
  Globe,
  Layers,
} from 'lucide-react';
import type { LogoState, LogoSettings, LogoPosition, FlattenedElement, OverlayScope } from '@/lib/presentation/types';
import { getScopeLabel, shouldShowLogo } from '@/lib/presentation/types';
import type { Slide } from '@/types/shared/slide';
import { ApplyScopeDropdown } from './ApplyScopeDropdown';

// Path to CASA logo
const CASA_LOGO_PATH = '/lovable-uploads/47301834-0831-465c-ae5e-47a978038312.png';

interface LogoControlsProps {
  logoState: LogoState;
  currentSlideIndex: number;
  currentSlide: Slide | null;
  /** Elemento actual (el que contiene el slide actual) */
  currentElement: FlattenedElement | null;
  /** Lista de todos los elementos */
  elements: FlattenedElement[];
  /** Actualiza la configuración del logo */
  onUpdateLogo: (settings: Partial<LogoSettings>) => void;
  /** Cambia el scope del logo */
  onSetScope: (scope: OverlayScope) => void;
  /** When true, renders without header/expand (for use inside CollapsiblePanel) */
  compact?: boolean;
}

export const LogoControls: React.FC<LogoControlsProps> = ({
  logoState,
  currentSlideIndex,
  currentSlide,
  currentElement,
  elements,
  onUpdateLogo,
  onSetScope,
  compact = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // Configuración actual del logo
  const { settings, scope } = logoState;

  // Label descriptivo del scope actual
  const scopeLabel = getScopeLabel(scope, elements);

  // ¿El logo es visible en el slide actual? (basado en scope)
  const isVisibleOnCurrentSlide = shouldShowLogo(logoState, currentSlideIndex, elements);

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

      onUpdateLogo({ position: newPosition });
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
  }, [onUpdateLogo]);

  // Handle size change
  const handleSizeChange = (value: number[]) => {
    onUpdateLogo({ size: value[0] });
  };

  // Handle visibility toggle for current slide/element
  // This toggle controls whether the logo shows on the CURRENT slide
  const handleVisibilityChange = (shouldShow: boolean) => {
    if (shouldShow) {
      // Turn ON: Enable visibility if not already, and ensure current element is in scope
      if (!settings.visible) {
        onUpdateLogo({ visible: true });
      }

      // If scope is 'elements' and current element is not included, add it
      if (scope.type === 'elements' && currentElement) {
        if (!scope.elementIds.includes(currentElement.id)) {
          onSetScope({ type: 'elements', elementIds: [...scope.elementIds, currentElement.id] });
        }
      } else if (scope.type === 'element' && currentElement) {
        // If scope is single element and it's different, switch to current
        if (scope.elementId !== currentElement.id) {
          onSetScope({ type: 'element', elementId: currentElement.id });
        }
      } else if (scope.type === 'slide') {
        // If scope is single slide and it's different, switch to current
        if (scope.slideIndex !== currentSlideIndex) {
          onSetScope({ type: 'slide', slideIndex: currentSlideIndex });
        }
      }
      // If scope is 'all' and visibility is on, logo will show (no change needed)
    } else {
      // Turn OFF: Remove current element/slide from scope
      if (scope.type === 'all') {
        // Switching from 'all' to all elements except current
        if (currentElement) {
          const otherElementIds = elements
            .filter(e => e.id !== currentElement.id)
            .map(e => e.id);
          onSetScope({ type: 'elements', elementIds: otherElementIds });
        }
      } else if (scope.type === 'elements' && currentElement) {
        // Remove current element from the list
        const newIds = scope.elementIds.filter(id => id !== currentElement.id);
        onSetScope({ type: 'elements', elementIds: newIds });
      } else if (scope.type === 'element') {
        // Single element scope - set to no elements
        onSetScope({ type: 'elements', elementIds: [] });
      } else if (scope.type === 'slide') {
        // Single slide scope - set to no elements
        onSetScope({ type: 'elements', elementIds: [] });
      }
    }
  };

  // Preview dimensions (4:3 aspect ratio)
  const previewWidth = 200;
  const previewHeight = 150;
  const logoPreviewSize = (settings.size / 100) * previewWidth;
  const logoPreviewX = (settings.position.x / 100) * previewWidth - logoPreviewSize / 2;
  const logoPreviewY = (settings.position.y / 100) * previewHeight - logoPreviewSize / 2;

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

          {/* Logo preview - shows based on current slide visibility */}
          {isVisibleOnCurrentSlide && (
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

      {/* Visibility toggle - shows if logo is visible on CURRENT slide */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '13px',
              color: CASA_BRAND.colors.primary.white,
            }}
          >
            Mostrar en este elemento
          </span>
          {currentElement && (
            <span
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '11px',
                color: CASA_BRAND.colors.secondary.grayMedium,
              }}
            >
              {currentElement.title}
            </span>
          )}
        </div>
        <Switch
          checked={isVisibleOnCurrentSlide}
          onCheckedChange={handleVisibilityChange}
          className="border-2 data-[state=unchecked]:bg-gray-700"
          style={{
            borderColor: isVisibleOnCurrentSlide ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.secondary.grayMedium,
            backgroundColor: isVisibleOnCurrentSlide ? CASA_BRAND.colors.primary.amber : undefined,
          }}
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
            {settings.size}%
          </span>
        </div>
        <Slider
          value={[settings.size]}
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
        Posición: ({settings.position.x}%, {settings.position.y}%)
      </div>

      {/* Scope indicator */}
      <div
        className="flex items-center gap-2 p-2 rounded"
        style={{
          backgroundColor: CASA_BRAND.colors.primary.black,
        }}
      >
        {scope.type === 'all' ? (
          <Globe size={14} style={{ color: CASA_BRAND.colors.secondary.grayMedium }} />
        ) : (
          <Layers size={14} style={{ color: CASA_BRAND.colors.primary.amber }} />
        )}
        <span
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '12px',
            color: scope.type === 'all'
              ? CASA_BRAND.colors.secondary.grayMedium
              : CASA_BRAND.colors.primary.amber,
          }}
        >
          {scopeLabel}
        </span>
      </div>

      {/* Scope dropdown */}
      <ApplyScopeDropdown
        elements={elements}
        currentElement={currentElement}
        currentSlideIndex={currentSlideIndex}
        onApply={onSetScope}
        currentScope={scope}
        buttonText="Cambiar alcance..."
        variant="outline"
        compact
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
            Logo CASA
          </span>
          {scope.type === 'elements' && (
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{
                backgroundColor: CASA_BRAND.colors.primary.amber + '30',
                color: CASA_BRAND.colors.primary.amber,
              }}
            >
              {scope.elementIds.length} elementos
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
