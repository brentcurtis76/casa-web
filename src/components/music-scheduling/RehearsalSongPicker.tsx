/**
 * RehearsalSongPicker — Dialog to add songs to a rehearsal.
 *
 * Shows a searchable list of all songs, excluding already-added ones.
 */

import { useState, useMemo } from 'react';
import { useSongs, useAddRehearsalSong } from '@/hooks/useMusicLibrary';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { CASA_BRAND } from '@/lib/brand-kit';
import { Search } from 'lucide-react';

interface RehearsalSongPickerProps {
  rehearsalId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingSongIds: string[];
}

const RehearsalSongPicker = ({ rehearsalId, open, onOpenChange, existingSongIds }: RehearsalSongPickerProps) => {
  const { data: allSongs, isLoading } = useSongs();
  const addSong = useAddRehearsalSong();
  const [search, setSearch] = useState('');
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const filteredSongs = useMemo(() => {
    if (!allSongs) return [];
    const excludeIds = new Set([...existingSongIds, ...addedIds]);
    const q = search.toLowerCase().trim();
    return allSongs.filter((song) => {
      if (excludeIds.has(song.id)) return false;
      if (!q) return true;
      return (
        song.title.toLowerCase().includes(q) ||
        (song.artist && song.artist.toLowerCase().includes(q))
      );
    });
  }, [allSongs, existingSongIds, addedIds, search]);

  const handleAdd = (songId: string) => {
    addSong.mutate(
      {
        rehearsal_id: rehearsalId,
        song_id: songId,
        sort_order: existingSongIds.length + addedIds.size,
      },
      {
        onSuccess: () => {
          setAddedIds((prev) => new Set([...prev, songId]));
        },
      }
    );
  };

  // Reset local state when dialog closes
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSearch('');
      setAddedIds(new Set());
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] p-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle style={{ fontFamily: CASA_BRAND.fonts.heading, fontWeight: 300 }}>
            Agregar canción al ensayo
          </DialogTitle>
          <DialogDescription>
            Busca y selecciona canciones para agregar al ensayo.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: CASA_BRAND.colors.secondary.grayMedium }} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título o artista..."
              className="pl-9"
            />
          </div>
        </div>

        <ScrollArea className="flex-1 px-6">
          {isLoading ? (
            <div className="space-y-2 py-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredSongs.length === 0 ? (
            <p className="py-8 text-center text-sm" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
              {search ? 'No se encontraron canciones.' : 'Todas las canciones ya están agregadas.'}
            </p>
          ) : (
            <div className="space-y-1 py-2">
              {filteredSongs.map((song) => (
                <div
                  key={song.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                  style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{song.title}</p>
                    {song.artist && (
                      <p className="text-xs truncate" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                        {song.artist}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAdd(song.id)}
                    disabled={addSong.isPending}
                    className="ml-3 shrink-0"
                  >
                    Agregar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t" style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RehearsalSongPicker;
