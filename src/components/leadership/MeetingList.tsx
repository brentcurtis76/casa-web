/**
 * MeetingList — Filterable list of meetings with create/edit options
 * NOTE: Uses `meeting_date` field (not `date`)
 */

import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getMeetings, deleteMeeting, getMeetingTypes } from '@/lib/leadership/meetingService';
import MeetingEditDialog from './MeetingEditDialog';
import MeetingDetailSheet from './MeetingDetailSheet';
import MeetingStatusBadge from './MeetingStatusBadge';
import type { MeetingRow, MeetingTypeRow } from '@/types/leadershipModule';

interface MeetingListProps {
  canWrite: boolean;
  meetingTypeId?: string;
}

const MeetingList = ({ canWrite, meetingTypeId }: MeetingListProps) => {
  const { toast } = useToast();
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [meetingTypes, setMeetingTypes] = useState<MeetingTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [editMeetingData, setEditMeetingData] = useState<MeetingRow | undefined>();

  const [filterType, setFilterType] = useState<string>(meetingTypeId ?? 'all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [types, allMeetings] = await Promise.all([
          getMeetingTypes(),
          getMeetings(),
        ]);

        setMeetingTypes(types);
        setMeetings(allMeetings);
      } catch (error) {
        toast({
          title: 'Error',
          description: 'No se pudieron cargar las reuniones',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [toast]);

  const filteredMeetings = meetings.filter((meeting) => {
    if (filterType !== 'all' && meeting.meeting_type_id !== filterType) return false;
    if (filterStatus !== 'all' && meeting.status !== filterStatus) return false;
    return true;
  });

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta reunión?')) return;

    try {
      await deleteMeeting(id);
      setMeetings(meetings.filter((m) => m.id !== id));
      toast({ title: 'Éxito', description: 'Reunión eliminada correctamente' });
    } catch (error) {
      toast({
        title: 'Error',
        description: `Error al eliminar: ${error instanceof Error ? error.message : 'desconocido'}`,
        variant: 'destructive',
      });
    }
  };

  const handleSaved = async () => {
    try {
      const allMeetings = await getMeetings();
      setMeetings(allMeetings);
      setCreateDialogOpen(false);
      setEditMeetingData(undefined);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron recargar las reuniones',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-CL', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getTypeDisplayName = (typeId: string) =>
    meetingTypes.find((t) => t.id === typeId)?.display_name ?? typeId;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Reuniones</CardTitle>
          <CardDescription>Gestiona todas las reuniones de liderazgo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="text-sm font-medium">Tipo de Reunión</label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {meetingTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <label className="text-sm font-medium">Estado</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="scheduled">Programada</SelectItem>
                  <SelectItem value="in_progress">En Curso</SelectItem>
                  <SelectItem value="completed">Completada</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {canWrite && (
              <Button
                onClick={() => {
                  setEditMeetingData(undefined);
                  setCreateDialogOpen(true);
                }}
                className="gap-2 bg-amber-600 hover:bg-amber-700 text-stone-900"
              >
                <Plus className="h-4 w-4" />
                Nueva Reunión
              </Button>
            )}
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : filteredMeetings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No hay reuniones</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    {canWrite && <TableHead className="text-right">Acciones</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMeetings.map((meeting) => (
                    <TableRow
                      key={meeting.id}
                      onClick={() => {
                        setSelectedMeetingId(meeting.id);
                        setDetailSheetOpen(true);
                      }}
                      className="cursor-pointer hover:bg-muted/50"
                    >
                      <TableCell className="text-sm">
                        {formatDate(meeting.meeting_date)}
                      </TableCell>
                      <TableCell className="font-medium">{meeting.title}</TableCell>
                      <TableCell className="text-sm">
                        {getTypeDisplayName(meeting.meeting_type_id)}
                      </TableCell>
                      <TableCell>
                        <MeetingStatusBadge status={meeting.status} />
                      </TableCell>
                      {canWrite && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Editar reunión ${meeting.title}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditMeetingData(meeting);
                                setCreateDialogOpen(true);
                              }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Eliminar reunión ${meeting.title}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(meeting.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <MeetingEditDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        meeting={editMeetingData}
        meetingTypes={meetingTypes}
        onSaved={handleSaved}
      />

      <MeetingDetailSheet
        meetingId={selectedMeetingId}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        canWrite={canWrite}
        onUpdated={handleSaved}
      />
    </div>
  );
};

export default MeetingList;
