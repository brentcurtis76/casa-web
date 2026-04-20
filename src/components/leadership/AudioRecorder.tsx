/**
 * AudioRecorder — Launcher card that opens the /recorder popup window.
 *
 * If the browser blocks the popup, shows a Spanish warning toast and falls
 * back to the inline MediaRecorder flow (InlineAudioRecorder below).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ExternalLink, Loader2, Mic, Pause, Play, Save, Square } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthContext';
import { uploadRecording } from '@/lib/leadership/recordingService';
import { createRecorderChannel } from '@/lib/leadership/recorderChannel';

interface AudioRecorderProps {
  meetingId: string;
  onRecordingSaved: () => void;
}

const POPUP_FEATURES = 'popup=yes,width=480,height=720,resizable=yes,scrollbars=yes';

const AudioRecorder = ({ meetingId, onRecordingSaved }: AudioRecorderProps) => {
  const { toast } = useToast();
  const [fallbackInline, setFallbackInline] = useState(false);
  const [popupWindow, setPopupWindow] = useState<Window | null>(null);
  const popupWatchRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const savedFiredRef = useRef(false);

  const fireSavedOnce = useCallback(() => {
    if (savedFiredRef.current) return;
    savedFiredRef.current = true;
    onRecordingSaved();
  }, [onRecordingSaved]);

  useEffect(() => {
    const channel = createRecorderChannel();
    const unsubscribe = channel.subscribe((msg) => {
      if (msg.type === 'SESSION_STOP') {
        fireSavedOnce();
      }
    });
    return () => {
      unsubscribe();
      channel.close();
    };
  }, [fireSavedOnce]);

  useEffect(() => {
    return () => {
      if (popupWatchRef.current) clearInterval(popupWatchRef.current);
    };
  }, []);

  const launchPopup = useCallback(() => {
    const url = `/recorder?meetingId=${encodeURIComponent(meetingId)}`;
    const win = window.open(url, 'casa-recorder', POPUP_FEATURES);
    if (!win) {
      toast({
        title: 'Ventana emergente bloqueada',
        description:
          'Tu navegador bloqueó la ventana emergente. Usaremos grabación en línea.',
        variant: 'destructive',
      });
      setFallbackInline(true);
      return;
    }
    setPopupWindow(win);
    savedFiredRef.current = false;
    win.focus();

    if (popupWatchRef.current) clearInterval(popupWatchRef.current);
    popupWatchRef.current = setInterval(() => {
      if (win.closed) {
        if (popupWatchRef.current) clearInterval(popupWatchRef.current);
        popupWatchRef.current = null;
        setPopupWindow(null);
        fireSavedOnce();
      }
    }, 1000);
  }, [meetingId, toast, fireSavedOnce]);

  if (fallbackInline) {
    return <InlineAudioRecorder meetingId={meetingId} onRecordingSaved={onRecordingSaved} />;
  }

  const popupOpen = popupWindow !== null && !popupWindow.closed;

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <div>
          <div className="text-sm font-semibold">Grabadora de audio</div>
          <p className="text-xs text-muted-foreground mt-1">
            La grabación se abre en una ventana separada para que puedas seguir
            usando la app sin interrumpir la captura.
          </p>
        </div>
        <Button
          onClick={launchPopup}
          disabled={popupOpen}
          className="w-full gap-2 h-12 bg-red-600 hover:bg-red-700 text-white"
        >
          {popupOpen ? (
            <>
              <Mic className="h-5 w-5" />
              <span
                className="h-2 w-2 rounded-full bg-red-500 animate-pulse ml-2"
                aria-hidden="true"
              />
              <span className="sr-only">Grabación en curso</span>
              Grabación en curso…
            </>
          ) : (
            <>
              <ExternalLink className="h-5 w-5" />
              Abrir grabadora
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

// =====================================================
// Inline fallback (used when the popup is blocked)
// =====================================================

function getSupportedMimeType(): string {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

const InlineAudioRecorder = ({ meetingId, onRecordingSaved }: AudioRecorderProps) => {
  const { toast } = useToast();
  const { user } = useAuth();

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const levelAnimRef = useRef<number | null>(null);
  const mimeTypeRef = useRef<string>('audio/webm');

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (levelAnimRef.current) cancelAnimationFrame(levelAnimRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  useEffect(() => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [audioBlob]);

  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    setAudioLevel(Math.min(100, (avg / 128) * 100));
    levelAnimRef.current = requestAnimationFrame(updateAudioLevel);
  }, []);

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast({
        title: 'Error',
        description: window.isSecureContext
          ? 'Tu navegador no soporta grabación de audio.'
          : 'Se requiere HTTPS para grabar audio. Accede al sitio con https://.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      analyserRef.current = analyser;
      levelAnimRef.current = requestAnimationFrame(updateAudioLevel);

      const mimeType = getSupportedMimeType();
      mimeTypeRef.current = mimeType;

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        setAudioBlob(blob);
        setAudioLevel(0);
        if (levelAnimRef.current) cancelAnimationFrame(levelAnimRef.current);
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setIsPaused(false);
      setElapsedTime(0);

      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);

      toast({ title: 'Grabación iniciada', description: 'Haz clic en "Detener" cuando termines' });
    } catch (error) {
      let description = 'No se pudo acceder al micrófono';
      if (error instanceof DOMException) {
        switch (error.name) {
          case 'NotAllowedError':
            description = 'Permiso de micrófono denegado. Revisa los permisos del navegador para este sitio.';
            break;
          case 'NotFoundError':
            description = 'No se encontró ningún micrófono. Conecta un micrófono e intenta de nuevo.';
            break;
          case 'NotReadableError':
            description = 'El micrófono está en uso por otra aplicación. Ciérrala e intenta de nuevo.';
            break;
          case 'SecurityError':
            description = 'Se requiere HTTPS para acceder al micrófono.';
            break;
        }
      }
      console.error('Error al acceder al micrófono:', error);
      toast({
        title: 'Error',
        description,
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (audioContextRef.current) audioContextRef.current.close();
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }
  };

  const handleSaveRecording = async () => {
    if (!audioBlob || !user) return;

    setIsSaving(true);
    try {
      const ext = mimeTypeRef.current.includes('mp4') ? 'mp4' : 'webm';
      const filename = `grabacion-${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`;

      await uploadRecording(meetingId, audioBlob, filename, user.id);

      toast({ title: 'Éxito', description: 'Grabación guardada correctamente' });
      setAudioBlob(null);
      setElapsedTime(0);
      onRecordingSaved();
    } catch (error) {
      toast({
        title: 'Error',
        description: `Error al guardar: ${error instanceof Error ? error.message : 'desconocido'}`,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!isRecording && !audioBlob) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Button
            onClick={startRecording}
            className="w-full gap-2 h-12 bg-red-600 hover:bg-red-700 text-white"
          >
            <Mic className="h-5 w-5" />
            Grabar Reunión
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isRecording) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6 space-y-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-red-600 font-mono">
              {formatTime(elapsedTime)}
            </div>
            <div className="text-sm text-red-700 mt-1" aria-live="polite" aria-atomic="true">
              {isPaused ? 'Pausada' : 'Grabando'}
            </div>
          </div>

          <div className="w-full h-2 bg-red-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-600 transition-all duration-100"
              style={{ width: `${audioLevel}%` }}
            />
          </div>

          <div className="flex gap-2">
            {!isPaused ? (
              <Button onClick={pauseRecording} variant="outline" className="flex-1 gap-2">
                <Pause className="h-4 w-4" />
                Pausar
              </Button>
            ) : (
              <Button onClick={resumeRecording} variant="outline" className="flex-1 gap-2">
                <Play className="h-4 w-4" />
                Reanudar
              </Button>
            )}
            <Button
              onClick={stopRecording}
              className="flex-1 gap-2 bg-red-600 hover:bg-red-700"
            >
              <Square className="h-4 w-4" />
              Detener
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="space-y-2">
          <div className="text-sm font-medium">Grabación: {formatTime(elapsedTime)}</div>
          {previewUrl && (
            <audio controls className="w-full">
              <source src={previewUrl} type={mimeTypeRef.current} />
              Tu navegador no soporta el elemento de audio.
            </audio>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => {
              setAudioBlob(null);
              setElapsedTime(0);
            }}
            variant="outline"
            className="flex-1"
          >
            Descartar
          </Button>
          <Button
            onClick={handleSaveRecording}
            disabled={isSaving}
            className="flex-1 gap-2 bg-amber-600 hover:bg-amber-700 text-stone-900"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            <Save className="h-4 w-4" />
            Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AudioRecorder;
