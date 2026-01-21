/**
 * SceneSelector - Component for selecting and inserting complete liturgical elements
 * Allows inserting songs, fixed elements (Padre Nuestro, Santa Cena, etc.) into the presentation
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import {
  Music,
  Search,
  X,
  Check,
  Clock,
  Loader2,
  BookOpen,
  Eye,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Song, SongTempo } from '@/types/shared/song';
import type { Slide } from '@/types/shared/slide';
import { songToSlides } from '@/lib/songToSlides';
import { fixedElementToSlides } from '@/lib/fixedElementToSlides';
import type { FixedElement } from '@/types/shared/fixed-elements';
import { SongSlide } from '@/components/canciones/SongSlide';
import {
  TEMPO_LABELS,
  filterSongsByTempo,
  searchSongsWithFilters,
} from '@/lib/canciones/songTagsManager';
import type { PresentationTheme } from '@/lib/presentation/themes';

type SceneTab = 'canciones' | 'fijos';

interface FixedElementIndex {
  id: string;
  title: string;
  type: string;
  slideCount: number;
}

interface SceneSelectorProps {
  onCancel: () => void;
  onSelectScene: (slides: Slide[], elementInfo: { type: string; title: string }) => void;
  currentSlideIndex: number;
  theme: PresentationTheme;
}

/**
 * Preview component for a single slide
 */
const SlidePreviewThumb: React.FC<{ slide: Slide }> = ({ slide }) => {
  return (
    <div className="overflow-hidden rounded border" style={{ borderColor: CASA_BRAND.colors.secondary.grayDark }}>
      <SongSlide slide={slide} scale={0.1} showIndicator={false} />
    </div>
  );
};

/**
 * Song card in the list
 */
const SongCard = React.memo<{
  song: Song;
  isSelected: boolean;
  onSelect: () => void;
}>(({ song, isSelected, onSelect }) => {
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
          : CASA_BRAND.colors.secondary.carbon,
        borderWidth: 1,
        borderColor: isSelected
          ? CASA_BRAND.colors.primary.amber
          : CASA_BRAND.colors.secondary.grayDark,
        ringColor: CASA_BRAND.colors.primary.amber,
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            backgroundColor: isSelected
              ? CASA_BRAND.colors.primary.amber
              : CASA_BRAND.colors.secondary.grayDark,
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

        <div className="flex-1 min-w-0">
          <h4
            className="truncate"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              fontWeight: 500,
              color: CASA_BRAND.colors.primary.white,
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

          <div className="flex items-center gap-3 mt-1">
            <span
              className="flex items-center gap-1 text-xs"
              style={{
                color: CASA_BRAND.colors.secondary.grayMedium,
                fontFamily: CASA_BRAND.fonts.body,
              }}
            >
              <Music size={10} />
              {song.verses.length + 1} slides
            </span>
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
          </div>
        </div>

        {isSelected && (
          <Check
            size={20}
            style={{ color: CASA_BRAND.colors.primary.amber }}
          />
        )}
      </div>
    </button>
  );
});

SongCard.displayName = 'SongCard';

/**
 * Fixed element card in the list
 */
