/**
 * VolunteerEditDialog — Form for creating/editing volunteers
 * Handles 5 form fields: name, email, phone, notes, active status
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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { createVolunteer, updateVolunteer, getVolunteer } from '@/lib/children-ministry/volunteerService';

interface VolunteerEditDialogProps {
  volunteerId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const VolunteerEditDialog = ({
  volunteerId,
  open,
  onOpenChange,
  onSuccess,
}: VolunteerEditDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    display_name: '',
    email: '',
    phone: '',
    notes: '',
    is_active: true,
  });

  // Load volunteer data if editing
  useEffect(() => {
    if (volunteerId && open) {
      const loadVolunteer = async () => {
        setLoading(true);
        try {
          const volunteer = await getVolunteer(volunteerId);
          setFormData({
            display_name: volunteer.display_name,
            email: volunteer.email || '',
            phone: volunteer.phone || '',
            notes: volunteer.notes || '',
            is_active: volunteer.is_active,
          });
        } catch (error) {
          toast({
            title: 'Error',
            description: 'No se pudo cargar el voluntario',
            variant: 'destructive',
          });
        } finally {
          setLoading(false);
        }
      };

      loadVolunteer();
    } else if (open && !volunteerId) {
      setFormData({
        display_name: '',
        email: '',
        phone: '',
        notes: '',
        is_active: true,
      });
    }
  }, [volunteerId, open, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.display_name.trim()) {
      toast({
        title: 'Error',
        description: 'El nombre es requerido',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const volunteerData = {
        display_name: formData.display_name.trim(),
        email: formData.email || null,
        phone: formData.phone || null,
        notes: formData.notes || null,
        is_active: formData.is_active,
      };

      if (volunteerId) {
        await updateVolunteer(volunteerId, volunteerData);
        toast({
          title: 'Éxito',
          description: 'Voluntario actualizado correctamente',
        });
      } else {
        await createVolunteer(volunteerData);
        toast({
          title: 'Éxito',
          description: 'Voluntario creado correctamente',
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{volunteerId ? 'Editar Voluntario' : 'Nuevo Voluntario'}</DialogTitle>
          <DialogDescription>
            {volunteerId
              ? 'Actualiza los detalles del voluntario'
              : 'Crea un nuevo voluntario'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                placeholder="Nombre completo"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="correo@ejemplo.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+56 9 1234 5678"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notas adicionales sobre el voluntario"
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: !!checked })
                }
              />
              <Label htmlFor="active" className="cursor-pointer">
                Activo
              </Label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {volunteerId ? 'Actualizar' : 'Crear'} Voluntario
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default VolunteerEditDialog;
