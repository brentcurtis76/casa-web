/**
 * SetlistEditDialog — Dialog for creating or editing a setlist.
 *
 * When setlistId is null, it's a "create" dialog. When setlistId is provided,
 * it loads existing data and allows updating.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  useSetlistById,
  useCreateSetlist,
  useUpdateSetlist,
  useUpcomingServiceDates,
} from '@/hooks/useMusicLibrary';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
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
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface SetlistEditDialogProps {
  setlistId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NO_SERVICE_DATE = '__none__';

const SetlistEditDialog = ({ setlistId, open, onOpenChange }: SetlistEditDialogProps) => {
  const isEditing = setlistId !== null;
  const { data: existingSetlist, isLoading } = useSetlistById(setlistId);
  const { data: upcomingServiceDates } = useUpcomingServiceDates(20);
  const createSetlist = useCreateSetlist();
  const updateSetlist = useUpdateSetlist();

  // Form state
  const [title, setTitle] = useState('');
  const [serviceDateId, setServiceDateId] = useState<string>(NO_SERVICE_DATE);

  const resetForm = useCallback(() => {
    setTitle('');
    setServiceDateId(NO_SERVICE_DATE);
  }, []);

  // Populate form when editing
  useEffect(() => {
    if (isEditing && existingSetlist) {
      setTitle(existingSetlist.title ?? '');
      setServiceDateId(existingSetlist.service_date_id ?? NO_SERVICE_DATE);
    } else if (!isEditing) {
      resetForm();
    }
  }, [isEditing, existingSetlist, resetForm]);

  // Reset on close
  useEffect(() => {
    if (!open) resetForm();
  }, [open, resetForm]);

  const handleSubmit = () => {
    if (serviceDateId === NO_SERVICE_DATE) return;

    const setlistData = {
      service_date_id: serviceDateId,
      title: title.trim() || null,
    };

    if (isEditing && setlistId) {
      updateSetlist.mutate(
        { id: setlistId, updates: setlistData },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      createSetlist.mutate(setlistData, {
        onSuccess: () => {
          onOpenChange(false);
          resetForm();
        },
      });
    }
  };

  const isPending = createSetlist.isPending || updateSetlist.isPending;
  const canSubmit = serviceDateId !== NO_SERVICE_DATE && serviceDateId !== '' && !isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle style={{ fontFamily: CASA_BRAND.fonts.heading, fontWeight: 300 }}>
            {isEditing ? 'Editar setlist' : 'Nueva setlist'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modifica los datos de la setlist.'
              : 'Completa los campos para crear una nueva setlist.'}
          </DialogDescription>
        </DialogHeader>

        {isEditing && isLoading ? (
          <div className="px-6 py-8 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <ScrollArea className="flex-1 px-6">
            <div className="space-y-5 pb-4">
              <div className="space-y-2">
                <Label>Fecha de servicio *</Label>
                <Select value={serviceDateId === NO_SERVICE_DATE ? '' : serviceDateId} onValueChange={setServiceDateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar fecha de servicio..." />
                  </SelectTrigger>
                  <SelectContent>
                    {upcomingServiceDates?.map((sd) => (
                      <SelectItem key={sd.id} value={sd.id}>
                        {format(parseISO(sd.date), "EEE d MMM yyyy", { locale: es })}
                        {sd.title ? ` — ${sd.title}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="setlistTitle">Título</Label>
                <Input
                  id="setlistTitle"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Setlist de adoración"
                />
              </div>
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="px-6 py-4 border-t" style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isPending
              ? isEditing ? 'Guardando...' : 'Creando...'
              : isEditing ? 'Guardar cambios' : 'Crear setlist'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SetlistEditDialog;
