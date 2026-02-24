/**
 * MeetingDetailSheet — Full meeting details in slide-out sheet with tabs
 * NOTE: Uses `meeting_date` field (not `date`)
 */

import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Edit2, Play, CheckCircle2, Users, Mic, FileText, Bookmark, File } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getMeeting, getMeetingTypes, updateMeetingStatus } from '@/lib/leadership/meetingService';
import MeetingEditDialog from './MeetingEditDialog';
import MeetingStatusBadge from './MeetingStatusBadge';
import ParticipantManager from './ParticipantManager';
import RecordingsList from './RecordingsList';
import MeetingNotes from './MeetingNotes';
import CommitmentManager from './CommitmentManager';
import DocumentsList from './DocumentsList';
import type { MeetingWithType, MeetingTypeRow } from '@/types/leadershipModule';

interface MeetingDetailSheetProps {
  meetingId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canWrite: boolean;
  onUpdated: () => void;
}

const MeetingDetailSheet = ({
  meetingId,
  open,
  onOpenChange,
  canWrite,
  onUpdated,
}: MeetingDetailSheetProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [meeting, setMeeting] = useState<MeetingWithType | null>(null);
  const [meetingTypes, setMeetingTypes] = useState<MeetingTypeRow[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  useEffect(() => {
    if (meetingId && open) {
      const loadData = async () => {
        setLoading(true);
        try {
          const [meetingData, types] = await Promise.all([
            getMeeting(meetingId),
            getMeetingTypes(),
          ]);
          setMeeting(meetingData);
          setMeetingTypes(types);
        } catch (error) {
          toast({
            title: 'Error',
            description: 'No se pudo cargar la reunión',
            variant: 'destructive',
          });
        } finally {
          setLoading(false);
        }
      };

      loadData();
    }
  }, [meetingId, open, toast]);

  const handleStatusChange = async (newStatus: MeetingWithType['status']) => {
    if (!meeting) return;

    setStatusUpdating(true);
    try {
      await updateMeetingStatus(meeting.id, newStatus);
      setMeeting({ ...meeting, status: newStatus });
      toast({ title: 'Éxito', description: 'Estado actualizado' });
      onUpdated();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el estado',
        variant: 'destructive',
      });
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleMeetingSaved = async () => {
    if (!meetingId) return;
    try {
      const updated = await getMeeting(meetingId);
      setMeeting(updated);
      setEditDialogOpen(false);
      onUpdated();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo recargar la reunión',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('es-CL', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

  if (!open) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-3xl flex flex-col max-h-screen">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
            </div>
          ) : meeting ? (
            <>
              <SheetHeader className="flex-shrink-0">
                <div className="space-y-2">
                  <SheetTitle className="text-2xl">{meeting.title}</SheetTitle>
                  <SheetDescription>
                    {formatDate(meeting.meeting_date)}
                    {meeting.start_time && ` • ${meeting.start_time}`}
                  </SheetDescription>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <MeetingStatusBadge status={meeting.status} />
                  {meeting.meeting_type && (
                    <Badge variant="outline">{meeting.meeting_type.display_name}</Badge>
                  )}
                  {meeting.location && (
                    <Badge variant="outline">{meeting.location}</Badge>
                  )}
                </div>
              </SheetHeader>

              {canWrite && (
                <div className="flex flex-wrap gap-2 py-4 border-b flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditDialogOpen(true)}
                    className="gap-2"
                  >
                    <Edit2 className="h-4 w-4" />
                    Editar
                  </Button>

                  {meeting.status === 'scheduled' && (
                    <Button
                      size="sm"
                      className="gap-2 bg-amber-600 hover:bg-amber-700 text-stone-900"
                      onClick={() => handleStatusChange('in_progress')}
                      disabled={statusUpdating}
                    >
                      <Play className="h-4 w-4" />
                      Iniciar Reunión
                    </Button>
                  )}

                  {meeting.status === 'in_progress' && (
                    <Button
                      size="sm"
                      className="gap-2 bg-green-700 hover:bg-green-800"
                      onClick={() => handleStatusChange('completed')}
                      disabled={statusUpdating}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Completar
                    </Button>
                  )}
                </div>
              )}

              <div className="flex-1 overflow-hidden min-h-0">
                <Tabs defaultValue="participants" className="h-full flex flex-col">
                  <TabsList className="grid w-full grid-cols-5 flex-shrink-0">
                    <TabsTrigger value="participants" className="gap-1">
                      <Users className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline text-xs">Participantes</span>
                    </TabsTrigger>
                    <TabsTrigger value="recordings" className="gap-1">
                      <Mic className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline text-xs">Grabaciones</span>
                    </TabsTrigger>
                    <TabsTrigger value="notes" className="gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline text-xs">Notas</span>
                    </TabsTrigger>
                    <TabsTrigger value="commitments" className="gap-1">
                      <Bookmark className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline text-xs">Compromisos</span>
                    </TabsTrigger>
                    <TabsTrigger value="documents" className="gap-1">
                      <File className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline text-xs">Documentos</span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="participants" className="flex-1 overflow-hidden mt-0">
                    <ScrollArea className="h-full">
                      <ParticipantManager
                        meetingId={meeting.id}
                        canWrite={canWrite}
                        onUpdated={onUpdated}
                      />
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="recordings" className="flex-1 overflow-hidden mt-0">
                    <ScrollArea className="h-full">
                      <RecordingsList
                        meetingId={meeting.id}
                        canWrite={canWrite}
                        onUpdated={onUpdated}
                      />
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="notes" className="flex-1 overflow-hidden mt-0">
                    <ScrollArea className="h-full">
                      <MeetingNotes
                        meetingId={meeting.id}
                        canWrite={canWrite}
                        onUpdated={onUpdated}
                      />
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="commitments" className="flex-1 overflow-hidden mt-0">
                    <ScrollArea className="h-full">
                      <CommitmentManager
                        meetingId={meeting.id}
                        canWrite={canWrite}
                        onUpdated={onUpdated}
                      />
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="documents" className="flex-1 overflow-hidden mt-0">
                    <ScrollArea className="h-full">
                      <DocumentsList
                        meetingId={meeting.id}
                        canWrite={canWrite}
                        onUpdated={onUpdated}
                      />
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </div>

              {meeting.description && (
                <Card className="mt-4 flex-shrink-0">
                  <CardHeader>
                    <CardTitle className="text-sm">Descripción / Agenda</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{meeting.description}</p>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No se pudo cargar la reunión
            </div>
          )}
        </SheetContent>
      </Sheet>

      {meeting && (
        <MeetingEditDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          meeting={meeting}
          meetingTypes={meetingTypes}
          onSaved={handleMeetingSaved}
        />
      )}
    </>
  );
};

export default MeetingDetailSheet;
