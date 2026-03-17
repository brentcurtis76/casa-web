/**
 * AssignVolunteerDialog — Dialog for assigning volunteers to a session
 * Shows available volunteers prominently, unavailable volunteers greyed out,
 * and detects double-booking conflicts with override confirmation.
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { Loader2, AlertTriangle } from 'lucide-react';
import {
  getVolunteers,
  getAvailableVolunteers,
  getVolunteerAssignmentsByDate,
  assignVolunteer,
} from '@/lib/children-ministry/volunteerService';
import type { ChildrenVolunteerRow, AssignmentRole } from '@/types/childrenMinistry';

interface VolunteerAssignment {
  volunteerId: string;
  selected: boolean;
  role: AssignmentRole;
}

interface ConflictInfo {
  calendar_id: string;
  session_start_time: string;
  session_end_time: string;
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
  const [availableVolunteers, setAvailableVolunteers] = useState<ChildrenVolunteerRow[]>([]);
  const [unavailableVolunteers, setUnavailableVolunteers] = useState<ChildrenVolunteerRow[]>([]);
  const [assignments, setAssignments] = useState<VolunteerAssignment[]>([]);
  const [conflicts, setConflicts] = useState<Map<string, ConflictInfo[]>>(new Map());
  const [showConflictDialog, setShowConflictDialog] = useState(false);

  // Load available + all active volunteers and batch-load conflicts
  useEffect(() => {
    if (open) {
      const loadData = async () => {
        setLoading(true);
        try {
          const [available, allActive] = await Promise.all([
            getAvailableVolunteers(sessionDate, dayOfWeek),
            getVolunteers({ is_active: true }),
          ]);

          const availableIds = new Set(available.map((v) => v.id));
          const unavailable = allActive.filter((v) => !availableIds.has(v.id));

          setAvailableVolunteers(available);
          setUnavailableVolunteers(unavailable);

          const allVolunteers = [...available, ...unavailable];
          setAssignments(
            allVolunteers.map((v) => ({
              volunteerId: v.id,
              selected: false,
              role: 'assistant' as AssignmentRole,
            }))
          );

          // Batch-load all existing assignments for this date
          const allIds = allVolunteers.map((v) => v.id);
          if (allIds.length > 0) {
            const existingAssignments = await getVolunteerAssignmentsByDate(allIds, sessionDate);
            const conflictMap = new Map<string, ConflictInfo[]>();
            for (const a of existingAssignments) {
              // Don't flag assignments to the current session as conflicts
              if (a.calendar_id === calendarId) continue;
              const existing = conflictMap.get(a.volunteer_id) ?? [];
              existing.push({
                calendar_id: a.calendar_id,
                session_start_time: a.session_start_time,
                session_end_time: a.session_end_time,
                role: a.role,
              });
              conflictMap.set(a.volunteer_id, existing);
            }
            setConflicts(conflictMap);
          }
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

      loadData();
    }
  }, [open, sessionDate, dayOfWeek, calendarId, toast]);

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

  const getSelectedWithConflicts = () => {
    return assignments.filter((a) => a.selected && conflicts.has(a.volunteerId));
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

    // Check if any selected volunteers have conflicts
    const withConflicts = getSelectedWithConflicts();
    if (withConflicts.length > 0) {
      setShowConflictDialog(true);
      return;
    }

    await doSubmit(selectedAssignments);
  };

  const doSubmit = async (selectedAssignments: VolunteerAssignment[]) => {
    setSubmitting(true);
    try {
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

  const handleConfirmConflicts = async () => {
    setShowConflictDialog(false);
    const selectedAssignments = assignments.filter((a) => a.selected);
    await doSubmit(selectedAssignments);
  };

  const allVolunteers = [...availableVolunteers, ...unavailableVolunteers];
  const unavailableIds = new Set(unavailableVolunteers.map((v) => v.id));

  const renderVolunteerRow = (volunteer: ChildrenVolunteerRow, isUnavailable: boolean) => {
    const assignment = assignments.find((a) => a.volunteerId === volunteer.id);
    if (!assignment) return null;

    const volunteerConflicts = conflicts.get(volunteer.id);

    return (
      <div key={volunteer.id}>
        <div
          className={`flex items-center gap-3 p-3 border rounded ${
            isUnavailable ? 'opacity-60 bg-gray-50' : ''
          }`}
        >
          <Checkbox
            id={`volunteer-${volunteer.id}`}
            checked={assignment.selected}
            onCheckedChange={(checked) =>
              handleUpdateAssignment(volunteer.id, 'selected', checked)
            }
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm">{volunteer.display_name}</p>
              {isUnavailable && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                  <AlertTriangle className="h-3 w-3" />
                  No disponible
                </span>
              )}
              {volunteerConflicts && (
                <span className="inline-flex items-center gap-1 text-xs text-red-600">
                  <AlertTriangle className="h-3 w-3" />
                  Conflicto
                </span>
              )}
            </div>
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
        {assignment.selected && volunteerConflicts && (
          <Alert variant="destructive" className="mt-1 py-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {volunteerConflicts.map((c, i) => (
                <span key={i} className="block text-xs">
                  Ya asignado/a a otra clase de {c.session_start_time} a {c.session_end_time}
                </span>
              ))}
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  };

  // Build the conflict summary for the confirmation dialog
  const conflictSummary = getSelectedWithConflicts().map((a) => {
    const volunteer = allVolunteers.find((v) => v.id === a.volunteerId);
    const vConflicts = conflicts.get(a.volunteerId) ?? [];
    return { displayName: volunteer?.display_name ?? 'Desconocido', conflicts: vConflicts };
  });

  return (
    <>
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
          ) : allVolunteers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No hay voluntarios activos disponibles</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Available volunteers */}
              {availableVolunteers.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700">Disponibles</h4>
                  {availableVolunteers.map((v) => renderVolunteerRow(v, false))}
                </div>
              )}

              {/* Unavailable volunteers */}
              {unavailableVolunteers.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-500 border-t pt-3">
                    No disponibles
                  </h4>
                  {unavailableVolunteers.map((v) => renderVolunteerRow(v, true))}
                </div>
              )}

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

      {/* Conflict confirmation dialog */}
      <AlertDialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conflictos de horario</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-2">
                  Los siguientes voluntarios ya tienen asignaciones en esta fecha:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {conflictSummary.map((item, idx) => (
                    <li key={idx}>
                      <span className="font-medium">{item.displayName}</span>
                      {item.conflicts.map((c, ci) => (
                        <span key={ci} className="block text-xs text-muted-foreground">
                          Clase de {c.session_start_time} a {c.session_end_time}
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
                <p className="mt-3">¿Deseas asignarlos de todas formas?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmConflicts} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Asignar de todas formas
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AssignVolunteerDialog;
