/**
 * CancionSelector - Selector de canciones para la liturgia
 * Incluye filtro de tempo pre-configurado según posición litúrgica
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import {
  Music,
  Search,
  Filter,
  X,
  Check,
  Clock,
  Calendar,
  ChevronDown,
  ChevronUp,
  Eye,
  Loader2,
} from 'lucide-react';
import type { Song, SongTempo } from '@/types/shared/song';
import type { SlideGroup, Slide } from '@/types/shared/slide';
import type { LiturgyElementType } from '@/types/shared/liturgy';
import type { AssetWarnings } from '@/types/musicPlanning';
import {
  TEMPO_LABELS,
  filterSongsByTempo,
  getSongUsageStats,
  searchSongsWithFilters,
} from '@/lib/canciones/songTagsManager';
import { songToSlides } from '@/lib/songToSlides';
import { SongSlide } from '@/components/canciones/SongSlide';
import { getAllSongs } from '@/lib/songStorage';
import { checkSongAssets } from '@/lib/music-planning/liturgyMusicPublishService';

type SongElementType =
  | 'cancion-invocacion'
  | 'cancion-arrepentimiento'
  | 'cancion-gratitud'
  | 'cancion-santa-cena';

interface CancionSelectorProps {
  elementType: SongElementType;
  selectedSongId?: string;
  onSongSelected: (song: Song, slides: SlideGroup) => void;
}

// Configuración de tempo por defecto según posición
const DEFAULT_TEMPO_BY_ELEMENT: Record<SongElementType, SongTempo> = {
  'cancion-invocacion': 'rápida',
  'cancion-arrepentimiento': 'intermedia',
  'cancion-gratitud': 'lenta',
  'cancion-santa-cena': 'lenta',
};

// Etiquetas de elementos
const ELEMENT_LABELS: Record<SongElementType, string> = {
  'cancion-invocacion': 'Primera canción - Invocación',
  'cancion-arrepentimiento': 'Segunda canción - Arrepentimiento',
  'cancion-gratitud': 'Tercera canción - Gratitud',
  'cancion-santa-cena': 'Cuarta canción - Santa Cena',
};

// Descripciones de tempo
const TEMPO_DESCRIPTIONS: Record<SongTempo, string> = {
  'rápida': 'Canciones alegres y animadas para abrir el culto',
  'intermedia': 'Canciones de ritmo moderado para reflexión',
  'lenta': 'Canciones tranquilas para momentos solemnes',
};

/**
 * Componente de vista previa de slide de canción
 * Usa el componente SongSlide del módulo canciones para consistencia
 */
const SongSlidePreview: React.FC<{ slide: Slide }> = ({ slide }) => {
  return (
    <div className="overflow-hidden rounded">
      <SongSlide slide={slide} scale={0.12} showIndicator={false} />
    </div>
  );
};

/**
 * Tarjeta de canción en la lista
 */
