/**
 * NavigationStrip - Slide navigation controls
 * Extracted from header for cleaner separation of concerns
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { CASA_BRAND } from '@/lib/brand-kit';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Send,
  Check,
  Keyboard,
  Link,
  Unlink,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface NavigationStripProps {
  hasData: boolean;
  currentIndex: number;
  liveIndex: number;
  totalSlides: number;
  isLive: boolean;
  hasUnpublishedChanges: boolean;
  followMode: boolean;
  onNext: () => void;
  onPrev: () => void;
  onFirst: () => void;
  onLast: () => void;
  onPublish: () => void;
  onToggleFollowMode: () => void;
}

export const NavigationStrip: React.FC<NavigationStripProps> = ({
  hasData,
  currentIndex,
  liveIndex,
  totalSlides,
  isLive,
  hasUnpublishedChanges,
  followMode,
  onNext,
  onPrev,
  onFirst,
  onLast,
  onPublish,
  onToggleFollowMode,
}) => {
  return (
    <div
      className="h-12 flex items-center justify-center gap-4 flex-shrink-0"
      style={{
        backgroundColor: CASA_BRAND.colors.secondary.carbon,
        borderBottom: `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
      }}
    >
      {/* Navigation buttons - First/Prev */}
      <div className="flex items-center gap-1">
        <Button
          onClick={onFirst}
          disabled={!hasData || currentIndex === 0}
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          title="Primer slide (Home)"
          aria-label="Primer slide (Home)"
        >
          <ChevronsLeft size={18} />
        </Button>

        <Button
          onClick={onPrev}
          disabled={!hasData || currentIndex === 0}
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          title="Diapositiva anterior (←)"
          aria-label="Diapositiva anterior"
        >
          <ChevronLeft size={18} />
        </Button>
      </div>

      {/* Slide counter */}
      <div className="flex flex-col items-center gap-0.5">
        <span
          className="px-4 py-1.5 rounded-md min-w-[120px] text-center"
          style={{
            backgroundColor: CASA_BRAND.colors.primary.black,
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
            fontWeight: 600,
            color: CASA_BRAND.colors.primary.amber,
            border: `1px solid ${CASA_BRAND.colors.primary.amber}40`,
          }}
          title="Vista previa"
        >
          {hasData ? `${currentIndex + 1} / ${totalSlides}` : '— / —'}
        </span>
        {/* Live indicator - only shows if different from preview */}
        {isLive && currentIndex !== liveIndex && (
          <span
            className="text-xs"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              color: '#ef4444',
            }}
          >
            EN VIVO: {liveIndex + 1}
          </span>
        )}
      </div>

      {/* Navigation buttons - Next/Last */}
      <div className="flex items-center gap-1">
        <Button
          onClick={onNext}
          disabled={!hasData || currentIndex >= totalSlides - 1}
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          title="Siguiente diapositiva (→)"
          aria-label="Siguiente diapositiva"
        >
          <ChevronRight size={18} />
        </Button>

        <Button
          onClick={onLast}
          disabled={!hasData || currentIndex >= totalSlides - 1}
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          title="Última diapositiva (End)"
          aria-label="Última diapositiva"
        >
          <ChevronsRight size={18} />
        </Button>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-gray-600" />

      {/* Publish button */}
      <Button
        onClick={onPublish}
        disabled={!hasData || !hasUnpublishedChanges}
        className="gap-2 transition-all duration-200 h-9 px-4"
        style={{
          backgroundColor: hasUnpublishedChanges
            ? CASA_BRAND.colors.primary.amber
            : CASA_BRAND.colors.secondary.grayDark,
          color: hasUnpublishedChanges
            ? CASA_BRAND.colors.primary.black
            : CASA_BRAND.colors.secondary.grayMedium,
          boxShadow: hasUnpublishedChanges
            ? `0 0 12px ${CASA_BRAND.colors.primary.amber}60`
            : 'none',
          animation: hasUnpublishedChanges ? 'publishGlow 2s ease-in-out infinite' : 'none',
        }}
        title="Publicar cambios al proyector (Enter o P)"
        aria-label="Publicar cambios al proyector"
      >
        {hasUnpublishedChanges ? <Send size={14} /> : <Check size={14} />}
        <span className="text-sm">
          {hasUnpublishedChanges ? 'Publicar' : 'Sincronizado'}
        </span>
      </Button>

      {/* Follow Mode toggle */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleFollowMode}
              className="h-8 px-2 gap-1.5 transition-colors"
              style={{
                color: followMode ? '#22c55e' : CASA_BRAND.colors.secondary.grayMedium,
              }}
              aria-label={followMode ? 'Desactivar modo seguimiento' : 'Activar modo seguimiento'}
            >
              {followMode ? <Link size={14} /> : <Unlink size={14} />}
              <span className="text-xs">{followMode ? 'Siguiendo' : 'Manual'}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            style={{
              backgroundColor: CASA_BRAND.colors.secondary.carbon,
              borderColor: CASA_BRAND.colors.secondary.grayDark,
              color: CASA_BRAND.colors.primary.white,
            }}
          >
            <p className="text-xs">
              {followMode
                ? 'Modo Seguimiento: La navegación se sincroniza automáticamente'
                : 'Modo Manual: Use "Publicar" para mostrar cambios'
              }
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Keyboard hints */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="p-1.5 rounded hover:bg-gray-700/50 transition-colors"
              style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
              aria-label="Mostrar atajos de teclado"
            >
              <Keyboard size={14} />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            style={{
              backgroundColor: CASA_BRAND.colors.secondary.carbon,
              borderColor: CASA_BRAND.colors.secondary.grayDark,
              color: CASA_BRAND.colors.primary.white,
            }}
          >
            <div className="text-xs space-y-1 p-1">
              <p><kbd className="px-1 bg-gray-700 rounded">←</kbd> <kbd className="px-1 bg-gray-700 rounded">→</kbd> Navegar slides</p>
              <p><kbd className="px-1 bg-gray-700 rounded">Home</kbd> <kbd className="px-1 bg-gray-700 rounded">End</kbd> Primero / Último</p>
              <p><kbd className="px-1 bg-gray-700 rounded">B</kbd> Pantalla negra</p>
              <p><kbd className="px-1 bg-gray-700 rounded">Enter</kbd> / <kbd className="px-1 bg-gray-700 rounded">P</kbd> Publicar</p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export default NavigationStrip;
