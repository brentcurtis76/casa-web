/**
 * MeetingNotes — Meeting notes editor with auto-save and official minutes marking
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthContext';
import { getNotes, createNote, setOfficialMinutes } from '@/lib/leadership/noteService';
import { supabase } from '@/integrations/supabase/client';
import type { NoteRow } from '@/types/leadershipModule';

interface MeetingNotesProps {
  meetingId: string;
  canWrite: boolean;
  onUpdated: () => void;
}

const MeetingNotes = ({ meetingId, canWrite, onUpdated }: MeetingNotesProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [settingOfficial, setSettingOfficial] = useState<string | null>(null);
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  const loadNotes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotes(meetingId);
      setNotes(data);

      const authorIds = data.map((n) => n.author_id).filter(Boolean) as string[];
      if (authorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', authorIds);

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
        description: 'No se pudieron cargar las notas',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [meetingId, toast]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const handleSaveNote = async () => {
    if (!newNoteContent.trim()) return;

    setSaving(true);
    try {
      const newNote = await createNote({
        meeting_id: meetingId,
        content: newNoteContent,
        is_official: false,
        author_id: user?.id ?? null,
      });

      setNotes([newNote, ...notes]);
      setNewNoteContent('');
      onUpdated();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar la nota',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSetOfficial = async (noteId: string) => {
    setSettingOfficial(noteId);
    try {
      await setOfficialMinutes(noteId, meetingId);
      const updated = notes.map((n) => ({ ...n, is_official: n.id === noteId }));
      setNotes(updated);
      toast({ title: 'Éxito', description: 'Marcado como acta oficial' });
      onUpdated();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo marcar como oficial',
        variant: 'destructive',
      });
    } finally {
      setSettingOfficial(null);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('es-CL', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="space-y-4 p-4">
      {canWrite && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Nueva Nota</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              placeholder="Escribe las notas de la reunión aquí..."
              rows={4}
            />
            <Button
              onClick={handleSaveNote}
              disabled={saving || !newNoteContent.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-stone-900"
              size="sm"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar Nota
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {canWrite ? 'Aún no hay notas. Comienza a escribir.' : 'Sin notas'}
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <Card
              key={note.id}
              className={note.is_official ? 'border-amber-200 bg-amber-50' : ''}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">
                      {note.author_id ? (userNames[note.author_id] ?? 'Anónimo') : 'Anónimo'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(note.created_at)}
                    </div>
                  </div>
                  {note.is_official && (
                    <Badge className="gap-1 bg-amber-600">
                      <CheckCircle2 className="h-3 w-3" />
                      Acta Oficial
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{note.content}</p>

                {canWrite && !note.is_official && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSetOfficial(note.id)}
                    disabled={settingOfficial === note.id}
                    className="gap-2"
                  >
                    {settingOfficial === note.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Marcar como Acta Oficial
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MeetingNotes;
