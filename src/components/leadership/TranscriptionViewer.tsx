/**
 * TranscriptionViewer — Display AI transcription, summary, and extracted action items
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, BookmarkPlus, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createCommitment } from '@/lib/leadership/commitmentService';
import type { RecordingRow, ActionItem } from '@/types/leadershipModule';

interface TranscriptionViewerProps {
  recording: RecordingRow;
  onCreateCommitment: () => void;
}

const TranscriptionViewer = ({ recording, onCreateCommitment }: TranscriptionViewerProps) => {
  const { toast } = useToast();
  const [creatingItems, setCreatingItems] = useState<Set<number>>(new Set());
  const [createdItems, setCreatedItems] = useState<Set<number>>(new Set());

  const actionItems = (recording.transcription_action_items ?? []) as ActionItem[];

  const handleCreateCommitment = async (item: ActionItem, index: number) => {
    setCreatingItems((prev) => new Set(prev).add(index));
    try {
      await createCommitment({
        meeting_id: recording.meeting_id,
        title: item.title,
        description: item.description ?? null,
        assignee_id: null,
        assigned_by: null,
        due_date: null,
        priority: item.priority ?? 'medium',
        status: 'pending',
        source_recording_id: recording.id,
        follow_up_meeting_id: null,
        completed_at: null,
      });

      setCreatedItems((prev) => new Set(prev).add(index));
      toast({ title: 'Éxito', description: 'Compromiso creado desde la transcripción' });
      onCreateCommitment();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo crear el compromiso',
        variant: 'destructive',
      });
    } finally {
      setCreatingItems((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  };

  return (
    <div className="space-y-4 border-t pt-4 mt-4">
      {recording.transcript_summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Resumen</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {recording.transcript_summary}
            </p>
          </CardContent>
        </Card>
      )}

      {actionItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              {actionItems.length}{' '}
              {actionItems.length === 1 ? 'Ítem de Acción' : 'Ítems de Acción'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {actionItems.map((item, idx) => (
              <div
                key={`${item.title}-${idx}`}
                className="flex items-start gap-3 p-2 border rounded-lg bg-muted/30"
              >
                <CheckCircle2 className="h-4 w-4 mt-1 flex-shrink-0 text-green-600" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm break-words font-medium">{item.title}</p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                  )}
                  {item.assignee_hint && (
                    <Badge variant="outline" className="mt-1 text-xs">
                      {item.assignee_hint}
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCreateCommitment(item, idx)}
                  disabled={creatingItems.has(idx) || createdItems.has(idx)}
                  className="gap-1 flex-shrink-0"
                >
                  {creatingItems.has(idx) ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : createdItems.has(idx) ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <BookmarkPlus className="h-4 w-4" />
                  )}
                  {createdItems.has(idx) ? 'Creado' : 'Crear'}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {recording.transcript_text && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Transcripción Completa</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-72 rounded border p-3">
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {recording.transcript_text}
              </p>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TranscriptionViewer;
