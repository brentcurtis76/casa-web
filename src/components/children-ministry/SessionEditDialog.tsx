/**
 * SessionEditDialog — Form for creating/editing calendar sessions
 * Handles all 8 form fields for session creation and editing
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { createSession, updateSession, getSession } from '@/lib/children-ministry/calendarService';
import { getLessons } from '@/lib/children-ministry/lessonService';
import type { ChildrenAgeGroupRow, SessionStatus, ChildrenLessonRow } from '@/types/childrenMinistry';

interface SessionEditDialogProps {
  sessionId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  ageGroups: ChildrenAgeGroupRow[];
}

const SessionEditDialog = ({
  sessionId,
  open,
  onOpenChange,
  onSuccess,
  ageGroups,
}: SessionEditDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lessons, setLessons] = useState<ChildrenLessonRow[]>([]);

  const [formData, setFormData] = useState({
    date: '',
    start_time: '10:00',
    end_time: '11:00',
    age_group_id: '',
    lesson_id: '',
    location: 'Sala Infantil',
    notes: '',
    status: 'scheduled' as SessionStatus,
  });

  // Load ready lessons on mount
  useEffect(() => {
    const loadLessons = async () => {
      try {
        const readyLessons = await getLessons({ status: 'ready' });
        setLessons(readyLessons);
      } catch {
        // Silently fail on lesson dropdown load
      }
    };

    loadLessons();
  }, []);

  // Load session data if editing
  useEffect(() => {
    if (sessionId && open) {
      const loadSession = async () => {
        setLoading(true);
        try {
          const session = await getSession(sessionId);
          setFormData({
            date: session.date,
            start_time: session.start_time,
            end_time: session.end_time,
            age_group_id: session.age_group_id,
            lesson_id: session.lesson_id || '',
            location: session.location,
            notes: session.notes || '',
            status: session.status,
          });
        } catch (error) {
          toast({
            title: 'Error',
            description: 'No se pudo cargar la clase',
            variant: 'destructive',
          });
        } finally {
          setLoading(false);
        }
      };

      loadSession();
    } else if (open && !sessionId) {
      const today = new Date().toISOString().split('T')[0];
      setFormData({
        date: today,
        start_time: '10:00',
        end_time: '11:00',
        age_group_id: '',
        lesson_id: '',
        location: 'Sala Infantil',
        notes: '',
        status: 'scheduled',
      });
    }
  }, [sessionId, open, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.date || !formData.age_group_id) {
      toast({
        title: 'Error',
        description: 'Fecha y grupo de edad son requeridos',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const sessionData = {
        date: formData.date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        age_group_id: formData.age_group_id,
        lesson_id: formData.lesson_id || null,
        location: formData.location,
        notes: formData.notes || null,
        status: formData.status,
      };

      if (sessionId) {
        await updateSession(sessionId, sessionData);
        toast({
          title: 'Éxito',
          description: 'Clase actualizada correctamente',
        });
      } else {
        await createSession(sessionData);
        toast({
          title: 'Éxito',
          description: 'Clase creada correctamente',
        });
      }

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast({
        title: 'Error',
        description: `Error al guardar: ${error instanceof Error ? error.message : 'desconocido'}`,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{sessionId ? 'Editar Clase' : 'Nueva Clase'}</DialogTitle>
          <DialogDescription>
            {sessionId
              ? 'Actualiza los detalles de la clase'
              : 'Crea una nueva clase programada'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Fecha *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="age_group">Grupo de Edad *</Label>
                <Select value={formData.age_group_id} onValueChange={(value) =>
                  setFormData({ ...formData, age_group_id: value })
                }>
                  <SelectTrigger id="age_group">
                    <SelectValue placeholder="Seleccionar grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    {ageGroups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_time">Hora Inicio</Label>
                <Input
                  id="start_time"
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_time">Hora Fin</Label>
                <Input
                  id="end_time"
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lesson">Lección (Opcional)</Label>
              <Select value={formData.lesson_id} onValueChange={(value) =>
                setFormData({ ...formData, lesson_id: value })
              }>
                <SelectTrigger id="lesson">
                  <SelectValue placeholder="Seleccionar lección" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin lección</SelectItem>
                  {lessons.map((lesson) => (
                    <SelectItem key={lesson.id} value={lesson.id}>
                      {lesson.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Ubicación</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Sala Infantil"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notas adicionales sobre la clase"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Estado</Label>
              <Select value={formData.status} onValueChange={(value) =>
                setFormData({ ...formData, status: value as SessionStatus })
              }>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Programada</SelectItem>
                  <SelectItem value="completed">Completada</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {sessionId ? 'Actualizar' : 'Crear'} Clase
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SessionEditDialog;
