/**
 * AssignVolunteerDialog — Dialog for assigning volunteers to a session
 * Shows available volunteers with role selection
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { getVolunteers, assignVolunteer } from '@/lib/children-ministry/volunteerService';
import type { ChildrenVolunteerRow, AssignmentRole } from '@/types/childrenMinistry';

interface VolunteerAssignment {
  volunteerId: string;
  selected: boolean;
  role: AssignmentRole;
}

interface AssignVolunteerDialogProps {
  calendarId: string;
  sessionDate: string;
  dayOfWeek: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const AssignVolunteerDialog = ({
  calendarId,
  sessionDate,
  dayOfWeek,
  open,
  onOpenChange,
  onSuccess,
}: AssignVolunteerDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [volunteers, setVolunteers] = useState<ChildrenVolunteerRow[]>([]);
  const [assignments, setAssignments] = useState<VolunteerAssignment[]>([]);

  // Load active volunteers
  useEffect(() => {
    if (open) {
      const loadVolunteers = async () => {
        setLoading(true);
        try {
          const data = await getVolunteers({ is_active: true });
          setVolunteers(data);
          setAssignments(
            data.map((v) => ({
              volunteerId: v.id,
              selected: false,
              role: 'assistant' as AssignmentRole,
            }))
          );
        } catch (error) {
          toast({
            title: 'Error',
            description: 'No se pudieron cargar los voluntarios',
            variant: 'destructive',
          });
        } finally {
          setLoading(false);
        }
      };

      loadVolunteers();
    }
  }, [open, toast]);

  const handleUpdateAssignment = (
    volunteerId: string,
    field: keyof VolunteerAssignment,
    value: unknown
  ) => {
    setAssignments(
      assignments.map((a) =>
        a.volunteerId === volunteerId ? { ...a, [field]: value } : a
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const selectedAssignments = assignments.filter((a) => a.selected);
    if (selectedAssignments.length === 0) {
      toast({
        title: 'Error',
        description: 'Selecciona al menos un voluntario',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      // Get current user ID from auth (or use null if not available)
      // This is a simplified version - in production, get from auth context
      const assignedBy = null;

      for (const assignment of selectedAssignments) {
        await assignVolunteer({
          calendar_id: calendarId,
          volunteer_id: assignment.volunteerId,
          role: assignment.role,
          status: 'assigned',
          assigned_by: assignedBy,
        });
      }

      toast({
        title: 'Éxito',
        description: `${selectedAssignments.length} voluntario(s) asignado(s)`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast({
        title: 'Error',
        description: `Error al asignar: ${error instanceof Error ? error.message : 'desconocido'}`,
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
          <DialogTitle>Asignar Voluntario</DialogTitle>
          <DialogDescription>
            Selecciona voluntarios para esta clase y asigna sus roles
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : volunteers.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No hay voluntarios activos disponibles</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              {volunteers.map((volunteer) => {
                const assignment = assignments.find((a) => a.volunteerId === volunteer.id);
                if (!assignment) return null;

                return (
                  <div key={volunteer.id} className="flex items-center gap-3 p-3 border rounded">
                    <Checkbox
                      id={`volunteer-${volunteer.id}`}
                      checked={assignment.selected}
                      onCheckedChange={(checked) =>
                        handleUpdateAssignment(volunteer.id, 'selected', checked)
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{volunteer.display_name}</p>
                      {volunteer.email && (
                        <p className="text-xs text-gray-500 truncate">{volunteer.email}</p>
                      )}
                    </div>
                    {assignment.selected && (
                      <Select
                        value={assignment.role}
                        onValueChange={(value) =>
                          handleUpdateAssignment(volunteer.id, 'role', value as AssignmentRole)
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lead">Líder</SelectItem>
                          <SelectItem value="assistant">Asistente</SelectItem>
                          <SelectItem value="support">Apoyo</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Asignar
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AssignVolunteerDialog;
