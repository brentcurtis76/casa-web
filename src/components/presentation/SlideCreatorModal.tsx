/**
 * SlideCreatorModal - Main modal for creating slides on-the-fly
 * Provides quick access to different slide types
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CASA_BRAND } from '@/lib/brand-kit';
import { Book, FileText, Image, Square, X, Layers, Video } from 'lucide-react';
import { BibleVerseCreator } from './BibleVerseCreator';
import { QuickTextCreator } from './QuickTextCreator';
import { ImageSlideCreator } from './ImageSlideCreator';
import { VideoSlideCreator } from './VideoSlideCreator';
import { SceneSelector } from './SceneSelector';
import type { Slide } from '@/types/shared/slide';
import type { PresentationTheme } from '@/lib/presentation/themes';

type CreatorView = 'menu' | 'bible' | 'text' | 'image' | 'video' | 'scene';

interface SlideCreatorModalProps {
  open: boolean;
  onClose: () => void;
  onCreateSlide: (slide: Slide, insertPosition: 'after' | 'end') => void;
  onCreateSlides?: (
    slides: Slide[],
    insertPosition: 'after' | 'end',
    elementInfo?: { type: string; title: string }
  ) => void;
  currentSlideIndex: number;
  totalSlides: number;
  theme: PresentationTheme;
}

export const SlideCreatorModal: React.FC<SlideCreatorModalProps> = ({
  open,
  onClose,
  onCreateSlide,
  onCreateSlides,
  currentSlideIndex,
  totalSlides,
  theme,
}) => {
  const [view, setView] = useState<CreatorView>('menu');

  const handleClose = () => {
    setView('menu');
    onClose();
  };

  const handleSlideCreated = (slide: Slide, insertPosition: 'after' | 'end') => {
    onCreateSlide(slide, insertPosition);
    handleClose();
  };

  const handleSlidesCreated = (slides: Slide[], insertPosition: 'after' | 'end') => {
    if (onCreateSlides) {
      onCreateSlides(slides, insertPosition);
    } else {
      // Fallback: insert slides one by one
      slides.forEach((slide) => {
        onCreateSlide(slide, insertPosition);
      });
    }
    handleClose();
  };

  const handleSceneSelected = (slides: Slide[], elementInfo: { type: string; title: string }) => {
    if (onCreateSlides) {
      onCreateSlides(slides, 'after', elementInfo);
    } else {
      // Fallback: insert slides one by one (no element info)
      slides.forEach((slide) => {
        onCreateSlide(slide, 'after');
      });
    }
    handleClose();
  };

  const handleCreateBlankSlide = (color: 'black' | 'white') => {
    const slide: Slide = {
      id: `temp-blank-${Date.now()}`,
      type: 'blank',
      content: {
        primary: '',
      },
      style: {
        backgroundColor: color === 'black' ? '#000000' : '#FFFFFF',
      },
      metadata: {
        sourceComponent: 'quick-add',
        sourceId: `temp-${Date.now()}`,
        order: 0,
        groupTotal: 1,
      },
    };
    handleSlideCreated(slide, 'after');
  };

  const renderMenu = () => (
    <div className="grid grid-cols-2 gap-4 p-4">
      <Button
        onClick={() => setView('bible')}
        variant="outline"
        className="h-24 flex-col gap-2 border-2 transition-all hover:scale-[1.02]"
        style={{
          borderColor: CASA_BRAND.colors.secondary.grayDark,
          backgroundColor: CASA_BRAND.colors.primary.black,
        }}
      >
        <Book
          size={28}
          style={{ color: CASA_BRAND.colors.primary.amber }}
        />
        <span
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            color: CASA_BRAND.colors.primary.white,
            fontSize: '14px',
          }}
        >
          Versículo
        </span>
      </Button>

      <Button
        onClick={() => setView('text')}
        variant="outline"
        className="h-24 flex-col gap-2 border-2 transition-all hover:scale-[1.02]"
        style={{
          borderColor: CASA_BRAND.colors.secondary.grayDark,
          backgroundColor: CASA_BRAND.colors.primary.black,
        }}
      >
        <FileText
          size={28}
          style={{ color: CASA_BRAND.colors.primary.amber }}
        />
        <span
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            color: CASA_BRAND.colors.primary.white,
            fontSize: '14px',
          }}
        >
          Texto Rápido
        </span>
      </Button>

      <Button
        onClick={() => setView('image')}
        variant="outline"
        className="h-24 flex-col gap-2 border-2 transition-all hover:scale-[1.02]"
        style={{
          borderColor: CASA_BRAND.colors.secondary.grayDark,
          backgroundColor: CASA_BRAND.colors.primary.black,
        }}
      >
        <Image
          size={28}
          style={{ color: CASA_BRAND.colors.primary.amber }}
        />
        <span
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            color: CASA_BRAND.colors.primary.white,
            fontSize: '14px',
          }}
        >
          Imagen
        </span>
      </Button>

      <Button
        onClick={() => setView('video')}
        variant="outline"
        className="h-24 flex-col gap-2 border-2 transition-all hover:scale-[1.02]"
        style={{
          borderColor: CASA_BRAND.colors.secondary.grayDark,
          backgroundColor: CASA_BRAND.colors.primary.black,
        }}
      >
        <Video
          size={28}
          style={{ color: CASA_BRAND.colors.primary.amber }}
        />
        <span
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            color: CASA_BRAND.colors.primary.white,
            fontSize: '14px',
          }}
        >
          Video
        </span>
      </Button>

      <Button
        onClick={() => handleCreateBlankSlide('black')}
        variant="outline"
        className="h-24 flex-col gap-2 border-2 transition-all hover:scale-[1.02]"
        style={{
          borderColor: CASA_BRAND.colors.secondary.grayDark,
          backgroundColor: CASA_BRAND.colors.primary.black,
        }}
      >
        <Square
          size={28}
          style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
          fill={CASA_BRAND.colors.primary.black}
        />
        <span
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            color: CASA_BRAND.colors.primary.white,
            fontSize: '14px',
          }}
        >
          Negro
        </span>
      </Button>

      <Button
        onClick={() => setView('scene')}
        variant="outline"
        className="h-24 flex-col gap-2 border-2 transition-all hover:scale-[1.02] col-span-2"
        style={{
          borderColor: CASA_BRAND.colors.primary.amber,
          backgroundColor: CASA_BRAND.colors.primary.black,
        }}
      >
        <Layers
          size={28}
          style={{ color: CASA_BRAND.colors.primary.amber }}
        />
        <span
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            color: CASA_BRAND.colors.primary.white,
            fontSize: '14px',
          }}
        >
          Escena (Canción, Oración, etc.)
        </span>
      </Button>
    </div>
  );

  const getTitle = () => {
    switch (view) {
      case 'bible':
        return 'Agregar Versículo';
      case 'text':
        return 'Texto Rápido';
      case 'image':
        return 'Agregar Imagen';
      case 'video':
        return 'Agregar Video';
      case 'scene':
        return 'Agregar Escena';
      default:
        return 'Crear Diapositivas o Escenas';
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={view === 'scene' ? 'max-w-4xl' : 'max-w-md'}
        style={{
          backgroundColor: CASA_BRAND.colors.secondary.carbon,
          border: `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
        }}
      >
        <DialogHeader className={view === 'menu' ? 'text-center' : 'flex flex-row items-center justify-between'}>
          <DialogTitle
            className={view === 'menu' ? 'text-center w-full' : 'flex items-center gap-2'}
            style={{
              fontFamily: CASA_BRAND.fonts.heading,
              color: CASA_BRAND.colors.primary.white,
            }}
          >
            {view !== 'menu' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView('menu')}
                className="mr-2 h-8 w-8 p-0"
              >
                <X size={16} style={{ color: CASA_BRAND.colors.secondary.grayLight }} />
              </Button>
            )}
            {getTitle()}
          </DialogTitle>
        </DialogHeader>

        {view === 'menu' && renderMenu()}

        {view === 'bible' && (
          <BibleVerseCreator
            onCancel={() => setView('menu')}
            onCreateSlide={handleSlideCreated}
            currentSlideIndex={currentSlideIndex}
            totalSlides={totalSlides}
          />
        )}

        {view === 'text' && (
          <QuickTextCreator
            onCancel={() => setView('menu')}
            onCreateSlide={handleSlideCreated}
            currentSlideIndex={currentSlideIndex}
            totalSlides={totalSlides}
          />
        )}

        {view === 'image' && (
          <ImageSlideCreator
            onCancel={() => setView('menu')}
            onCreateSlide={handleSlideCreated}
            currentSlideIndex={currentSlideIndex}
            totalSlides={totalSlides}
          />
        )}

        {view === 'video' && (
          <VideoSlideCreator
            onCancel={() => setView('menu')}
            onCreateSlide={handleSlideCreated}
            currentSlideIndex={currentSlideIndex}
            totalSlides={totalSlides}
          />
        )}

        {view === 'scene' && (
          <SceneSelector
            onCancel={() => setView('menu')}
            onSelectScene={handleSceneSelected}
            currentSlideIndex={currentSlideIndex}
            theme={theme}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SlideCreatorModal;
