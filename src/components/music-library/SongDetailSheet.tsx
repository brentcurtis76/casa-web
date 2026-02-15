/**
 * SongDetailSheet — Right-side sheet showing full song details.
 *
 * Uses useSongById() for the full nested query (arrangements + stems + charts + audio refs).
 * Contains 4 tabs: Arreglos, Referencias, Uso, Letra.
 */

import { useSongById } from '@/hooks/useMusicLibrary';
import { useNavigate } from 'react-router-dom';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Pencil, Trash2, Music, Link2, BarChart3, FileText, Headphones } from 'lucide-react';
import { TEMPO_LABELS, THEME_LABELS, THEME_COLORS, MOMENT_LABELS } from '@/lib/canciones/songTagsManager';
import { formatDuration } from '@/lib/music-planning/formatters';
import { CASA_BRAND } from '@/lib/brand-kit';
import type { SongTheme, LiturgicalMoment, VerseType } from '@/types/shared/song';
import ArrangementManager from './ArrangementManager';
import AudioReferenceLinks from './AudioReferenceLinks';
import SongUsageHistory from './SongUsageHistory';

interface SongDetailSheetProps {
  songId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canWrite: boolean;
  canManage: boolean;
  onEditClick: () => void;
  onDeleteClick: (songId: string, title: string) => void;
}

const VERSE_TYPE_LABELS: Record<VerseType, string> = {
  verse: 'Verso',
  chorus: 'Coro',
  bridge: 'Puente',
  outro: 'Final',
  intro: 'Intro',
};

const SongDetailSheet = ({ songId, open, onOpenChange, canWrite, canManage, onEditClick, onDeleteClick }: SongDetailSheetProps) => {
  const { data: song, isLoading } = useSongById(songId);
  const navigate = useNavigate();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl p-0 flex flex-col">
        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : !song ? (
          <div className="p-6">
            <SheetHeader>
              <SheetTitle>Canción no encontrada</SheetTitle>
              <SheetDescription>
                La canción solicitada no existe o fue eliminada.
              </SheetDescription>
            </SheetHeader>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-6 pb-4 border-b" style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}>
              <SheetHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <SheetTitle
                      className="text-xl"
                      style={{ fontFamily: CASA_BRAND.fonts.heading, fontWeight: 300 }}
                    >
                      {song.title}
                    </SheetTitle>
                    <SheetDescription className="mt-1">
                      {song.artist ?? 'Artista desconocido'}
                      {song.number != null && ` — #${song.number}`}
                    </SheetDescription>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {canWrite && (
                      <Button variant="outline" size="sm" onClick={onEditClick} className="gap-2">
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </Button>
                    )}
                    {canManage && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDeleteClick(song.id, song.title)}
                        className="gap-2 text-red-500 hover:text-red-600 border-red-200 hover:border-red-300"
                        aria-label="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Eliminar
                      </Button>
                    )}
                  </div>
                </div>

                {/* Practice link button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs mt-2"
                  onClick={() => navigate(`/admin/musica/programacion?tab=practica&songId=${song.id}`)}
                >
                  <Headphones className="h-3.5 w-3.5" />
                  Practicar esta canción
                </Button>
              </SheetHeader>

              {/* Meta row */}
              <div className="mt-4 flex flex-wrap gap-2 items-center">
                {song.original_key && (
                  <Badge variant="outline">Tonalidad: {song.original_key}</Badge>
                )}
                {song.tempo && (
                  <Badge variant="secondary">{TEMPO_LABELS[song.tempo]}</Badge>
                )}
                {song.duration_seconds && (
                  <Badge variant="outline">{formatDuration(song.duration_seconds)}</Badge>
                )}
                {song.ccli_number && (
                  <Badge variant="outline">CCLI: {song.ccli_number}</Badge>
                )}
              </div>

              {/* Themes */}
              {song.themes && song.themes.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {song.themes.map((theme) => (
                    <Badge
                      key={theme}
                      variant="outline"
                      style={{
                        borderColor: THEME_COLORS[theme as SongTheme] ?? '#888',
                        color: THEME_COLORS[theme as SongTheme] ?? '#888',
                      }}
                    >
                      {THEME_LABELS[theme as SongTheme] ?? theme}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Moments */}
              {song.suggested_moments && song.suggested_moments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {song.suggested_moments.map((moment) => (
                    <Badge
                      key={moment}
                      variant="secondary"
                      className="text-xs"
                    >
                      {MOMENT_LABELS[moment as LiturgicalMoment] ?? moment}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Tabs */}
            <Tabs defaultValue="arreglos" className="flex-1 flex flex-col overflow-hidden">
              <div className="overflow-x-auto mx-6 mt-4">
                <TabsList className="inline-flex w-auto min-w-full md:grid md:w-full md:grid-cols-4">
                  <TabsTrigger value="arreglos" className="gap-1.5 whitespace-nowrap">
                    <Music className="h-3.5 w-3.5" />
                    Arreglos
                  </TabsTrigger>
                  <TabsTrigger value="referencias" className="gap-1.5 whitespace-nowrap">
                    <Link2 className="h-3.5 w-3.5" />
                    Referencias
                  </TabsTrigger>
                  <TabsTrigger value="uso" className="gap-1.5 whitespace-nowrap">
                    <BarChart3 className="h-3.5 w-3.5" />
                    Uso
                  </TabsTrigger>
                  <TabsTrigger value="letra" className="gap-1.5 whitespace-nowrap">
                    <FileText className="h-3.5 w-3.5" />
                    Letra
                  </TabsTrigger>
                </TabsList>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-6">
                  <TabsContent value="arreglos" className="mt-0">
                    <ArrangementManager
                      songId={song.id}
                      arrangements={song.music_arrangements}
                      canWrite={canWrite}
                      canManage={canManage}
                    />
                  </TabsContent>

                  <TabsContent value="referencias" className="mt-0">
                    <AudioReferenceLinks
                      songId={song.id}
                      references={song.music_audio_references}
                      canWrite={canWrite}
                      canManage={canManage}
                    />
                  </TabsContent>

                  <TabsContent value="uso" className="mt-0">
                    <SongUsageHistory songId={song.id} />
                  </TabsContent>

                  <TabsContent value="letra" className="mt-0">
                    {song.lyrics && song.lyrics.length > 0 ? (
                      <div className="space-y-6">
                        {song.lyrics.map((verse) => (
                          <div key={`${verse.type}-${verse.number}`}>
                            <p
                              className="text-xs font-semibold uppercase tracking-wider mb-2"
                              style={{ color: CASA_BRAND.colors.primary.amber }}
                            >
                              {VERSE_TYPE_LABELS[verse.type] ?? verse.type}
                              {verse.type === 'verse' && ` ${verse.number}`}
                            </p>
                            <p
                              className="whitespace-pre-wrap leading-relaxed"
                              style={{
                                fontFamily: CASA_BRAND.fonts.body,
                                fontSize: '14px',
                                color: CASA_BRAND.colors.primary.black,
                              }}
                            >
                              {verse.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p
                        className="text-center py-8"
                        style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                      >
                        No hay letra registrada para esta canción.
                      </p>
                    )}
                  </TabsContent>
                </div>
              </ScrollArea>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default SongDetailSheet;