const FixedElementCard = React.memo<{
  element: FixedElementIndex;
  isSelected: boolean;
  onSelect: () => void;
}>(({ element, isSelected, onSelect }) => (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full p-3 rounded-lg text-left transition-all ${
        isSelected ? 'ring-2 ring-offset-1' : ''
      }`}
      style={{
        backgroundColor: isSelected
          ? `${CASA_BRAND.colors.amber.light}20`
          : CASA_BRAND.colors.secondary.carbon,
        borderWidth: 1,
        borderColor: isSelected
          ? CASA_BRAND.colors.primary.amber
          : CASA_BRAND.colors.secondary.grayDark,
        ringColor: CASA_BRAND.colors.primary.amber,
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            backgroundColor: isSelected
              ? CASA_BRAND.colors.primary.amber
              : CASA_BRAND.colors.secondary.grayDark,
            color: isSelected
              ? CASA_BRAND.colors.primary.white
              : CASA_BRAND.colors.secondary.grayMedium,
          }}
        >
          <BookOpen size={14} />
        </span>

        <div className="flex-1 min-w-0">
          <h4
            className="truncate"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              fontWeight: 500,
              color: CASA_BRAND.colors.primary.white,
            }}
          >
            {element.title}
          </h4>

          <div className="flex items-center gap-3 mt-1">
            <span
              className="flex items-center gap-1 text-xs"
              style={{
                color: CASA_BRAND.colors.secondary.grayMedium,
                fontFamily: CASA_BRAND.fonts.body,
              }}
            >
              <BookOpen size={10} />
              {element.slideCount} slides
            </span>
          </div>
        </div>

        {isSelected && (
          <Check
            size={20}
            style={{ color: CASA_BRAND.colors.primary.amber }}
          />
        )}
      </div>
    </button>
));

FixedElementCard.displayName = 'FixedElementCard';

export const SceneSelector: React.FC<SceneSelectorProps> = ({
  onCancel,
  onSelectScene,
  currentSlideIndex,
  theme,
}) => {
  const [activeTab, setActiveTab] = useState<SceneTab>('canciones');
  const [songs, setSongs] = useState<Song[]>([]);
  const [fixedElements, setFixedElements] = useState<FixedElementIndex[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tempoFilter, setTempoFilter] = useState<SongTempo | 'all'>('all');

  // Selection state
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [selectedFixedElement, setSelectedFixedElement] = useState<FixedElementIndex | null>(null);
  const [previewSlides, setPreviewSlides] = useState<Slide[]>([]);
  const [showPreview, setShowPreview] = useState(true);
  const [isLoadingElement, setIsLoadingElement] = useState(false);

  // Load songs with cleanup to prevent memory leaks
  useEffect(() => {
    let isMounted = true;

    const loadSongs = async () => {
      setIsLoading(true);
      try {
        const indexResponse = await fetch('/data/canciones/index.json');
        if (!isMounted) return;

        if (indexResponse.ok) {
          const indexData = await indexResponse.json();

          const songPromises = indexData.songs.map(async (entry: { id: string }) => {
            try {
              const songResponse = await fetch(`/data/canciones/${entry.id}.json`);
              if (songResponse.ok) {
                return songResponse.json();
              }
            } catch {
              return null;
            }
            return null;
          });

          const loadedSongs = (await Promise.all(songPromises)).filter(Boolean);
          if (isMounted) {
            setSongs(loadedSongs);
          }
        }
      } catch (error) {
        console.error('Error loading songs:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadSongs();

    return () => {
      isMounted = false;
    };
  }, []);

  // Load fixed elements index with cleanup
  useEffect(() => {
    let isMounted = true;

    const loadFixedElements = async () => {
      try {
        const response = await fetch('/data/elementos-fijos/index.json');
        if (!isMounted) return;

        if (response.ok) {
          const data = await response.json();
          if (isMounted) {
            setFixedElements(data.elements || []);
          }
        }
      } catch (error) {
        console.error('Error loading fixed elements:', error);
      }
    };

    loadFixedElements();

    return () => {
      isMounted = false;
    };
  }, []);

  // Clear selection when switching tabs
  useEffect(() => {
    setSelectedSong(null);
    setSelectedFixedElement(null);
    setPreviewSlides([]);
  }, [activeTab]);

  // Filter songs
  const filteredSongs = useMemo(() => {
    let result = songs;

    if (tempoFilter !== 'all') {
      result = filterSongsByTempo(result, tempoFilter);
    }

    if (searchQuery.trim()) {
      result = searchSongsWithFilters(result, { query: searchQuery });
    }

    return result;
  }, [songs, tempoFilter, searchQuery]);

  // Handle song selection
  const handleSelectSong = useCallback((song: Song) => {
    setSelectedSong(song);
    setSelectedFixedElement(null);
    const slideGroup = songToSlides(song, { theme });
    setPreviewSlides(slideGroup.slides);
  }, [theme]);

  // Handle fixed element selection
  const handleSelectFixedElement = useCallback(async (element: FixedElementIndex) => {
    setSelectedFixedElement(element);
    setSelectedSong(null);
    setIsLoadingElement(true);

    try {
      const response = await fetch(`/data/elementos-fijos/${element.id}.json`);
      if (response.ok) {
        const data: FixedElement = await response.json();

        // Use the proper fixedElementToSlides function with theme support
        const slideGroup = fixedElementToSlides(data, { theme });
        setPreviewSlides(slideGroup.slides);
      }
    } catch (error) {
      console.error('Error loading fixed element:', error);
    } finally {
      setIsLoadingElement(false);
    }
  }, [theme]);

  // Handle insert
  const handleInsert = useCallback(() => {
    if (previewSlides.length === 0) return;

    // Map to LiturgyElementType: songs use 'cancion-invocacion' as generic, fixed elements use their type
    const elementInfo = selectedSong
      ? { type: 'cancion-invocacion', title: selectedSong.title }
      : selectedFixedElement
      ? { type: selectedFixedElement.type, title: selectedFixedElement.title }
      : { type: 'cancion-invocacion', title: 'Unknown' };

    onSelectScene(previewSlides, elementInfo);
  }, [previewSlides, selectedSong, selectedFixedElement, onSelectScene]);

  const hasSelection = selectedSong || selectedFixedElement;

  return (
    <div className="flex flex-col h-full max-h-[70vh]">
      {/* Tabs */}
      <div
        className="flex gap-2 p-2 border-b"
        style={{ borderColor: CASA_BRAND.colors.secondary.grayDark }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('canciones')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'canciones' ? 'ring-1' : ''
          }`}
          style={{
            backgroundColor: activeTab === 'canciones'
              ? CASA_BRAND.colors.primary.amber
              : CASA_BRAND.colors.secondary.grayDark,
            color: activeTab === 'canciones'
              ? CASA_BRAND.colors.primary.white
              : CASA_BRAND.colors.secondary.grayMedium,
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
            ringColor: CASA_BRAND.colors.primary.amber,
          }}
        >
          <Music size={16} />
          Canciones
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('fijos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'fijos' ? 'ring-1' : ''
          }`}
          style={{
            backgroundColor: activeTab === 'fijos'
              ? CASA_BRAND.colors.primary.amber
              : CASA_BRAND.colors.secondary.grayDark,
            color: activeTab === 'fijos'
              ? CASA_BRAND.colors.primary.white
              : CASA_BRAND.colors.secondary.grayMedium,
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
            ringColor: CASA_BRAND.colors.primary.amber,
          }}
        >
          <BookOpen size={16} />
          Elementos Fijos
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: List */}
        <div className="w-1/2 flex flex-col border-r" style={{ borderColor: CASA_BRAND.colors.secondary.grayDark }}>
          {/* Search (only for songs) */}
          {activeTab === 'canciones' && (
            <div className="p-3 space-y-2 border-b" style={{ borderColor: CASA_BRAND.colors.secondary.grayDark }}>
              <div className="relative">
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
                    backgroundColor: CASA_BRAND.colors.secondary.carbon,
                    borderColor: CASA_BRAND.colors.secondary.grayDark,
                    color: CASA_BRAND.colors.primary.white,
                    fontFamily: CASA_BRAND.fonts.body,
                    fontSize: '14px',
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

              {/* Tempo filter */}
              <select
                value={tempoFilter}
                onChange={(e) => setTempoFilter(e.target.value as SongTempo | 'all')}
                className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: CASA_BRAND.colors.secondary.carbon,
                  borderColor: CASA_BRAND.colors.secondary.grayDark,
                  color: CASA_BRAND.colors.primary.white,
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '13px',
                }}
              >
                <option value="all">Todos los tempos</option>
                {Object.entries(TEMPO_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* List */}
          <div
            className="flex-1 overflow-y-auto p-3 space-y-2"
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
            ) : activeTab === 'canciones' ? (
              filteredSongs.length === 0 ? (
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
                    No se encontraron canciones
                  </p>
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
                    {filteredSongs.length} canciones
                  </p>
                  {filteredSongs.map((song) => (
                    <SongCard
                      key={song.id}
                      song={song}
                      isSelected={selectedSong?.id === song.id}
                      onSelect={() => handleSelectSong(song)}
                    />
                  ))}
                </>
              )
            ) : (
              fixedElements.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen
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
                    No hay elementos fijos
                  </p>
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
                    {fixedElements.length} elementos
                  </p>
                  {fixedElements.map((element) => (
                    <FixedElementCard
                      key={element.id}
                      element={element}
                      isSelected={selectedFixedElement?.id === element.id}
                      onSelect={() => handleSelectFixedElement(element)}
                    />
                  ))}
                </>
              )
            )}
          </div>
        </div>

        {/* Right: Preview */}
        <div className="w-1/2 flex flex-col">
          {hasSelection && previewSlides.length > 0 ? (
            <div className="flex-1 flex flex-col overflow-hidden p-3">
              <div className="flex items-center justify-between mb-3">
                <h4
                  style={{
                    fontFamily: CASA_BRAND.fonts.body,
                    fontSize: '14px',
                    fontWeight: 500,
                    color: CASA_BRAND.colors.primary.white,
                  }}
                >
                  Vista previa: {selectedSong?.title || selectedFixedElement?.title}
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

              <p
                className="text-xs mb-3"
                style={{
                  color: CASA_BRAND.colors.secondary.grayMedium,
                  fontFamily: CASA_BRAND.fonts.body,
                }}
              >
                {previewSlides.length} slides se insertarán después del slide {currentSlideIndex + 1}
              </p>

              {showPreview && (
                <div
                  className="flex-1 overflow-y-auto"
                  style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: `${CASA_BRAND.colors.secondary.grayLight} transparent`,
                  }}
                >
                  {isLoadingElement ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2
                        size={24}
                        className="animate-spin"
                        style={{ color: CASA_BRAND.colors.primary.amber }}
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {previewSlides.map((slide, index) => (
                        <div key={slide.id} className="relative">
                          <SlidePreviewThumb slide={slide} />
                          <span
                            className="absolute bottom-1 right-1 text-xs px-1 rounded"
                            style={{
                              backgroundColor: 'rgba(0,0,0,0.7)',
                              color: CASA_BRAND.colors.primary.white,
                              fontFamily: CASA_BRAND.fonts.body,
                            }}
                          >
                            {index + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div
              className="flex-1 flex items-center justify-center p-8"
            >
              <div className="text-center">
                {activeTab === 'canciones' ? (
                  <Music
                    size={40}
                    className="mx-auto mb-3"
                    style={{ color: CASA_BRAND.colors.secondary.grayDark }}
                  />
                ) : (
                  <BookOpen
                    size={40}
                    className="mx-auto mb-3"
                    style={{ color: CASA_BRAND.colors.secondary.grayDark }}
                  />
                )}
                <p
                  style={{
                    fontFamily: CASA_BRAND.fonts.body,
                    fontSize: '14px',
                    color: CASA_BRAND.colors.secondary.grayMedium,
                  }}
                >
                  Selecciona un elemento para ver la vista previa
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-end gap-3 p-3 border-t"
        style={{ borderColor: CASA_BRAND.colors.secondary.grayDark }}
      >
        <Button
          variant="ghost"
          onClick={onCancel}
          style={{
            color: CASA_BRAND.colors.secondary.grayMedium,
          }}
        >
          Cancelar
        </Button>
        <Button
          onClick={handleInsert}
          disabled={!hasSelection || previewSlides.length === 0}
          className="flex items-center gap-2"
          style={{
            backgroundColor: hasSelection
              ? CASA_BRAND.colors.primary.amber
              : CASA_BRAND.colors.secondary.grayDark,
            color: CASA_BRAND.colors.primary.white,
          }}
        >
          <Check size={16} />
          Insertar Escena ({previewSlides.length} slides)
        </Button>
      </div>
    </div>
  );
};

export default SceneSelector;
