/**
 * RehearsalEditDialog — Dialog for creating or editing a rehearsal.
 *
 * When rehearsalId is null, it's a "create" dialog. When rehearsalId is provided,
 * it loads existing data and allows updating.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  useRehearsalById,
  useCreateRehearsal,
  useUpdateRehearsal,
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
import { Textarea } from '@/components/ui/textarea';
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

interface RehearsalEditDialogProps {
  rehearsalId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NO_SERVICE_DATE = '__none__';

const RehearsalEditDialog = ({ rehearsalId, open, onOpenChange }: RehearsalEditDialogProps) => {
  const isEditing = rehearsalId !== null;
  const { data: existingRehearsal, isLoading } = useRehearsalById(rehearsalId);
  const { data: upcomingServiceDates } = useUpcomingServiceDates(20);
  const createRehearsal = useCreateRehearsal();
  const updateRehearsal = useUpdateRehearsal();

  // Form state
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [serviceDateId, setServiceDateId] = useState<string>(NO_SERVICE_DATE);
  const [notes, setNotes] = useState('');

  const resetForm = useCallback(() => {
    setDate('');
    setStartTime('');
    setEndTime('');
    setLocation('');
    setServiceDateId(NO_SERVICE_DATE);
    setNotes('');
  }, []);

  // Populate form when editing
  useEffect(() => {
    if (isEditing && existingRehearsal) {
      setDate(existingRehearsal.date);
      setStartTime(existingRehearsal.start_time ?? '');
      setEndTime(existingRehearsal.end_time ?? '');
      setLocation(existingRehearsal.location ?? '');
      setServiceDateId(existingRehearsal.service_date_id ?? NO_SERVICE_DATE);
      setNotes(existingRehearsal.notes ?? '');
    } else if (!isEditing) {
      resetForm();
    }
  }, [isEditing, existingRehearsal, resetForm]);

  // Reset on close
  useEffect(() => {
    if (!open) resetForm();
  }, [open, resetForm]);

  const handleSubmit = () => {
    if (!date) return;

    const rehearsalData = {
      date,
      start_time: startTime.trim() || null,
      end_time: endTime.trim() || null,
      location: location.trim() || null,
      service_date_id: serviceDateId === NO_SERVICE_DATE ? null : serviceDateId,
      notes: notes.trim() || null,
    };

    if (isEditing && rehearsalId) {
      updateRehearsal.mutate(
        { id: rehearsalId, updates: rehearsalData },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      createRehearsal.mutate(rehearsalData, {
        onSuccess: () => {
          onOpenChange(false);
          resetForm();
        },
      });
    }
  };

  const isPending = createRehearsal.isPending || updateRehearsal.isPending;
  const canSubmit = date.trim().length > 0 && !isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle style={{ fontFamily: CASA_BRAND.fonts.heading, fontWeight: 300 }}>
            {isEditing ? 'Editar ensayo' : 'Nuevo ensayo'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modifica los datos del ensayo.'
              : 'Completa los campos para programar un nuevo ensayo.'}
          </DialogDescription>
        </DialogHeader>

        {isEditing && isLoading ? (
          <div className="px-6 py-8 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <ScrollArea className="flex-1 px-6">
            <div className="space-y-5 pb-4">
              <div className="space-y-2">
                <Label htmlFor="rehearsalDate">Fecha *</Label>
                <Input
                  id="rehearsalDate"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime">Hora inicio</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">Hora fin</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Ubicación</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ej: Salón parroquial"
                />
              </div>

              <div className="space-y-2">
                <Label>Fecha de servicio vinculada</Label>
                <Select value={serviceDateId} onValueChange={setServiceDateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="(Sin vincular)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SERVICE_DATE}>(Sin vincular)</SelectItem>
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
                <Label htmlFor="rehearsalNotes">Notas</Label>
                <Textarea
                  id="rehearsalNotes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notas opcionales sobre el ensayo..."
                  rows={3}
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
              : isEditing ? 'Guardar cambios' : 'Crear ensayo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RehearsalEditDialog;
