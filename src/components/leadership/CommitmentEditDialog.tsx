/**
 * CommitmentEditDialog — Create or edit a commitment
 * NOTE: Uses `assignee_id` field (not `assigned_to`)
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
import { useAuth } from '@/components/auth/AuthContext';
import { Loader2 } from 'lucide-react';
import { createCommitment, updateCommitment } from '@/lib/leadership/commitmentService';
import { supabase } from '@/integrations/supabase/client';
import type {
  CommitmentRow,
  CommitmentPriority,
  CommitmentStatus,
} from '@/types/leadershipModule';

interface CommitmentEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commitment?: CommitmentRow;
  meetingId?: string;
  onSaved: () => void;
}

interface FormData {
  title: string;
  description: string;
  assignee_id: string;
  due_date: string;
  priority: CommitmentPriority;
  status: CommitmentStatus;
}

const CommitmentEditDialog = ({
  open,
  onOpenChange,
  commitment,
  meetingId,
  onSaved,
}: CommitmentEditDialogProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [assignedUsers, setAssignedUsers] = useState<{ id: string; full_name: string | null }[]>([]);

  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    assignee_id: '',
    due_date: '',
    priority: 'medium',
    status: 'pending',
  });

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name')
          .order('full_name', { ascending: true });

        if (data) setAssignedUsers(data as { id: string; full_name: string | null }[]);
      } catch (_e) {
        // Silently fail
      }
    };

    if (open) loadUsers();
  }, [open]);

  useEffect(() => {
    if (commitment && open) {
      setFormData({
        title: commitment.title,
        description: commitment.description ?? '',
        assignee_id: commitment.assignee_id ?? '',
        due_date: commitment.due_date ?? '',
        priority: commitment.priority,
        status: commitment.status,
      });
    } else if (!commitment && open) {
      setFormData({
        title: '',
        description: '',
        assignee_id: '',
        due_date: '',
        priority: 'medium',
        status: 'pending',
      });
    }
  }, [commitment, open]);

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

    if (!formData.title) {
      toast({
        title: 'Error',
        description: 'El título es requerido',
        variant: 'destructive',
      });
      return;
    }

    const targetMeetingId = commitment?.meeting_id ?? meetingId;
    if (!targetMeetingId) {
      toast({
        title: 'Error',
        description: 'No se encontró la reunión asociada',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        meeting_id: targetMeetingId,
        title: formData.title,
        description: formData.description || null,
        assignee_id: formData.assignee_id || null,
        assigned_by: commitment ? commitment.assigned_by : (user?.id ?? null),
        due_date: formData.due_date || null,
        priority: formData.priority,
        status: formData.status,
        source_recording_id: null,
        follow_up_meeting_id: null,
        completed_at: null,
      };

      if (commitment) {
        await updateCommitment(commitment.id, payload);
        toast({ title: 'Éxito', description: 'Compromiso actualizado correctamente' });
      } else {
        await createCommitment(payload);
        toast({ title: 'Éxito', description: 'Compromiso creado correctamente' });
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
          <DialogTitle>
            {commitment ? 'Editar Compromiso' : 'Nuevo Compromiso'}
          </DialogTitle>
          <DialogDescription>
            {commitment ? 'Modifica los detalles del compromiso' : 'Crea un nuevo compromiso'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Ej: Preparar presentación"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Detalles adicionales"
              rows={3}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="assignee_id">Asignado a</Label>
            <Select
              value={formData.assignee_id}
              onValueChange={(value) => handleSelectChange('assignee_id', value)}
            >
              <SelectTrigger id="assignee_id">
                <SelectValue placeholder="Selecciona una persona" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Sin asignar</SelectItem>
                {assignedUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name ?? 'Sin nombre'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="due_date">Fecha Vencimiento</Label>
            <Input
              id="due_date"
              name="due_date"
              type="date"
              value={formData.due_date}
              onChange={handleInputChange}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="priority">Prioridad</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => handleSelectChange('priority', value)}
              >
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baja</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
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
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="in_progress">En Progreso</SelectItem>
                  <SelectItem value="completed">Completado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
              {commitment ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CommitmentEditDialog;
