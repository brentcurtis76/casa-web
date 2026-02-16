/**
 * SessionDetailSheet — Side sheet showing full session details
 * Shows session info, lesson, volunteers, attendance with action buttons
 */

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, Edit2, UserPlus, CheckSquare2 } from 'lucide-react';
import { getSession, deleteSession } from '@/lib/children-ministry/calendarService';
import { getAttendance } from '@/lib/children-ministry/attendanceService';
import AgeGroupBadge from './AgeGroupBadge';
import SessionStatusBadge from './SessionStatusBadge';
import SessionEditDialog from './SessionEditDialog';
import AttendanceDialog from './AttendanceDialog';
import AssignVolunteerDialog from './AssignVolunteerDialog';
import type { ChildrenCalendarFull, ChildrenAttendanceRow, ChildrenAgeGroupRow } from '@/types/childrenMinistry';

interface SessionDetailSheetProps {
  sessionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canWrite: boolean;
  onUpdated?: () => void;
  ageGroups?: ChildrenAgeGroupRow[];
}

const SessionDetailSheet = ({
  sessionId,
  open,
  onOpenChange,
  canWrite,
  onUpdated,
  ageGroups = [],
}: SessionDetailSheetProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<ChildrenCalendarFull | null>(null);
  const [attendance, setAttendance] = useState<ChildrenAttendanceRow[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  // Load session and attendance when sheet opens
  useEffect(() => {
    if (sessionId && open) {
      const loadData = async () => {
        setLoading(true);
        try {
          const sessionData = await getSession(sessionId);
          setSession(sessionData);

          const attendanceData = await getAttendance(sessionId);
          setAttendance(attendanceData);
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

      loadData();
    }
  }, [sessionId, open, toast]);

  const handleDelete = async () => {
    if (!sessionId) return;

    setDeleting(true);
    try {
      await deleteSession(sessionId);
      toast({
        title: 'Éxito',
        description: 'Clase eliminada correctamente',
      });
      setShowDeleteDialog(false);
      onOpenChange(false);
      onUpdated?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: `Error al eliminar: ${error instanceof Error ? error.message : 'desconocido'}`,
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleEditSuccess = () => {
    setEditDialogOpen(false);
    if (sessionId) {
      const loadSession = async () => {
        try {
          const sessionData = await getSession(sessionId);
          setSession(sessionData);
        } catch {
          // Silently fail on reload
        }
      };
      loadSession();
    }
    onUpdated?.();
  };

  const handleAttendanceSuccess = () => {
    setAttendanceDialogOpen(false);
    if (sessionId) {
      const loadAttendance = async () => {
        try {
          const attendanceData = await getAttendance(sessionId);
          setAttendance(attendanceData);
        } catch {
          // Silently fail on reload
        }
      };
      loadAttendance();
    }
  };

  const handleAssignSuccess = () => {
    setAssignDialogOpen(false);
    if (sessionId) {
      const loadSession = async () => {
        try {
          const sessionData = await getSession(sessionId);
          setSession(sessionData);
        } catch {
          // Silently fail on reload
        }
      };
      loadSession();
    }
  };

  // Helpers
  const getDayOfWeek = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.getDay();
  };

  const presentCount = attendance.filter((a) => a.is_present).length;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalles de Clase</SheetTitle>
            <SheetDescription>
              {loading ? 'Cargando...' : session ? format(new Date(session.date), 'EEEE, d MMMM yyyy', { locale: es }) : ''}
            </SheetDescription>
          </SheetHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : session ? (
            <div className="space-y-6 pt-6">
              {/* Date, time, location */}
              <div className="space-y-2">
                <div className="flex gap-2 flex-wrap">
                  <AgeGroupBadge ageGroup={session.age_group} />
                  <SessionStatusBadge status={session.status} />
                </div>

                <div className="text-sm">
                  <p className="text-gray-600">
                    <span className="font-semibold">Hora:</span> {session.start_time.substring(0, 5)} - {session.end_time.substring(0, 5)}
                  </p>
                  {session.location && (
                    <p className="text-gray-600">
                      <span className="font-semibold">Ubicación:</span> {session.location}
                    </p>
                  )}
                  {session.notes && (
                    <p className="text-gray-600">
                      <span className="font-semibold">Notas:</span> {session.notes}
                    </p>
                  )}
                </div>
              </div>

              {/* Lesson */}
              {session.lesson ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{session.lesson.title}</CardTitle>
                    {session.lesson.bible_reference && (
                      <CardDescription>{session.lesson.bible_reference}</CardDescription>
                    )}
                  </CardHeader>
                  {session.lesson.description && (
                    <CardContent className="text-sm text-gray-600">
                      {session.lesson.description}
                    </CardContent>
                  )}
                </Card>
              ) : (
                <Card className="bg-gray-50">
                  <CardContent className="pt-6">
                    <p className="text-sm text-gray-500">Sin lección asignada</p>
                  </CardContent>
                </Card>
              )}

              {/* Volunteers */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Voluntarios Asignados</h3>
                {session.assignments.length === 0 ? (
                  <p className="text-sm text-gray-500">Sin voluntarios asignados</p>
                ) : (
                  <div className="space-y-2">
                    {session.assignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                      >
                        <div>
                          <p className="font-medium">{assignment.volunteer.display_name}</p>
                          <p className="text-xs text-gray-500">
                            {assignment.role === 'lead' && 'Líder'}
                            {assignment.role === 'assistant' && 'Asistente'}
                            {assignment.role === 'support' && 'Apoyo'}
                          </p>
                        </div>
                        <span className="text-xs px-2 py-1 bg-white rounded border">
                          {assignment.status === 'confirmed' && 'Confirmado'}
                          {assignment.status === 'assigned' && 'Asignado'}
                          {assignment.status === 'declined' && 'Rechazado'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Attendance */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Asistencia</h3>
                {attendance.length === 0 ? (
                  <p className="text-sm text-gray-500">Sin asistencia registrada</p>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm text-gray-600 mb-2">
                      <span className="font-semibold">{presentCount}</span> de{' '}
                      <span className="font-semibold">{attendance.length}</span> presentes
                    </p>
                    <div className="space-y-1">
                      {attendance.map((record) => (
                        <div key={record.id} className="flex items-center text-sm p-1">
                          <span
                            className={`w-2 h-2 rounded-full mr-2 ${
                              record.is_present ? 'bg-green-500' : 'bg-gray-300'
                            }`}
                          ></span>
                          <span>{record.child_name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              {canWrite && (
                <div className="space-y-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setEditDialogOpen(true)}
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Editar Clase
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setAssignDialogOpen(true)}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Asignar Voluntario
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setAttendanceDialogOpen(true)}
                  >
                    <CheckSquare2 className="h-4 w-4 mr-2" />
                    Registrar Asistencia
                  </Button>
                  <Button
                    variant="destructive"
                    className="w-full justify-start"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar Clase
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Clase</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de que desea eliminar esta clase? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit dialog */}
      {session && (
        <SessionEditDialog
          sessionId={sessionId}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSuccess={handleEditSuccess}
          ageGroups={ageGroups}
        />
      )}

      {/* Attendance dialog */}
      {sessionId && session && (
        <AttendanceDialog
          calendarId={sessionId}
          ageGroupId={session.age_group_id}
          open={attendanceDialogOpen}
          onOpenChange={setAttendanceDialogOpen}
          onSuccess={handleAttendanceSuccess}
        />
      )}

      {/* Assign volunteer dialog */}
      {sessionId && session && (
        <AssignVolunteerDialog
          calendarId={sessionId}
          sessionDate={session.date}
          dayOfWeek={getDayOfWeek(session.date)}
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
          onSuccess={handleAssignSuccess}
        />
      )}
    </>
  );
};

export default SessionDetailSheet;
