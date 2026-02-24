/**
 * SongRepository - Componente principal del repositorio de canciones
 * Lista, búsqueda y selección de canciones
 */

import React, { useState, useEffect } from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import { getAllSongEntries, searchSongs } from '@/lib/songStorage';
import type { SongIndexEntry } from '@/types/shared/song';
import { SongCard } from './SongCard';
import { SongViewer } from './SongViewer';

interface SongRepositoryProps {
  onSongSelect?: (song: SongIndexEntry) => void;
  selectedSongId?: string;
  showViewer?: boolean;
}

export const SongRepository: React.FC<SongRepositoryProps> = ({
  onSongSelect,
  selectedSongId,
  showViewer = true
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingSongId, setViewingSongId] = useState<string | null>(null);
  const [songs, setSongs] = useState<SongIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const fetchSongs = async () => {
      const results = searchQuery.trim()
        ? await searchSongs(searchQuery)
        : await getAllSongEntries();
      if (!cancelled) {
        setSongs(results);
        setLoading(false);
      }
    };

    fetchSongs();
    return () => { cancelled = true; };
  }, [searchQuery]);

  const handleSongClick = (song: SongIndexEntry) => {
    if (showViewer) {
      setViewingSongId(song.id);
    }
    onSongSelect?.(song);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header con búsqueda */}
      <div className="mb-6">
        <h2
          className="mb-4 text-2xl font-light"
          style={{
            fontFamily: CASA_BRAND.fonts.heading,
            color: CASA_BRAND.colors.primary.black
          }}
        >
          Repositorio de Canciones
        </h2>

        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar canción..."
            className="w-full rounded-lg border px-4 py-4 pl-12 text-lg transition-colors focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              borderColor: CASA_BRAND.colors.secondary.grayLight
            }}
          />
          <svg
            className="absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2"
            style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        <p
          className="mt-3 text-base"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            color: CASA_BRAND.colors.secondary.grayMedium
          }}
        >
          {loading ? 'Cargando...' : `${songs.length} canciones encontradas`}
        </p>
      </div>

      {/* Lista de canciones */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div
            className="py-12 text-center text-lg"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              color: CASA_BRAND.colors.secondary.grayMedium
            }}
          >
            Cargando canciones...
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {songs.map((song) => (
                <SongCard
                  key={song.id}
                  song={song}
                  onClick={() => handleSongClick(song)}
                  isSelected={selectedSongId === song.id}
                />
              ))}
            </div>

            {songs.length === 0 && (
              <div
                className="py-12 text-center text-lg"
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  color: CASA_BRAND.colors.secondary.grayMedium
                }}
              >
                No se encontraron canciones con "{searchQuery}"
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de visualización */}
      {showViewer && viewingSongId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-6"
            style={{ backgroundColor: CASA_BRAND.colors.primary.white }}
          >
            <SongViewer
              songId={viewingSongId}
              onClose={() => setViewingSongId(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SongRepository;
