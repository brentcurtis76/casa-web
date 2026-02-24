/**
 * MeetingEditDialog — Create or edit a meeting
 * NOTE: Uses `meeting_date` field (not `date`)
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { createMeeting, updateMeeting } from '@/lib/leadership/meetingService';
import type { MeetingRow, MeetingTypeRow } from '@/types/leadershipModule';

interface MeetingEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting?: MeetingRow;
  meetingTypes: MeetingTypeRow[];
  onSaved: () => void;
}

interface MeetingFormData {
  meeting_type_id: string;
  title: string;
  meeting_date: string;
  start_time: string;
  end_time: string;
  location: string;
  description: string;
  status: string;
}

const MeetingEditDialog = ({
  open,
  onOpenChange,
  meeting,
  meetingTypes,
  onSaved,
}: MeetingEditDialogProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<MeetingFormData>({
    meeting_type_id: '',
    title: '',
    meeting_date: '',
    start_time: '',
    end_time: '',
    location: '',
    description: '',
    status: 'scheduled',
  });

  useEffect(() => {
    if (meeting && open) {
      setFormData({
        meeting_type_id: meeting.meeting_type_id,
        title: meeting.title,
        meeting_date: meeting.meeting_date,
        start_time: meeting.start_time ?? '',
        end_time: meeting.end_time ?? '',
        location: meeting.location ?? '',
        description: meeting.description ?? '',
        status: meeting.status,
      });
    } else if (!meeting && open) {
      setFormData({
        meeting_type_id: meetingTypes[0]?.id ?? '',
        title: '',
        meeting_date: '',
        start_time: '',
        end_time: '',
        location: '',
        description: '',
        status: 'scheduled',
      });
    }
  }, [meeting, open, meetingTypes]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.meeting_type_id || !formData.title || !formData.meeting_date) {
      toast({
        title: 'Error',
        description: 'Completa los campos requeridos: tipo, título y fecha',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        meeting_type_id: formData.meeting_type_id,
        title: formData.title,
        meeting_date: formData.meeting_date,
        start_time: formData.start_time || null,
        end_time: formData.end_time || null,
        location: formData.location || null,
        description: formData.description || null,
        status: formData.status as MeetingRow['status'],
        agenda_url: null,
        created_by: null,
      };

      if (meeting) {
        await updateMeeting(meeting.id, payload);
        toast({ title: 'Éxito', description: 'Reunión actualizada correctamente' });
      } else {
        await createMeeting(payload);
        toast({ title: 'Éxito', description: 'Reunión creada correctamente' });
      }

      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast({
        title: 'Error',
        description: `Error al guardar: ${error instanceof Error ? error.message : 'desconocido'}`,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{meeting ? 'Editar Reunión' : 'Nueva Reunión'}</DialogTitle>
          <DialogDescription>
            {meeting ? 'Modifica los detalles de la reunión' : 'Crea una nueva reunión de liderazgo'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="meeting_type_id">Tipo de Reunión *</Label>
            <Select
              value={formData.meeting_type_id}
              onValueChange={(value) => handleSelectChange('meeting_type_id', value)}
            >
              <SelectTrigger id="meeting_type_id">
                <SelectValue placeholder="Selecciona un tipo" />
              </SelectTrigger>
              <SelectContent>
                {meetingTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Ej: Concilio Febrero 2026"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="meeting_date">Fecha *</Label>
            <Input
              id="meeting_date"
              name="meeting_date"
              type="date"
              value={formData.meeting_date}
              onChange={handleInputChange}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="start_time">Hora Inicio</Label>
              <Input
                id="start_time"
                name="start_time"
                type="time"
                value={formData.start_time}
                onChange={handleInputChange}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="end_time">Hora Fin</Label>
              <Input
                id="end_time"
                name="end_time"
                type="time"
                value={formData.end_time}
                onChange={handleInputChange}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="location">Lugar</Label>
            <Input
              id="location"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              placeholder="Ej: Sala de Reuniones"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="status">Estado</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => handleSelectChange('status', value)}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">Programada</SelectItem>
                <SelectItem value="in_progress">En Curso</SelectItem>
                <SelectItem value="completed">Completada</SelectItem>
                <SelectItem value="cancelled">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="description">Descripción / Agenda</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Puntos a tratar..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-amber-600 hover:bg-amber-700 text-stone-900"
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {meeting ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default MeetingEditDialog;
