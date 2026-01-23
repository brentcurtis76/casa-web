/**
 * SlideStrip - Tira de miniaturas de slides
 * Permite navegacion rapida entre slides
 * Soporta menú contextual para editar, duplicar, eliminar
 */

import React, { useRef, useEffect, useState } from 'react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { UniversalSlide } from '@/components/liturgia-builder/UniversalSlide';
import { CASA_BRAND } from '@/lib/brand-kit';
import { Image as ImageIcon, Pencil, Copy, Trash2, Type, Clock } from 'lucide-react';
import type { Slide } from '@/types/shared/slide';
import type { LogoSettings, TempSlideEdit, TextOverlay } from '@/lib/presentation/types';

interface SlideStripProps {
  slides: Slide[];
  currentIndex: number;
  liveIndex?: number;
  isLive?: boolean;
  onSlideClick: (index: number) => void;
  logoOverrides?: Record<number, Partial<LogoSettings>>;
  textOverlayOverrides?: Record<number, Partial<TextOverlay>[]>;
  tempEdits?: Record<string, TempSlideEdit>;
  onEdit?: (index: number) => void;
  onDuplicate?: (index: number) => void;
  onDelete?: (index: number) => void;
}

const THUMBNAIL_SCALE = 0.12;

export const SlideStrip: React.FC<SlideStripProps> = ({
  slides,
  currentIndex,
  liveIndex,
  isLive = false,
  onSlideClick,
  logoOverrides = {},
  textOverlayOverrides = {},
  tempEdits = {},
  onEdit,
  onDuplicate,
  onDelete,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; index: number } | null>(null);

  // Scroll to active slide
  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      activeRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [currentIndex]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    // Calculate if menu would go off bottom of screen
    // Menu is approximately 130px tall (3 items * ~40px each)
    const menuHeight = 130;
    const windowHeight = window.innerHeight;
    const y = e.clientY + menuHeight > windowHeight
      ? e.clientY - menuHeight  // Position above click if would overflow
      : e.clientY;
    setContextMenu({ x: e.clientX, y, index });
  };

  return (
    <div
      className="h-full"
      style={{
        backgroundColor: CASA_BRAND.colors.secondary.carbon,
        borderTop: `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
      }}
    >
      <ScrollArea className="w-full h-full" ref={scrollRef}>
        <div className="flex items-center gap-2 p-2">
          {slides.map((slide, index) => {
            const isPreview = index === currentIndex;
            const isLiveSlide = liveIndex !== undefined && index === liveIndex;
            const hasLogoOverride = index in logoOverrides;
            const hasTextOverlayOverride = index in textOverlayOverrides && textOverlayOverrides[index].length > 0;
            const hasEdit = slide.id in tempEdits;
            const isTempSlide = slide.id.startsWith('temp-');

            // Determine outline style based on preview/live status
            let outlineStyle = '2px solid transparent';
            if (isPreview && isLiveSlide) {
              // Both preview and live on same slide
              outlineStyle = `3px solid ${CASA_BRAND.colors.primary.amber}`;
            } else if (isPreview) {
              // Preview only (amber)
              outlineStyle = `3px solid ${CASA_BRAND.colors.primary.amber}`;
            } else if (isLiveSlide && isLive) {
              // Live only (red)
              outlineStyle = `3px solid #ef4444`;
            }

            return (
              <button
                key={slide.id}
                ref={isPreview ? activeRef : null}
                onClick={() => onSlideClick(index)}
                onDoubleClick={() => onEdit?.(index)}
                onContextMenu={(e) => handleContextMenu(e, index)}
                className="flex-shrink-0 relative rounded overflow-hidden transition-all"
                style={{
                  outline: outlineStyle,
                  outlineOffset: '2px',
                  opacity: isPreview || isLiveSlide ? 1 : 0.7,
                }}
              >
                <UniversalSlide
                  slide={slide}
                  scale={THUMBNAIL_SCALE}
                  showIndicator={false}
                />

                {/* Edit indicator */}
                {hasEdit && (
                  <div
                    className="absolute top-1 left-1 p-0.5 rounded"
                    style={{
                      backgroundColor: '#22c55e',
                    }}
                    title="Slide editado"
                  >
                    <Pencil size={8} color={CASA_BRAND.colors.primary.white} />
                  </div>
                )}

                {/* Logo override indicator */}
                {hasLogoOverride && (
                  <div
                    className="absolute top-1 right-1 p-0.5 rounded"
                    style={{
                      backgroundColor: CASA_BRAND.colors.primary.amber,
                    }}
                    title="Logo override activo"
                  >
                    <ImageIcon size={8} color={CASA_BRAND.colors.primary.black} />
                  </div>
                )}

                {/* Text overlay override indicator */}
                {hasTextOverlayOverride && (
                  <div
                    className="absolute top-1 p-0.5 rounded"
                    style={{
                      backgroundColor: '#3b82f6',
                      right: hasLogoOverride ? '24px' : '4px',
                    }}
                    title="Texto override activo"
                  >
                    <Type size={8} color={CASA_BRAND.colors.primary.white} />
                  </div>
                )}

                {/* Live indicator */}
                {isLiveSlide && isLive && (
                  <div
                    className="absolute top-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-xs"
                    style={{
                      backgroundColor: '#ef4444',
                      color: CASA_BRAND.colors.primary.white,
                      fontFamily: CASA_BRAND.fonts.body,
                      fontSize: '8px',
                      fontWeight: 700,
                    }}
                  >
                    LIVE
                  </div>
                )}

                {/* Temp slide indicator */}
                {isTempSlide && (
                  <div
                    className="absolute bottom-1 left-1 p-0.5 rounded flex items-center gap-0.5"
                    style={{
                      backgroundColor: CASA_BRAND.colors.primary.amber + 'CC',
                    }}
                    title="Diapositiva temporal (solo esta sesión)"
                  >
                    <Clock size={8} color={CASA_BRAND.colors.primary.black} />
                  </div>
                )}

                {/* Slide number overlay */}
                <div
                  className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-xs"
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    color: CASA_BRAND.colors.primary.white,
                    fontFamily: CASA_BRAND.fonts.body,
                    fontSize: '10px',
                    fontWeight: 600,
                  }}
                >
                  {index + 1}
                </div>
              </button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 rounded-lg shadow-lg overflow-hidden"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            backgroundColor: CASA_BRAND.colors.secondary.carbon,
            border: `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
          }}
        >
          <button
            onClick={() => {
              onEdit?.(contextMenu.index);
              setContextMenu(null);
            }}
            className="flex items-center gap-2 w-full px-4 py-2 hover:bg-gray-700 transition-colors text-left"
            style={{
              color: CASA_BRAND.colors.primary.white,
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
            }}
          >
            <Pencil size={14} />
            Editar
          </button>
          <button
            onClick={() => {
              onDuplicate?.(contextMenu.index);
              setContextMenu(null);
            }}
            className="flex items-center gap-2 w-full px-4 py-2 hover:bg-gray-700 transition-colors text-left"
            style={{
              color: CASA_BRAND.colors.primary.white,
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
            }}
          >
            <Copy size={14} />
            Duplicar
          </button>
          {slides.length > 1 && (
            <button
              onClick={() => {
                onDelete?.(contextMenu.index);
                setContextMenu(null);
              }}
              className="flex items-center gap-2 w-full px-4 py-2 hover:bg-red-900/50 transition-colors text-left"
              style={{
                color: '#ef4444',
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '14px',
              }}
            >
              <Trash2 size={14} />
              Eliminar
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SlideStrip;
