/**
 * ParticipantManager — Manage meeting participants and attendance
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  getParticipants,
  addParticipant,
  removeParticipant,
  markAttendance,
} from '@/lib/leadership/participantService';
import ParticipantPicker from './ParticipantPicker';
import type { MeetingParticipantRow } from '@/types/leadershipModule';
import { supabase } from '@/integrations/supabase/client';

interface ParticipantManagerProps {
  meetingId: string;
  canWrite: boolean;
  onUpdated: () => void;
}

const ParticipantManager = ({ meetingId, canWrite, onUpdated }: ParticipantManagerProps) => {
  const { toast } = useToast();
  const [participants, setParticipants] = useState<MeetingParticipantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadParticipants = async () => {
      setLoading(true);
      try {
        const data = await getParticipants(meetingId);
        setParticipants(data);

        const userIds = data.map((p) => p.user_id);
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('church_profiles')
            .select('id, full_name')
            .in('id', userIds);

          if (profiles) {
            const nameMap: Record<string, string> = {};
            (profiles as { id: string; full_name: string | null }[]).forEach((p) => {
              nameMap[p.id] = p.full_name ?? 'Sin Nombre';
            });
            setUserNames(nameMap);
          }
        }
      } catch (error) {
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los participantes',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadParticipants();
  }, [meetingId, toast]);

  const handleAddParticipants = async (userIds: string[]) => {
    try {
      for (const userId of userIds) {
        await addParticipant({ meeting_id: meetingId, user_id: userId });
      }

      const updated = await getParticipants(meetingId);
      setParticipants(updated);
      setShowPicker(false);
      toast({ title: 'Éxito', description: 'Participantes agregados' });
      onUpdated();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron agregar los participantes',
        variant: 'destructive',
      });
    }
  };

  const handleToggleAttendance = async (participantId: string, attended: boolean) => {
    try {
      await markAttendance(participantId, attended);
      setParticipants(
        participants.map((p) => (p.id === participantId ? { ...p, attended } : p)),
      );
      onUpdated();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la asistencia',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveParticipant = async (participantId: string) => {
    try {
      await removeParticipant(participantId);
      setParticipants(participants.filter((p) => p.id !== participantId));
      toast({ title: 'Éxito', description: 'Participante removido' });
      onUpdated();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo remover el participante',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4 p-4">
      {canWrite && (
        <Button
          onClick={() => setShowPicker(!showPicker)}
          className="gap-2 bg-amber-600 hover:bg-amber-700 text-stone-900 w-full"
        >
          <Plus className="h-4 w-4" />
          {showPicker ? 'Cancelar' : 'Agregar Participantes'}
        </Button>
      )}

      {showPicker && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Seleccionar Participantes</CardTitle>
          </CardHeader>
          <CardContent>
            <ParticipantPicker
              meetingId={meetingId}
              selected={participants.map((p) => p.user_id)}
              onChange={handleAddParticipants}
            />
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
        </div>
      ) : participants.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">Sin participantes</div>
      ) : (
        <div className="space-y-2">
          {participants.map((participant) => (
            <div
              key={participant.id}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div className="flex-1">
                <div className="font-medium text-sm">
                  {userNames[participant.user_id] ?? 'Participante'}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {canWrite && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={participant.attended}
                      onCheckedChange={(checked) =>
                        handleToggleAttendance(participant.id, checked as boolean)
                      }
                      id={`attend-${participant.id}`}
                    />
                    <label
                      htmlFor={`attend-${participant.id}`}
                      className="text-sm cursor-pointer"
                    >
                      Presente
                    </label>
                  </div>
                )}

                {canWrite && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveParticipant(participant.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ParticipantManager;
