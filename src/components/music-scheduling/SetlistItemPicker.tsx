/**
 * SetlistItemPicker — Dialog to add songs to a setlist.
 *
 * Shows a searchable list of all songs, excluding already-added ones.
 * Each song row allows setting key and liturgical moment before adding.
 */

import { useState, useMemo } from 'react';
import { useSongs, useAddSetlistItem } from '@/hooks/useMusicLibrary';
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
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CASA_BRAND } from '@/lib/brand-kit';
import { LITURGICAL_MOMENT_LABELS } from '@/lib/music-planning/setlistLabels';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';

interface SetlistItemPickerProps {
  setlistId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingSongIds: string[];
}

const MUSICAL_KEYS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];

const NO_KEY = '__no_key__';
const NO_MOMENT = '__none__';

const SetlistItemPicker = ({ setlistId, open, onOpenChange, existingSongIds }: SetlistItemPickerProps) => {
  const { data: allSongs, isLoading } = useSongs();
  const addItem = useAddSetlistItem();
  const [search, setSearch] = useState('');
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  // Expanded song form state
  const [expandedSongId, setExpandedSongId] = useState<string | null>(null);
  const [formKey, setFormKey] = useState<string>(NO_KEY);
  const [formMoment, setFormMoment] = useState<string>(NO_MOMENT);
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

  const resetForm = () => {
    setFormKey(NO_KEY);
    setFormMoment(NO_MOMENT);
  };

  const handleExpand = (songId: string, originalKey: string | null) => {
    if (expandedSongId === songId) {
      setExpandedSongId(null);
      resetForm();
      return;
    }
    setExpandedSongId(songId);
    setFormKey(originalKey ?? NO_KEY);
    setFormMoment(NO_MOMENT);
  };

  const handleAdd = (songId: string) => {
    addItem.mutate(
      {
        setlist_id: setlistId,
        song_id: songId,
        sort_order: existingSongIds.length + addedIds.size,
        song_key: formKey === NO_KEY ? null : formKey,
        liturgical_moment: formMoment === NO_MOMENT ? null : formMoment,
      },
      {
        onSuccess: () => {
          setAddedIds((prev) => new Set([...prev, songId]));
          setExpandedSongId(null);
          resetForm();
        },
      }
    );
  };

  // Reset local state when dialog closes
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSearch('');
      setAddedIds(new Set());
      setExpandedSongId(null);
      resetForm();
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] p-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle style={{ fontFamily: CASA_BRAND.fonts.heading, fontWeight: 300 }}>
            Agregar canción a la setlist
          </DialogTitle>
          <DialogDescription>
            Busca y selecciona canciones para agregar a la setlist.
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
                  className="rounded-lg border"
                  style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
                >
                  <div
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
                    onClick={() => handleExpand(song.id, song.original_key)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{song.title}</p>
                        {song.original_key && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            {song.original_key}
                          </Badge>
                        )}
                      </div>
                      {song.artist && (
                        <p className="text-xs truncate" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                          {song.artist}
                        </p>
                      )}
                    </div>
                    <div className="ml-3 shrink-0">
                      {expandedSongId === song.id ? (
                        <ChevronUp className="h-4 w-4" style={{ color: CASA_BRAND.colors.secondary.grayMedium }} />
                      ) : (
                        <ChevronDown className="h-4 w-4" style={{ color: CASA_BRAND.colors.secondary.grayMedium }} />
                      )}
                    </div>
                  </div>

                  {expandedSongId === song.id && (
                    <div className="px-3 pb-3 space-y-3 border-t" style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}>
                      <div className="grid grid-cols-2 gap-3 pt-3">
                        <div className="space-y-1">
                          <label className="text-xs font-medium" style={{ color: CASA_BRAND.colors.secondary.grayDark }}>
                            Tono
                          </label>
                          <Select value={formKey} onValueChange={setFormKey}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NO_KEY}>(Sin tono)</SelectItem>
                              {MUSICAL_KEYS.map((k) => (
                                <SelectItem key={k} value={k}>{k}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium" style={{ color: CASA_BRAND.colors.secondary.grayDark }}>
                            Momento litúrgico
                          </label>
                          <Select value={formMoment} onValueChange={setFormMoment}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NO_MOMENT}>(Sin momento)</SelectItem>
                              {Object.entries(LITURGICAL_MOMENT_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleAdd(song.id)}
                        disabled={addItem.isPending}
                        className="w-full"
                      >
                        Agregar
                      </Button>
                    </div>
                  )}
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

export default SetlistItemPicker;
