/**
 * NoteHistory — Shows all notes for a meeting by different authors
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getNotes, deleteNote, setOfficialMinutes } from '@/lib/leadership/noteService';
import type { NoteRow } from '@/types/leadershipModule';

interface NoteHistoryProps {
  meetingId: string;
  canWrite: boolean;
  refreshKey?: number;
}

const NoteHistory = ({ meetingId, canWrite, refreshKey }: NoteHistoryProps) => {
  const { toast } = useToast();
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotes(meetingId);
      setNotes(data);
    } catch (_error) {
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
  }, [loadNotes, refreshKey]);

  const handleSetOfficial = async (noteId: string) => {
    try {
      await setOfficialMinutes(noteId, meetingId);
      await loadNotes();
      toast({ title: 'Éxito', description: 'Acta oficial actualizada' });
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el acta oficial',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (noteId: string) => {
    if (!window.confirm('¿Eliminar esta nota?')) return;
    try {
      await deleteNote(noteId);
      await loadNotes();
      toast({ title: 'Éxito', description: 'Nota eliminada' });
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la nota',
        variant: 'destructive',
      });
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

  if (loading) {
    return (
      <div className="text-center py-4">
        <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">Sin notas anteriores</p>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">Historial de Notas</h3>
      {notes.map((note) => (
        <Card key={note.id} className={note.is_official ? 'border-amber-300 bg-amber-50/30' : ''}>
          <CardHeader className="pb-2 pt-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {formatDate(note.created_at)}
              </CardTitle>
              <div className="flex items-center gap-2">
                {note.is_official && (
                  <Badge className="bg-amber-600 text-white text-xs">
                    <Star className="h-3 w-3 mr-1" />
                    Acta Oficial
                  </Badge>
                )}
                {canWrite && !note.is_official && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleSetOfficial(note.id)}
                    className="h-7 text-xs px-2"
                    aria-label="Marcar como acta oficial"
                  >
                    <Star className="h-3 w-3 mr-1" />
                    Marcar oficial
                  </Button>
                )}
                {canWrite && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(note.id)}
                    className="h-7 w-7 p-0"
                    aria-label="Eliminar nota"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-3">
            <p className="text-sm whitespace-pre-wrap">{note.content}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default NoteHistory;
