/**
 * PresenterControls - Controles principales del presentador
 * Go Live, Black, Open Output, navegacion
 */

import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { CASA_BRAND } from '@/lib/brand-kit';
import {
  Play,
  Square,
  Monitor,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ImagePlus,
} from 'lucide-react';

interface PresenterControlsProps {
  isLive: boolean;
  isBlack: boolean;
  hasData: boolean;
  currentIndex: number;
  totalSlides: number;
  onGoLive: () => void;
  onToggleBlack: () => void;
  onOpenOutput: () => void;
  onNext: () => void;
  onPrev: () => void;
  onFirst: () => void;
  onLast: () => void;
  onImportImages?: (files: FileList) => void;
}

export const PresenterControls: React.FC<PresenterControlsProps> = ({
  isLive,
  isBlack,
  hasData,
  currentIndex,
  totalSlides,
  onGoLive,
  onToggleBlack,
  onOpenOutput,
  onNext,
  onPrev,
  onFirst,
  onLast,
  onImportImages,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onImportImages) {
      onImportImages(e.target.files);
      // Reset input so same files can be selected again
      e.target.value = '';
    }
  };

  return (
    <div
      className="flex items-center justify-between px-6 py-4"
      style={{
        backgroundColor: CASA_BRAND.colors.secondary.carbon,
        borderBottom: `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
      }}
    >
      {/* Left: Main controls */}
      <div className="flex items-center gap-3">
        <Button
          onClick={onGoLive}
          disabled={!hasData}
          className="gap-2"
          style={{
            backgroundColor: isLive
              ? '#ef4444'
              : CASA_BRAND.colors.primary.amber,
            color: isLive ? '#ffffff' : CASA_BRAND.colors.primary.black,
          }}
        >
          {isLive ? <Square size={16} /> : <Play size={16} />}
          {isLive ? 'Terminar' : 'Go Live'}
        </Button>

        <Button
          onClick={onToggleBlack}
          disabled={!hasData}
          variant={isBlack ? 'destructive' : 'outline'}
          className="gap-2"
        >
          <Square size={16} />
          {isBlack ? 'Salir de Negro' : 'Negro (B)'}
        </Button>

        <div className="w-px h-8 bg-gray-600 mx-2" />

        <Button
          onClick={onOpenOutput}
          variant="outline"
          className="gap-2"
        >
          <Monitor size={16} />
          Abrir Proyector
        </Button>

        {onImportImages && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="gap-2"
              style={{
                borderColor: CASA_BRAND.colors.primary.amber,
                color: CASA_BRAND.colors.primary.amber,
              }}
            >
              <ImagePlus size={16} />
              Importar Imágenes
            </Button>
          </>
        )}
      </div>

      {/* Center: Navigation */}
      <div className="flex items-center gap-2">
        <Button
          onClick={onFirst}
          disabled={!hasData || currentIndex === 0}
          variant="ghost"
          size="icon"
          title="Primer slide (Home)"
        >
          <ChevronsLeft size={20} />
        </Button>

        <Button
          onClick={onPrev}
          disabled={!hasData || currentIndex === 0}
          variant="ghost"
          size="icon"
          title="Slide anterior (←)"
        >
          <ChevronLeft size={20} />
        </Button>

        <span
          className="px-4 py-2 rounded-md min-w-[100px] text-center"
          style={{
            backgroundColor: CASA_BRAND.colors.primary.black,
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
            fontWeight: 600,
            color: CASA_BRAND.colors.primary.white,
          }}
        >
          {hasData ? `${currentIndex + 1} / ${totalSlides}` : '— / —'}
        </span>

        <Button
          onClick={onNext}
          disabled={!hasData || currentIndex >= totalSlides - 1}
          variant="ghost"
          size="icon"
          title="Siguiente slide (→)"
        >
          <ChevronRight size={20} />
        </Button>

        <Button
          onClick={onLast}
          disabled={!hasData || currentIndex >= totalSlides - 1}
          variant="ghost"
          size="icon"
          title="Ultimo slide (End)"
        >
          <ChevronsRight size={20} />
        </Button>
      </div>

      {/* Right: Info */}
      <div className="flex items-center gap-4">
        <div
          className="text-right"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            color: CASA_BRAND.colors.secondary.grayMedium,
            fontSize: '12px',
          }}
        >
          <p className="text-gray-400">Atajos: ← → B F</p>
        </div>
      </div>
    </div>
  );
};

export default PresenterControls;