const SongCard: React.FC<{
  song: Song;
  isSelected: boolean;
  onSelect: () => void;
  assetWarnings?: AssetWarnings;
}> = ({ song, isSelected, onSelect, assetWarnings }) => {
  const stats = getSongUsageStats(song.songTags);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full p-3 rounded-lg text-left transition-all ${
        isSelected ? 'ring-2 ring-offset-1' : ''
      }`}
      style={{
        backgroundColor: isSelected
          ? `${CASA_BRAND.colors.amber.light}20`
          : CASA_BRAND.colors.primary.white,
        borderWidth: 1,
        borderColor: isSelected
          ? CASA_BRAND.colors.primary.amber
          : CASA_BRAND.colors.secondary.grayLight,
        ringColor: CASA_BRAND.colors.primary.amber,
      }}
    >
      <div className="flex items-start gap-3">
        {/* Número */}
        <span
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            backgroundColor: isSelected
              ? CASA_BRAND.colors.primary.amber
              : CASA_BRAND.colors.secondary.grayLight,
            color: isSelected
              ? CASA_BRAND.colors.primary.white
              : CASA_BRAND.colors.secondary.grayMedium,
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          {song.number || '#'}
        </span>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h4
            className="truncate"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              fontWeight: 500,
              color: CASA_BRAND.colors.primary.black,
            }}
          >
            {song.title}
          </h4>
          {song.artist && (
            <p
              className="truncate"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '12px',
                color: CASA_BRAND.colors.secondary.grayMedium,
              }}
            >
              {song.artist}
            </p>
          )}

          {/* Metadata */}
          <div className="flex items-center gap-3 mt-1">
            {song.songTags?.tempo && (
              <span
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                style={{
                  backgroundColor: `${CASA_BRAND.colors.amber.light}30`,
                  color: CASA_BRAND.colors.primary.amber,
                  fontFamily: CASA_BRAND.fonts.body,
                }}
              >
                <Clock size={10} />
                {TEMPO_LABELS[song.songTags.tempo]}
              </span>
            )}
            {stats.lastUsedDate && (
              <span
                className="flex items-center gap-1 text-xs"
                style={{
                  color: CASA_BRAND.colors.secondary.grayMedium,
                  fontFamily: CASA_BRAND.fonts.body,
                }}
              >
                <Calendar size={10} />
                Hace {stats.daysSinceLastUse} dias
              </span>
            )}
          </div>

          {/* Asset warning badges */}
          {assetWarnings && (assetWarnings.missingChordCharts || assetWarnings.missingAudioReferences || assetWarnings.missingStems) && (
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              {assetWarnings.missingChordCharts && (
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                  style={{
                    backgroundColor: '#FEF3C7',
                    color: '#92400E',
                    fontFamily: CASA_BRAND.fonts.body,
                  }}
                >
                  Sin partitura
                </span>
              )}
              {assetWarnings.missingAudioReferences && (
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                  style={{
                    backgroundColor: '#FEF3C7',
                    color: '#92400E',
                    fontFamily: CASA_BRAND.fonts.body,
                  }}
                >
                  Sin referencia
                </span>
              )}
              {assetWarnings.missingStems && (
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                  style={{
                    backgroundColor: '#FEF3C7',
                    color: '#92400E',
                    fontFamily: CASA_BRAND.fonts.body,
                  }}
                >
                  Sin stems
                </span>
              )}
            </div>
          )}
        </div>

        {/* Checkmark */}
        {isSelected && (
          <Check
            size={20}
            style={{ color: CASA_BRAND.colors.primary.amber }}
          />
        )}
      </div>
    </button>
  );
};

const CancionSelector: React.FC<CancionSelectorProps> = ({
  elementType,
  selectedSongId,
  onSongSelected,
}) => {
  // Estados
  const [songs, setSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tempoFilter, setTempoFilter] = useState<SongTempo | 'all'>(
    DEFAULT_TEMPO_BY_ELEMENT[elementType]
  );
  const [showAllTempos, setShowAllTempos] = useState(false);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [previewSlides, setPreviewSlides] = useState<SlideGroup | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  // Asset warnings state
  const [assetStatus, setAssetStatus] = useState<Record<string, AssetWarnings>>({});

  const defaultTempo = DEFAULT_TEMPO_BY_ELEMENT[elementType];
  const elementLabel = ELEMENT_LABELS[elementType];

  // Cargar canciones
  useEffect(() => {
    const loadSongs = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const loadedSongs = await getAllSongs();
        setSongs(loadedSongs);
        if (loadedSongs.length === 0) {
          setLoadError('No hay canciones en la base de datos. Verifica que la tabla music_songs tenga datos.');
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Error desconocido';
        setLoadError(`Error al cargar canciones: ${msg}`);
      } finally {
        setIsLoading(false);
      }
    };

    loadSongs();
  }, []);

  // Restaurar selección previa o resetear cuando cambia el elemento
  useEffect(() => {
    // Resetear estado de confirmación y búsqueda cuando cambia el elemento
    setIsConfirmed(false);
    setSearchQuery('');
    setTempoFilter(DEFAULT_TEMPO_BY_ELEMENT[elementType]);
    setShowAllTempos(false);

    if (songs.length > 0) {
      if (selectedSongId) {
        const song = songs.find(s => s.id === selectedSongId);
        if (song) {
          setSelectedSong(song);
          setPreviewSlides(songToSlides(song));
          setShowPreview(true);
          return;
        }
      }
      // Si no hay selección previa para este elemento, resetear estado
      setSelectedSong(null);
      setPreviewSlides(null);
      setShowPreview(false);
    }
  }, [selectedSongId, songs, elementType]);

  // Filtrar canciones
  const filteredSongs = useMemo(() => {
    let result = songs;

    // Filtro de tempo
    if (tempoFilter !== 'all' && !showAllTempos) {
      result = filterSongsByTempo(result, tempoFilter);
    }

    // Filtro de búsqueda
    if (searchQuery.trim()) {
      result = searchSongsWithFilters(result, { query: searchQuery });
    }

    // Ordenar: primero las que no se han usado recientemente
    result.sort((a, b) => {
      const aStats = getSongUsageStats(a.songTags);
      const bStats = getSongUsageStats(b.songTags);

      // Si no tienen fecha de uso, van primero
      if (!aStats.lastUsedDate && bStats.lastUsedDate) return -1;
      if (aStats.lastUsedDate && !bStats.lastUsedDate) return 1;

      // Ordenar por días desde último uso (más días = primero)
      const aDays = aStats.daysSinceLastUse ?? Infinity;
      const bDays = bStats.daysSinceLastUse ?? Infinity;
      return bDays - aDays;
    });

    return result;
  }, [songs, tempoFilter, showAllTempos, searchQuery]);

  // Load asset warnings for displayed songs
  useEffect(() => {
    if (filteredSongs.length === 0) return;

    let cancelled = false;
    const loadAssets = async () => {
      const newStatus: Record<string, AssetWarnings> = {};

      // Only check first 20 songs to avoid excessive queries
      const songsToCheck = filteredSongs.slice(0, 20);

      for (const song of songsToCheck) {
        if (cancelled) break;
        // Skip if already loaded
        if (assetStatus[song.id]) {
          newStatus[song.id] = assetStatus[song.id];
          continue;
        }
        try {
          const warnings = await checkSongAssets(song.id);
          newStatus[song.id] = warnings;
        } catch {
          // Skip on error
        }
      }

      if (!cancelled) {
        setAssetStatus((prev) => ({ ...prev, ...newStatus }));
      }
    };

    loadAssets();
    return () => { cancelled = true; };
  // Only re-run when the filtered song IDs change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredSongs.map((s) => s.id).join(',')]);

  // Manejar seleccion de cancion
  const handleSelectSong = useCallback((song: Song) => {
    setSelectedSong(song);
    const slides = songToSlides(song);
    setPreviewSlides(slides);
    setShowPreview(true);
  }, []);

  // Confirmar selección
  const handleConfirmSelection = useCallback(() => {
    if (selectedSong && previewSlides) {
      onSongSelected(selectedSong, previewSlides);

      // Mostrar feedback de confirmación
      setIsConfirmed(true);
      setTimeout(() => setIsConfirmed(false), 3000);
    }
  }, [selectedSong, previewSlides, onSongSelected]);

  // Toggle ver todas
  const handleToggleAllTempos = useCallback(() => {
    setShowAllTempos(prev => !prev);
    if (!showAllTempos) {
      setTempoFilter('all');
    } else {
      setTempoFilter(defaultTempo);
    }
  }, [showAllTempos, defaultTempo]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3
          style={{
            fontFamily: CASA_BRAND.fonts.heading,
            fontSize: '20px',
            fontWeight: 400,
            color: CASA_BRAND.colors.primary.black,
            marginBottom: '4px',
          }}
        >
          {elementLabel}
        </h3>
        <p
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
            color: CASA_BRAND.colors.secondary.grayMedium,
          }}
        >
          {TEMPO_DESCRIPTIONS[defaultTempo]}
        </p>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-4">
        {/* Búsqueda */}
        <div className="flex-1 relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar canción..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border focus:outline-none focus:ring-2"
            style={{
              borderColor: CASA_BRAND.colors.secondary.grayLight,
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              // @ts-expect-error - CSS custom property
              '--tw-ring-color': CASA_BRAND.colors.primary.amber,
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X size={14} style={{ color: CASA_BRAND.colors.secondary.grayMedium }} />
            </button>
          )}
        </div>

        {/* Filtro de tempo */}
        <div className="flex items-center gap-2">
          <Filter size={14} style={{ color: CASA_BRAND.colors.secondary.grayMedium }} />
          <select
            value={tempoFilter}
            onChange={(e) => setTempoFilter(e.target.value as SongTempo | 'all')}
            disabled={showAllTempos}
            className="px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 disabled:opacity-50"
            style={{
              borderColor: CASA_BRAND.colors.secondary.grayLight,
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '13px',
              // @ts-expect-error - CSS custom property
              '--tw-ring-color': CASA_BRAND.colors.primary.amber,
            }}
          >
            <option value={defaultTempo}>
              {TEMPO_LABELS[defaultTempo]} (recomendado)
            </option>
            {Object.entries(TEMPO_LABELS)
              .filter(([key]) => key !== defaultTempo)
              .map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            <option value="all">Todos los tempos</option>
          </select>
        </div>

        {/* Ver todas */}
        <button
          type="button"
          onClick={handleToggleAllTempos}
          className={`px-3 py-2 rounded-lg border transition-colors ${
            showAllTempos ? 'ring-1' : ''
          }`}
          style={{
            borderColor: showAllTempos
              ? CASA_BRAND.colors.primary.amber
              : CASA_BRAND.colors.secondary.grayLight,
            backgroundColor: showAllTempos
              ? `${CASA_BRAND.colors.amber.light}20`
              : 'transparent',
            color: showAllTempos
              ? CASA_BRAND.colors.primary.amber
              : CASA_BRAND.colors.secondary.grayMedium,
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '13px',
            ringColor: CASA_BRAND.colors.primary.amber,
          }}
        >
          {showAllTempos ? 'Filtrar por tempo' : 'Ver todas'}
        </button>
      </div>

      {/* Lista de canciones y preview */}
      <div className="grid grid-cols-2 gap-6">
        {/* Lista */}
        <div
          className="space-y-2 max-h-[400px] overflow-y-auto pr-2"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: `${CASA_BRAND.colors.secondary.grayLight} transparent`,
          }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2
                size={24}
                className="animate-spin"
                style={{ color: CASA_BRAND.colors.primary.amber }}
              />
            </div>
          ) : loadError ? (
            <div className="text-center py-8">
              <Music
                size={32}
                className="mx-auto mb-2"
                style={{ color: '#EF4444' }}
              />
              <p
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '14px',
                  color: '#EF4444',
                }}
              >
                {loadError}
              </p>
            </div>
          ) : filteredSongs.length === 0 ? (
            <div className="text-center py-8">
              <Music
                size={32}
                className="mx-auto mb-2"
                style={{ color: CASA_BRAND.colors.secondary.grayLight }}
              />
              <p
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '14px',
                  color: CASA_BRAND.colors.secondary.grayMedium,
                }}
              >
                No se encontraron canciones ({songs.length} total, filtro: {tempoFilter})
              </p>
              {tempoFilter !== 'all' && !showAllTempos && (
                <button
                  type="button"
                  onClick={handleToggleAllTempos}
                  className="mt-2 text-sm underline"
                  style={{ color: CASA_BRAND.colors.primary.amber }}
                >
                  Ver todas las canciones
                </button>
              )}
            </div>
          ) : (
            <>
              <p
                className="text-xs mb-2"
                style={{
                  color: CASA_BRAND.colors.secondary.grayMedium,
                  fontFamily: CASA_BRAND.fonts.body,
                }}
              >
                {filteredSongs.length} canciones encontradas
              </p>
              {filteredSongs.map((song) => (
                <SongCard
                  key={song.id}
                  song={song}
                  isSelected={selectedSong?.id === song.id}
                  onSelect={() => handleSelectSong(song)}
                  assetWarnings={assetStatus[song.id]}
                />
              ))}
            </>
          )}
        </div>

        {/* Preview */}
        <div>
          {selectedSong && previewSlides ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4
                  style={{
                    fontFamily: CASA_BRAND.fonts.body,
                    fontSize: '14px',
                    fontWeight: 500,
                    color: CASA_BRAND.colors.primary.black,
                  }}
                >
                  Vista previa: {selectedSong.title}
                </h4>
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center gap-1 text-sm"
                  style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                >
                  <Eye size={14} />
                  {showPreview ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              {showPreview && (
                <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
                  {previewSlides.slides.map((slide) => (
                    <SongSlidePreview key={slide.id} slide={slide} />
                  ))}
                </div>
              )}

              {/* Mensaje de confirmación */}
              {isConfirmed && (
                <div
                  className="p-3 rounded-lg flex items-center gap-2"
                  style={{
                    backgroundColor: `${CASA_BRAND.colors.amber.light}30`,
                    color: CASA_BRAND.colors.amber.dark,
                    fontFamily: CASA_BRAND.fonts.body,
                    fontSize: '13px',
                  }}
                >
                  <Check size={16} />
                  Canción agregada. Usa el botón "Guardar" principal para guardar en la nube.
                </div>
              )}

              {/* Botón confirmar */}
              <button
                type="button"
                onClick={handleConfirmSelection}
                disabled={isConfirmed}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors disabled:cursor-not-allowed"
                style={{
                  backgroundColor: isConfirmed ? CASA_BRAND.colors.amber.dark : CASA_BRAND.colors.primary.amber,
                  color: CASA_BRAND.colors.primary.white,
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                <Check size={18} />
                {isConfirmed ? 'Confirmado' : 'Confirmar selección'}
              </button>
            </div>
          ) : (
            <div
              className="h-full flex items-center justify-center p-8 rounded-xl border-2 border-dashed"
              style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
            >
              <div className="text-center">
                <Music
                  size={40}
                  className="mx-auto mb-3"
                  style={{ color: CASA_BRAND.colors.secondary.grayLight }}
                />
                <p
                  style={{
                    fontFamily: CASA_BRAND.fonts.body,
                    fontSize: '14px',
                    color: CASA_BRAND.colors.secondary.grayMedium,
                  }}
                >
                  Selecciona una canción para ver la vista previa
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CancionSelector;
