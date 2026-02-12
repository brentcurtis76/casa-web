/**
 * RehearsalAttendeePicker — Dialog to invite musicians to a rehearsal.
 *
 * Shows a searchable list of active musicians, excluding already-invited ones.
 */

import { useState, useMemo } from 'react';
import { useMusicians, useAddRehearsalAttendee } from '@/hooks/useMusicLibrary';
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
import { CASA_BRAND } from '@/lib/brand-kit';
import { INSTRUMENT_LABELS } from '@/lib/music-planning/musicianLabels';
import { Search } from 'lucide-react';
import type { InstrumentType } from '@/types/musicPlanning';

interface RehearsalAttendeePickerProps {
  rehearsalId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingMusicianIds: string[];
}

const RehearsalAttendeePicker = ({ rehearsalId, open, onOpenChange, existingMusicianIds }: RehearsalAttendeePickerProps) => {
  const { data: musicians, isLoading } = useMusicians({ isActive: true });
  const addAttendee = useAddRehearsalAttendee();
  const [search, setSearch] = useState('');
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const filteredMusicians = useMemo(() => {
    if (!musicians) return [];
    const excludeIds = new Set([...existingMusicianIds, ...addedIds]);
    const q = search.toLowerCase().trim();
    return musicians.filter((m) => {
      if (excludeIds.has(m.id)) return false;
      if (!q) return true;
      return m.display_name.toLowerCase().includes(q);
    });
  }, [musicians, existingMusicianIds, addedIds, search]);

  const handleInvite = (musicianId: string) => {
    addAttendee.mutate(
      {
        rehearsal_id: rehearsalId,
        musician_id: musicianId,
      },
      {
        onSuccess: () => {
          setAddedIds((prev) => new Set([...prev, musicianId]));
        },
      }
    );
  };

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
            Invitar músicos al ensayo
          </DialogTitle>
          <DialogDescription>
            Busca y selecciona músicos para invitar al ensayo.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: CASA_BRAND.colors.secondary.grayMedium }} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre..."
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
          ) : filteredMusicians.length === 0 ? (
            <p className="py-8 text-center text-sm" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
              {search ? 'No se encontraron músicos.' : 'Todos los músicos ya están invitados.'}
            </p>
          ) : (
            <div className="space-y-1 py-2">
              {filteredMusicians.map((musician) => {
                const primary = musician.instruments.find((i) => i.is_primary);
                return (
                  <div
                    key={musician.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                    style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-sm font-medium truncate">{musician.display_name}</span>
                      {primary && (
                        <Badge variant="outline" className="shrink-0">
                          {INSTRUMENT_LABELS[primary.instrument as InstrumentType] ?? primary.instrument}
                        </Badge>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleInvite(musician.id)}
                      disabled={addAttendee.isPending}
                      className="ml-3 shrink-0"
                    >
                      Invitar
                    </Button>
                  </div>
                );
              })}
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

export default RehearsalAttendeePicker;
