/**
 * RecorderPopupPage — ventana popup del grabador de reuniones de liderazgo.
 *
 * Ruta: /recorder?meetingId=<uuid>
 * Layout sin chrome (sin nav/header/breadcrumbs).
 *
 * Flujo:
 *  - Crea una fila en church_leadership_recording_sessions al abrir.
 *  - Captura audio con MediaRecorder y rota el segmento cada ~120s
 *    (stop+start, produce webm/opus independiente por segmento).
 *  - Sube snapshot en vivo cada 15s como respaldo.
 *  - Persiste cada segmento a IndexedDB antes de subir (recuperación ante
 *    caídas).
 *  - Pausa/reanudación con barra espaciadora.
 *  - Escalera de auto-parada: aviso a 1h55m, stop duro a 2h (si no se
 *    extiende), tope absoluto a 3h.
 *  - Todo mensaje al usuario en español.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Loader2,
  Mic,
  MicOff,
  Pause,
  Play,
  StopCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/components/auth/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import useWakeLock from '@/hooks/useWakeLock';
import {
  createRecorderChannel,
  type RecorderChannel,
} from '@/lib/leadership/recorderChannel';
import { saveSegment } from '@/lib/leadership/recorderSession';
import {
  uploadLiveSnapshot,
  uploadSegment,
  finalize,
} from '@/lib/leadership/recorderUploader';

// =====================================================
// Constantes de tiempos
// =====================================================

const SEGMENT_ROTATE_MS = 120_000; // 2 min
const LIVE_SNAPSHOT_MS = 15_000; // 15 s
const INITIAL_CEILING_MS = 7_200_000; // 2h — tope inicial (extensible)
const CEILING_STEP_MS = 1_800_000; // 30 min — paso de extensión
const ABSOLUTE_CAP_MS = 10_800_000; // 3h — tope absoluto
const WARN_LEAD_MS = 300_000; // 5 min — aviso antes del tope actual

const PREFERRED_MIME = 'audio/webm;codecs=opus';
const FALLBACK_MIME = 'audio/webm';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RecorderStatus =
  | 'idle'
  | 'requesting'
  | 'recording'
  | 'paused'
  | 'stopping'
  | 'stopped'
  | 'error';

interface RecordingSessionInsertRow {
  id: string;
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return FALLBACK_MIME;
  if (MediaRecorder.isTypeSupported(PREFERRED_MIME)) return PREFERRED_MIME;
  if (MediaRecorder.isTypeSupported(FALLBACK_MIME)) return FALLBACK_MIME;
  return FALLBACK_MIME;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

const RecorderPopupPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const meetingId = searchParams.get('meetingId');
  const sessionIdParam = searchParams.get('sessionId');
  const { user, loading: authLoading } = useAuth();
  const wakeLock = useWakeLock();
  const { toast } = useToast();

  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeMs, setActiveMs] = useState(0);
  const [segmentsUploaded, setSegmentsUploaded] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [ceilingMs, setCeilingMs] = useState<number>(INITIAL_CEILING_MS);

  // Refs — estado imperativo que no debe re-renderizar.
  const sessionIdRef = useRef<string | null>(null);
  const mimeTypeRef = useRef<string>(FALLBACK_MIME);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const currentChunksRef = useRef<Blob[]>([]);
  const currentSegmentStartRef = useRef<number>(0);
  const segmentIndexRef = useRef<number>(0);
  const segmentActiveMsRef = useRef<number>(0);
  const rotatingRef = useRef(false);
  const stoppingRef = useRef(false);
  const activeMsRef = useRef(0);
  const ceilingMsRef = useRef<number>(INITIAL_CEILING_MS);
  const channelRef = useRef<RecorderChannel | null>(null);

  // Mantener ref en sincronía con estado para usos sincrónicos.
  useEffect(() => {
    ceilingMsRef.current = ceilingMs;
  }, [ceilingMs]);

  // -----------------------------------------------------
  // Limpieza: stop + liberar stream + cerrar canal + wake lock
  // -----------------------------------------------------
  const teardown = useCallback(() => {
    try {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        stoppingRef.current = true;
        recorder.stop();
      }
    } catch {
      /* ignore */
    }
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    streamRef.current = null;
    recorderRef.current = null;
    void wakeLock.release();
    if (channelRef.current) {
      channelRef.current.close();
      channelRef.current = null;
    }
  }, [wakeLock]);

  // -----------------------------------------------------
  // Subir el segmento actual a Storage + IndexedDB
  // -----------------------------------------------------
  const flushSegment = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    const chunks = currentChunksRef.current;
    if (chunks.length === 0) return;

    const index = segmentIndexRef.current;
    const segmentBlob = new Blob(chunks, { type: mimeTypeRef.current });
    const startedAt = new Date(currentSegmentStartRef.current);
    const endedAt = new Date();
    const durationMs = segmentActiveMsRef.current;

    // Reset locales antes de I/O para que una nueva grabación no pise buffers.
    currentChunksRef.current = [];
    segmentIndexRef.current = index + 1;
    currentSegmentStartRef.current = endedAt.getTime();
    segmentActiveMsRef.current = 0;

    // IndexedDB primero (respaldo local); errores aquí no bloquean subida.
    try {
      await saveSegment(sessionId, index, segmentBlob, {
        mimeType: mimeTypeRef.current,
        durationMs,
        createdAt: endedAt.getTime(),
      });
    } catch (err) {
      console.error('No se pudo guardar segmento en IndexedDB', err);
    }

    try {
      channelRef.current?.send({
        type: 'SEGMENT_UPLOAD_START',
        sessionId,
        segmentIndex: index,
      });
      const row = await uploadSegment(sessionId, index, segmentBlob, {
        startedAt,
        endedAt,
        durationSeconds: durationMs / 1000,
        mimeType: mimeTypeRef.current,
      });
      setSegmentsUploaded((n) => n + 1);
      channelRef.current?.send({
        type: 'SEGMENT_UPLOADED',
        sessionId,
        segmentIndex: index,
        storagePath: row.storage_path,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Error al subir segmento', err);
      channelRef.current?.send({
        type: 'SEGMENT_UPLOAD_FAILED',
        sessionId,
        segmentIndex: index,
        error: message,
      });
    }
  }, []);

  // -----------------------------------------------------
  // Snapshot en vivo (15s)
  // -----------------------------------------------------
  const pushLiveSnapshot = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    const chunks = currentChunksRef.current;
    if (chunks.length === 0) return;
    try {
      const snap = new Blob(chunks, { type: mimeTypeRef.current });
      await uploadLiveSnapshot(sessionId, snap, mimeTypeRef.current);
      channelRef.current?.send({
        type: 'HEARTBEAT',
        sessionId,
        at: Date.now(),
        elapsedMs: activeMsRef.current,
      });
    } catch (err) {
      console.error('Error en snapshot en vivo', err);
    }
  }, []);

  // -----------------------------------------------------
  // Crear y arrancar un MediaRecorder nuevo (segmento siguiente)
  // -----------------------------------------------------
  const startRecorder = useCallback((stream: MediaStream) => {
    const mime = pickMimeType();
    mimeTypeRef.current = mime;

    const recorder = new MediaRecorder(stream, { mimeType: mime });
    recorder.ondataavailable = (evt: BlobEvent) => {
      if (evt.data && evt.data.size > 0) {
        currentChunksRef.current.push(evt.data);
      }
    };
    recorder.onstop = () => {
      // Si estamos rotando o deteniendo, flushSegment sube el segmento.
      // El rearranque lo maneja el caller (rotate/stop).
      void flushSegment().then(() => {
        if (rotatingRef.current) {
          rotatingRef.current = false;
          const s = streamRef.current;
          if (s && !stoppingRef.current) {
            try {
              startRecorder(s);
            } catch (restartErr) {
              console.error('No se pudo reiniciar el grabador', restartErr);
              const message =
                restartErr instanceof Error
                  ? restartErr.message
                  : String(restartErr);
              setErrorMessage(message);
              setStatus('error');
            }
          }
        }
      });
    };
    recorder.onerror = (evt: Event) => {
      const sessionId = sessionIdRef.current;
      const err = (evt as unknown as { error?: { message?: string } }).error;
      const message = err?.message ?? 'Error desconocido del grabador';
      if (sessionId) {
        channelRef.current?.send({
          type: 'RECORDER_ERROR',
          sessionId,
          error: message,
        });
      }
      // Intenta recuperar: rota el segmento actual (flush lo sube) y arranca
      // un MediaRecorder nuevo sobre el mismo stream.
      const stream = streamRef.current;
      if (!stream || stoppingRef.current) {
        setErrorMessage(message);
        setStatus('error');
        return;
      }
      try {
        rotatingRef.current = true;
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
        toast({
          title: 'Reiniciando grabación',
          description:
            'Tuvimos un problema con el grabador. Continuamos en un segmento nuevo.',
        });
      } catch (recoverErr) {
        console.error('No se pudo recuperar del error del grabador', recoverErr);
        setErrorMessage(message);
        setStatus('error');
      }
    };

    currentSegmentStartRef.current = Date.now();
    segmentActiveMsRef.current = 0;
    // Timeslice 1s para que los ticks dataavailable lleguen rápido.
    recorder.start(1000);
    recorderRef.current = recorder;
  }, [flushSegment, toast]);

  // -----------------------------------------------------
  // Rotación (stop actual → onstop dispara flush + start siguiente)
  // -----------------------------------------------------
  const rotateSegment = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    rotatingRef.current = true;
    try {
      recorder.stop();
    } catch (err) {
      console.error('Error al rotar segmento', err);
      rotatingRef.current = false;
    }
  }, []);

  // -----------------------------------------------------
  // Detener definitivamente + finalizar
  // -----------------------------------------------------
  const stopSession = useCallback(
    async (reason: 'user' | 'hard_2h' | 'cap_3h' = 'user') => {
      const sessionId = sessionIdRef.current;
      if (!sessionId || stoppingRef.current) return;
      stoppingRef.current = true;
      setStatus('stopping');
      setShowWarning(false);

      try {
        const recorder = recorderRef.current;
        if (recorder && recorder.state !== 'inactive') {
          recorder.stop();
        }
      } catch {
        /* ignore */
      }

      // Espera a que el último onstop corra y suba el segmento final.
      await new Promise((r) => setTimeout(r, 500));
      await flushSegment();

      try {
        await finalize(sessionId);
      } catch (err) {
        console.error('Error al finalizar sesión', err);
      }

      channelRef.current?.send({
        type: 'SESSION_STOP',
        sessionId,
        reason,
      });

      const stream = streamRef.current;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      recorderRef.current = null;
      void wakeLock.release();
      setStatus('stopped');
    },
    [flushSegment, wakeLock],
  );

  // -----------------------------------------------------
  // Inicio de sesión: pedir mic, insertar fila, arrancar grabación
  // -----------------------------------------------------
  const startSession = useCallback(async () => {
    if (!meetingId) {
      setErrorMessage('Falta el parámetro meetingId en la URL.');
      setStatus('error');
      return;
    }
    if (!UUID_RE.test(meetingId)) {
      setErrorMessage('Identificador de reunión inválido.');
      setStatus('error');
      return;
    }
    if (sessionIdParam && !UUID_RE.test(sessionIdParam)) {
      setErrorMessage('Identificador de sesión inválido.');
      setStatus('error');
      return;
    }
    if (!user) {
      setErrorMessage('Usuario no autenticado.');
      setStatus('error');
      return;
    }
    setStatus('requesting');
    setErrorMessage(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(`No se pudo acceder al micrófono: ${message}`);
      setStatus('error');
      return;
    }
    streamRef.current = stream;

    // Si el track del mic se cae (dispositivo desconectado, permiso revocado,
    // otra app lo toma), detén la sesión guardando lo grabado.
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.addEventListener('ended', () => {
        if (stoppingRef.current) return;
        toast({
          title: 'Micrófono desconectado',
          description:
            'Se perdió acceso al micrófono. Guardando lo grabado hasta ahora…',
          variant: 'destructive',
        });
        void stopSession('user');
      });
    }

    const mime = pickMimeType();
    mimeTypeRef.current = mime;

    let sessionId: string;
    try {
      const { data, error } = await supabase
        .from('church_leadership_recording_sessions' as const)
        .insert({
          meeting_id: meetingId,
          user_id: user.id,
          status: 'active',
          mime_type: mime,
        })
        .select('id')
        .single();
      if (error) throw error;
      sessionId = (data as RecordingSessionInsertRow).id;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(`No se pudo crear la sesión: ${message}`);
      setStatus('error');
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      return;
    }
    sessionIdRef.current = sessionId;

    // Canal broadcast + aviso a la app principal.
    const channel = createRecorderChannel();
    channelRef.current = channel;
    channel.send({
      type: 'SESSION_START',
      session: {
        sessionId,
        meetingId,
        startedAt: Date.now(),
      },
    });

    void wakeLock.request();
    startRecorder(stream);
    setStatus('recording');
    channel.send({ type: 'RECORDER_READY', sessionId });
  }, [meetingId, sessionIdParam, user, startRecorder, wakeLock, stopSession, toast]);

  // -----------------------------------------------------
  // Pausar / Reanudar
  // -----------------------------------------------------
  const togglePause = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    const sessionId = sessionIdRef.current;
    if (recorder.state === 'recording') {
      try {
        recorder.pause();
        setStatus('paused');
        if (sessionId) {
          channelRef.current?.send({ type: 'SESSION_PAUSE', sessionId });
        }
      } catch (err) {
        console.error('Error al pausar', err);
      }
    } else if (recorder.state === 'paused') {
      try {
        recorder.resume();
        setStatus('recording');
        if (sessionId) {
          channelRef.current?.send({ type: 'SESSION_RESUME', sessionId });
        }
      } catch (err) {
        console.error('Error al reanudar', err);
      }
    }
  }, []);

  const extendRecording = useCallback(() => {
    setCeilingMs((prev) => Math.min(prev + CEILING_STEP_MS, ABSOLUTE_CAP_MS));
    setShowWarning(false);
  }, []);

  // -----------------------------------------------------
  // Ticks: 1s — acumular tiempo activo, rotación, snapshot, escalera
  // -----------------------------------------------------
  useEffect(() => {
    if (status !== 'recording' && status !== 'paused') return;
    const interval = window.setInterval(() => {
      // Snapshot en vivo (cada LIVE_SNAPSHOT_MS) — también cuando está en pausa.
      if (activeMsRef.current > 0 && activeMsRef.current % LIVE_SNAPSHOT_MS < 1000) {
        void pushLiveSnapshot();
      }

      if (status !== 'recording') return;

      activeMsRef.current += 1000;
      segmentActiveMsRef.current += 1000;
      setActiveMs(activeMsRef.current);

      // Escalera de auto-parada — siempre respeta el tope absoluto.
      if (activeMsRef.current >= ABSOLUTE_CAP_MS) {
        void stopSession('cap_3h');
        return;
      }
      const currentCeiling = ceilingMsRef.current;
      if (activeMsRef.current >= currentCeiling) {
        void stopSession(
          currentCeiling >= ABSOLUTE_CAP_MS ? 'cap_3h' : 'hard_2h',
        );
        return;
      }
      if (
        activeMsRef.current >= currentCeiling - WARN_LEAD_MS &&
        currentCeiling < ABSOLUTE_CAP_MS &&
        !showWarning
      ) {
        setShowWarning(true);
      }

      // Rotación de segmento.
      if (segmentActiveMsRef.current >= SEGMENT_ROTATE_MS) {
        rotateSegment();
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [status, rotateSegment, pushLiveSnapshot, showWarning, stopSession]);

  // -----------------------------------------------------
  // Spacebar = pausa/reanuda
  // -----------------------------------------------------
  useEffect(() => {
    const onKeyDown = (evt: KeyboardEvent) => {
      if (evt.code !== 'Space') return;
      if (isEditableTarget(evt.target)) return;
      if (status !== 'recording' && status !== 'paused') return;
      evt.preventDefault();
      togglePause();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [status, togglePause]);

  // -----------------------------------------------------
  // beforeunload / pagehide + unmount — tear down stream + wake lock + canal
  // -----------------------------------------------------
  useEffect(() => {
    const onBeforeUnload = () => {
      teardown();
    };
    // pagehide también cubre bfcache/mobile/safari y es el evento recomendado
    // para persistir estado al cierre. Capturamos sincrónicamente el buffer
    // actual a IndexedDB para que recoverAndFinalize pueda recuperar lo
    // grabado aunque el popup se cierre de golpe.
    const onPageHide = () => {
      try {
        const sessionId = sessionIdRef.current;
        const chunks = currentChunksRef.current;
        if (sessionId && chunks.length > 0) {
          const blob = new Blob(chunks, { type: mimeTypeRef.current });
          const index = segmentIndexRef.current;
          // Fire-and-forget: no se puede esperar a una promesa en pagehide,
          // pero la escritura a IDB se lanza antes de cortar el event loop.
          void saveSegment(sessionId, index, blob, {
            mimeType: mimeTypeRef.current,
            durationMs: segmentActiveMsRef.current,
            createdAt: Date.now(),
          });
        }
      } catch (err) {
        console.error('Error guardando segmento en pagehide', err);
      }
      try {
        const recorder = recorderRef.current;
        if (recorder && recorder.state !== 'inactive') {
          recorder.stop();
        }
      } catch {
        /* ignore */
      }
      teardown();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('pagehide', onPageHide);
      teardown();
    };
  }, [teardown]);

  // -----------------------------------------------------
  // Autoarranque cuando la autenticación está lista
  // -----------------------------------------------------
  useEffect(() => {
    if (authLoading) return;
    if (status !== 'idle') return;
    void startSession();
    // startSession capta su propia dependencia de user/meetingId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  // -----------------------------------------------------
  // Render
  // -----------------------------------------------------
  const statusLabel = useMemo(() => {
    switch (status) {
      case 'idle':
      case 'requesting':
        return 'Preparando…';
      case 'recording':
        return 'Grabando';
      case 'paused':
        return 'En pausa';
      case 'stopping':
        return 'Deteniendo…';
      case 'stopped':
        return 'Detenido';
      case 'error':
        return 'Error';
      default:
        return '';
    }
  }, [status]);

  const isRunning = status === 'recording' || status === 'paused';

  const minutesUntilCeiling = Math.max(
    1,
    Math.ceil((ceilingMs - activeMs) / 60_000),
  );
  const ceilingLabel = formatDuration(ceilingMs);
  const atAbsoluteCap = ceilingMs >= ABSOLUTE_CAP_MS;

  const showWakeLockWarning = !wakeLock.isSupported || wakeLock.error !== null;

  return (
    <div lang="es" className="min-h-screen bg-casa-900 text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-casa-800 border border-casa-700 rounded-xl shadow-xl p-6 space-y-6">
        {showWakeLockWarning && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
          >
            <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-400 mt-0.5" aria-hidden />
            <span>
              Bloqueo de pantalla no disponible — la grabación puede
              interrumpirse si la pantalla se apaga. Sigue siendo seguro cerrar
              esta ventana; se recuperará automáticamente.
            </span>
          </div>
        )}
        <header className="flex items-center gap-3">
          {status === 'recording' && (
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-500 animate-pulse" aria-hidden />
              <span className="sr-only">Grabando activamente</span>
              <Mic className="h-5 w-5 text-red-400" aria-hidden />
            </span>
          )}
          {status === 'paused' && <Pause className="h-5 w-5 text-amber-500" aria-hidden />}
          {(status === 'idle' || status === 'requesting') && (
            <Loader2 className="h-5 w-5 animate-spin text-casa-400" aria-hidden />
          )}
          {status === 'stopped' && <MicOff className="h-5 w-5 text-casa-400" aria-hidden />}
          {status === 'error' && <AlertTriangle className="h-5 w-5 text-red-500" aria-hidden />}
          <h1
            className="text-xl font-mont font-semibold"
            aria-live="polite"
            aria-atomic="true"
          >
            {statusLabel}
          </h1>
        </header>

        <div className="text-center">
          <div
            role="timer"
            aria-label="Tiempo grabado"
            aria-live="off"
            className="text-5xl font-mono tabular-nums tracking-tight"
          >
            {formatDuration(activeMs)}
          </div>
          <p
            className="mt-2 text-sm text-casa-400"
            aria-live="polite"
            aria-atomic="true"
          >
            {segmentsUploaded} segmento{segmentsUploaded === 1 ? '' : 's'} guardado
            {segmentsUploaded === 1 ? '' : 's'}
          </p>
          <p className="mt-1 text-xs text-casa-500" aria-live="polite">
            Límite actual: {ceilingLabel}
            {atAbsoluteCap ? ' (tope máximo)' : ''}
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="rounded-md border border-red-700 bg-red-950/60 px-3 py-2 text-sm text-red-200"
          >
            {errorMessage}
          </div>
        )}

        <div className="flex gap-3 justify-center">
          <Button
            type="button"
            variant="secondary"
            onClick={togglePause}
            disabled={!isRunning}
            aria-label={status === 'paused' ? 'Reanudar (barra espaciadora)' : 'Pausar (barra espaciadora)'}
          >
            {status === 'paused' ? (
              <>
                <Play className="h-4 w-4 mr-2" aria-hidden />
                Reanudar
              </>
            ) : (
              <>
                <Pause className="h-4 w-4 mr-2" aria-hidden />
                Pausar
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={() => void stopSession('user')}
            disabled={!isRunning && status !== 'stopping'}
            aria-label="Detener grabación y guardar"
          >
            <StopCircle className="h-4 w-4 mr-2" aria-hidden />
            Detener y guardar
          </Button>
        </div>

        <p className="text-xs text-center text-casa-500">
          Barra espaciadora para pausar o reanudar.
        </p>
      </div>

      <Dialog
        open={showWarning}
        onOpenChange={(open) => {
          if (!open) setShowWarning(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>La grabación se detendrá pronto</DialogTitle>
            <DialogDescription>
              La grabación se detendrá automáticamente en{' '}
              {minutesUntilCeiling} minuto
              {minutesUntilCeiling === 1 ? '' : 's'} al llegar al límite actual
              ({ceilingLabel}). Puedes extender 30 minutos más (hasta un tope
              de 3 horas) o detenerla y guardar ahora.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => void stopSession('user')}>
              Detener y guardar
            </Button>
            <Button
              onClick={extendRecording}
              disabled={atAbsoluteCap}
              aria-label={
                atAbsoluteCap
                  ? 'Ya alcanzaste el tope máximo de 3 horas'
                  : 'Extender 30 minutos'
              }
            >
              {atAbsoluteCap ? 'Tope máximo alcanzado' : 'Extender 30 min'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RecorderPopupPage;
