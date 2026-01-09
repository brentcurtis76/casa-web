/**
 * SongCard - Tarjeta de canción para el listado del repositorio
 * Diseño según Brand Kit CASA
 */

import React from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import type { SongIndexEntry } from '@/types/shared/song';

interface SongCardProps {
  song: SongIndexEntry;
  onClick: () => void;
  isSelected?: boolean;
}

export const SongCard: React.FC<SongCardProps> = ({
  song,
  onClick,
  isSelected = false
}) => {
  return (
    <div
      onClick={onClick}
      className={`
        group cursor-pointer rounded-lg border p-4 transition-all duration-200
        hover:border-amber-400 hover:shadow-md
        ${isSelected
          ? 'border-amber-500 bg-amber-50 shadow-md'
          : 'border-gray-200 bg-white'
        }
      `}
      style={{
        borderRadius: CASA_BRAND.ui.borderRadius.md
      }}
    >
      <div className="flex items-start gap-3">
        {/* Número de canción */}
        <span
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-lg font-semibold"
          style={{
            backgroundColor: isSelected ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.secondary.grayLight,
            color: isSelected ? CASA_BRAND.colors.primary.white : CASA_BRAND.colors.secondary.grayDark
          }}
        >
          {song.number}
        </span>

        {/* Información de la canción */}
        <div className="flex-1 min-w-0">
          <h3
            className="truncate font-light text-lg"
            style={{
              fontFamily: CASA_BRAND.fonts.heading,
              color: CASA_BRAND.colors.primary.black
            }}
          >
            {song.title}
          </h3>

          {song.artist && (
            <p
              className="mt-1 truncate text-base"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                color: CASA_BRAND.colors.secondary.grayMedium
              }}
            >
              {song.artist}
            </p>
          )}

          <p
            className="mt-1 text-sm"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              color: CASA_BRAND.colors.secondary.grayMedium
            }}
          >
            {song.verseCount} slides
          </p>
        </div>

        {/* Indicador de selección */}
        {isSelected && (
          <div
            className="flex h-6 w-6 items-center justify-center rounded-full"
            style={{ backgroundColor: CASA_BRAND.colors.primary.amber }}
          >
            <svg
              className="h-4 w-4 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};

export default SongCard;
