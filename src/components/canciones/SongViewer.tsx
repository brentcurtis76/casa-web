/**
 * SongViewer - Vista completa de una canción con navegación de slides
 */

import React, { useState, useEffect } from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import { songToSlides } from '@/lib/songToSlides';
import { getSongById } from '@/lib/songStorage';
import type { Song } from '@/types/shared/song';
import type { SlideGroup } from '@/types/shared/slide';
import { SongSlide } from './SongSlide';
import { SlidePreview } from './SlidePreview';

interface SongViewerProps {
  songId: string;
  onClose?: () => void;
}

export const SongViewer: React.FC<SongViewerProps> = ({
  songId,
  onClose
}) => {
  const [song, setSong] = useState<Song | null>(null);
  const [slideGroup, setSlideGroup] = useState<SlideGroup | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    async function loadSong() {
      setLoading(true);
      const loadedSong = await getSongById(songId);
      if (loadedSong) {
        setSong(loadedSong);
        setSlideGroup(songToSlides(loadedSong));
      }
      setLoading(false);
    }
    loadSong();
  }, [songId]);

  const handlePrevious = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(prev => prev - 1);
    }
  };

  const handleNext = () => {
    if (slideGroup && currentSlideIndex < slideGroup.slides.length - 1) {
      setCurrentSlideIndex(prev => prev + 1);
    }
  };

  // Navegación con teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        handlePrevious();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        handleNext();
      } else if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlideIndex, slideGroup]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="animate-pulse text-gray-500">Cargando canción...</div>
      </div>
    );
  }

  if (!song || !slideGroup) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-red-500">Canción no encontrada</div>
      </div>
    );
  }

  const currentSlide = slideGroup.slides[currentSlideIndex];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2
            className="text-3xl font-light"
            style={{
              fontFamily: CASA_BRAND.fonts.heading,
              color: CASA_BRAND.colors.primary.black
            }}
          >
            {song.title}
          </h2>
          {song.artist && (
            <p
              className="text-lg mt-1"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                color: CASA_BRAND.colors.secondary.grayMedium
              }}
            >
              {song.artist}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="rounded-lg px-5 py-3 text-base transition-colors"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              backgroundColor: showPreview ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.secondary.grayLight,
              color: showPreview ? CASA_BRAND.colors.primary.white : CASA_BRAND.colors.primary.black
            }}
          >
            {showPreview ? 'Ocultar miniaturas' : 'Ver miniaturas'}
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="rounded-lg p-3 transition-colors hover:bg-gray-100"
            >
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Slide actual */}
      <div className="flex justify-center">
        <SongSlide slide={currentSlide} scale={0.8} />
      </div>

      {/* Controles de navegación */}
      <div className="flex items-center justify-center gap-6">
        <button
          onClick={handlePrevious}
          disabled={currentSlideIndex === 0}
          className="rounded-full p-4 transition-colors hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
          style={{ color: CASA_BRAND.colors.primary.black }}
        >
          <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <span
          className="min-w-[120px] text-center text-xl"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            color: CASA_BRAND.colors.secondary.grayMedium
          }}
        >
          {currentSlideIndex + 1} / {slideGroup.slides.length}
        </span>

        <button
          onClick={handleNext}
          disabled={currentSlideIndex === slideGroup.slides.length - 1}
          className="rounded-full p-4 transition-colors hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
          style={{ color: CASA_BRAND.colors.primary.black }}
        >
          <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Vista previa de miniaturas */}
      {showPreview && (
        <SlidePreview
          slideGroup={slideGroup}
          selectedIndex={currentSlideIndex}
          onSlideSelect={setCurrentSlideIndex}
        />
      )}
    </div>
  );
};

export default SongViewer;
