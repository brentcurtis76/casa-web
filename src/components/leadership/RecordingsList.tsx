/**
 * RecordingsList — List recordings for a meeting with playback and transcription
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, Mic, Loader2, Trash2, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getRecordings, deleteRecording, getRecordingUrl } from '@/lib/leadership/recordingService';
import { triggerTranscription } from '@/lib/leadership/transcriptionService';
import { listSegments, listSessions } from '@/lib/leadership/recorderSession';
import { listServerOrphans, recoverAndFinalize } from '@/lib/leadership/recorderUploader';
import { useAuth } from '@/components/auth/AuthContext';
import AudioRecorder from './AudioRecorder';
import TranscriptionViewer from './TranscriptionViewer';
import type { RecordingRow } from '@/types/leadershipModule';

interface OrphanMeta {
  sessionId: string;
  segmentCount: number;
  approxDurationSeconds: number;
}

interface RecordingsListProps {
  meetingId: string;
  canWrite: boolean;
  onUpdated: () => void;
}

const TRANSCRIPTION_STATUS_LABELS: Record<string, string> = {
  none: 'Sin transcribir',
  pending: 'Pendiente',
  processing: 'Procesando...',
  completed: 'Completada',
  failed: 'Error',
};

const TRANSCRIPTION_STATUS_VARIANTS: Record<string, string> = {
  none: 'outline',
  pending: 'secondary',
  processing: 'default',
  completed: 'secondary',
  failed: 'destructive',
};

const RecordingsList = ({ meetingId, canWrite, onUpdated }: RecordingsListProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [recordings, setRecordings] = useState<RecordingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRecording, setExpandedRecording] = useState<string | null>(null);
  const [transcribingId, setTranscribingId] = useState<string | null>(null);
  const [recordingUrls, setRecordingUrls] = useState<Record<string, string>>({});
  const [orphanSessions, setOrphanSessions] = useState<OrphanMeta[]>([]);
  const [isRecovering, setIsRecovering] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RecordingRow | null>(null);

  const loadOrphans = useCallback(async () => {
    try {
      const [localSessions, serverOrphans] = await Promise.all([
        listSessions(meetingId),
        userId ? listServerOrphans(userId, meetingId) : Promise.resolve([]),
      ]);
      const byId = new Map<string, OrphanMeta>();
      for (const orphan of serverOrphans) {
        byId.set(orphan.sessionId, {
          sessionId: orphan.sessionId,
          segmentCount: orphan.segmentCount,
          approxDurationSeconds: orphan.approxDurationSeconds,
        });
      }
      const localOnly = localSessions.filter((id) => !byId.has(id));
      const localMetas = await Promise.all(
        localOnly.map(async (sessionId) => {
          try {
            const segments = await listSegments(sessionId);
            const approxDurationSeconds = segments.reduce(
              (sum, seg) => sum + (seg.meta.durationMs ?? 0) / 1000,
              0,
            );
            return {
              sessionId,
              segmentCount: segments.length,
              approxDurationSeconds,
            } satisfies OrphanMeta;
          } catch (_e) {
            return {
              sessionId,
              segmentCount: 0,
              approxDurationSeconds: 0,
            } satisfies OrphanMeta;
          }
        }),
      );
      for (const meta of localMetas) byId.set(meta.sessionId, meta);
      setOrphanSessions(Array.from(byId.values()));
    } catch (_e) {
      setOrphanSessions([]);
    }
  }, [meetingId, userId]);

  const loadRecordings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getRecordings(meetingId);
      setRecordings(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las grabaciones',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [meetingId, toast]);

  useEffect(() => {
    loadRecordings();
    void loadOrphans();
  }, [loadRecordings, loadOrphans]);

  const handleRecoverOrphans = async () => {
    setIsRecovering(true);
    try {
      const summary = await recoverAndFinalize(meetingId);
      if (summary.recovered > 0) {
        toast({
          title: 'Grabación recuperada',
          description:
            summary.recovered === 1
              ? 'Se recuperó 1 grabación pendiente.'
              : `Se recuperaron ${summary.recovered} grabaciones pendientes.`,
        });
      }
      if (summary.failed.length > 0) {
        toast({
          title: 'No se pudo recuperar todo',
          description: `Errores: ${summary.failed.length}. Intenta de nuevo más tarde.`,
          variant: 'destructive',
        });
      }
      if (summary.recovered === 0 && summary.failed.length === 0) {
        toast({
          title: 'Sin cambios',
          description: 'No había grabaciones pendientes de recuperar.',
        });
      }
      await loadRecordings();
      await loadOrphans();
      onUpdated();
    } catch (error) {
      toast({
        title: 'Error',
        description: `No se pudo recuperar la grabación: ${error instanceof Error ? error.message : 'desconocido'}`,
        variant: 'destructive',
      });
    } finally {
      setIsRecovering(false);
    }
  };

  const handleGetUrl = async (recording: RecordingRow) => {
    if (recordingUrls[recording.id]) return;
    try {
      const url = await getRecordingUrl(recording.storage_path);
      setRecordingUrls((prev) => ({ ...prev, [recording.id]: url }));
    } catch (_e) {
      // URL fetch failed — audio won't play
    }
  };

  const confirmDeleteRecording = async () => {
    const recording = deleteTarget;
    if (!recording) return;
    setDeleteTarget(null);
    try {
      await deleteRecording(recording.id, recording.storage_path);
      await loadRecordings();
      toast({ title: 'Éxito', description: 'Grabación eliminada' });
      onUpdated();
    } catch (error) {
      toast({
        title: 'Error',
        description: `Error al eliminar: ${error instanceof Error ? error.message : 'desconocido'}`,
        variant: 'destructive',
      });
    }
  };

  const handleTranscribe = async (recordingId: string) => {
    setTranscribingId(recordingId);
    try {
      await triggerTranscription(recordingId);
      toast({ title: 'Éxito', description: 'Transcripción iniciada' });
      await loadRecordings();
      onUpdated();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo iniciar la transcripción',
        variant: 'destructive',
      });
    } finally {
      setTranscribingId(null);
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

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4 p-4">
      {canWrite && (
        <AudioRecorder
          meetingId={meetingId}
          onRecordingSaved={() => {
            loadRecordings();
            void loadOrphans();
            onUpdated();
          }}
        />
      )}

      {canWrite && orphanSessions.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader className="pb-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-700 mt-0.5" aria-hidden />
              <div className="flex-1">
                <div className="text-sm font-semibold text-amber-900">
                  Grabación sin guardar detectada
                </div>
                <p className="text-xs text-amber-800 mt-1">
                  {(() => {
                    const totalMinutes = Math.max(
                      1,
                      Math.round(
                        orphanSessions.reduce(
                          (sum, o) => sum + o.approxDurationSeconds,
                          0,
                        ) / 60,
                      ),
                    );
                    const totalSegments = orphanSessions.reduce(
                      (sum, o) => sum + o.segmentCount,
                      0,
                    );
                    if (orphanSessions.length === 1) {
                      return `Se encontró 1 grabación sin guardar de ~${totalMinutes} min (${totalSegments} segmento${
                        totalSegments === 1 ? '' : 's'
                      } listos).`;
                    }
                    return `Se encontraron ${orphanSessions.length} grabaciones sin guardar de ~${totalMinutes} min en total (${totalSegments} segmento${
                      totalSegments === 1 ? '' : 's'
                    } listos).`;
                  })()}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleRecoverOrphans}
              disabled={isRecovering}
              className="gap-2 bg-amber-600 hover:bg-amber-700 text-stone-900"
            >
              {isRecovering && <Loader2 className="h-4 w-4 animate-spin" />}
              Recuperar grabación sin guardar
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        </div>
      ) : recordings.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Mic className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Sin grabaciones aún</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recordings.map((recording) => (
            <div key={recording.id}>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-sm font-medium">{recording.filename}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(recording.created_at)} •{' '}
                        {formatDuration(recording.duration_seconds)}
                      </div>
                    </div>
                    <Badge
                      variant={
                        (TRANSCRIPTION_STATUS_VARIANTS[recording.transcription_status] ??
                          'outline') as 'outline' | 'default' | 'secondary' | 'destructive'
                      }
                    >
                      {TRANSCRIPTION_STATUS_LABELS[recording.transcription_status] ??
                        recording.transcription_status}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Lazy-load audio on expand */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => handleGetUrl(recording)}
                  >
                    <Mic className="h-4 w-4" />
                    Cargar audio
                  </Button>
                  {recordingUrls[recording.id] && (
                    <audio controls className="w-full">
                      <source
                        src={recordingUrls[recording.id]}
                        type={recording.mime_type ?? 'audio/webm'}
                      />
                      Tu navegador no soporta el elemento de audio.
                    </audio>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {recording.transcription_status === 'none' && canWrite && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTranscribe(recording.id)}
                        disabled={transcribingId === recording.id}
                        className="gap-2"
                      >
                        {transcribingId === recording.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Zap className="h-4 w-4" />
                        )}
                        Transcribir con IA
                      </Button>
                    )}

                    {recording.transcription_status === 'completed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setExpandedRecording(
                            expandedRecording === recording.id ? null : recording.id,
                          )
                        }
                      >
                        {expandedRecording === recording.id
                          ? 'Ocultar transcripción'
                          : 'Ver transcripción'}
                      </Button>
                    )}

                    {canWrite && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteTarget(recording)}
                        aria-label={`Eliminar grabación ${recording.filename}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    )}
                  </div>

                  {expandedRecording === recording.id &&
                    recording.transcription_status === 'completed' && (
                      <TranscriptionViewer
                        recording={recording}
                        onCreateCommitment={onUpdated}
                      />
                    )}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta grabación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará el archivo de audio
              y cualquier transcripción asociada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmDeleteRecording()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RecordingsList;
