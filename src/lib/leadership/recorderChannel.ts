/**
 * Canal tipado de BroadcastChannel para el grabador de reuniones.
 *
 * Comunica la ventana principal de la app con la ventana popup del grabador
 * durante sesiones largas de grabación. Sigue el mismo patrón que
 * `src/lib/presentation/syncChannel.ts` (Presenter <-> Output).
 *
 * La ventana popup persiste segmentos a IndexedDB y reporta progreso a la
 * app principal vía este canal; la app principal puede solicitar control
 * (pausar/detener) en la dirección inversa.
 */

export const RECORDER_CHANNEL_NAME = 'casa-leadership-recorder';

export type RecorderSegmentStatus = 'pending' | 'uploading' | 'uploaded' | 'failed';

export interface RecorderSessionInfo {
  sessionId: string;
  meetingId: string;
  startedAt: number;
}

export interface RecorderSegmentInfo {
  sessionId: string;
  segmentIndex: number;
  sizeBytes: number;
  durationMs: number;
  mimeType: string;
  status: RecorderSegmentStatus;
}

export type RecorderChannelMessage =
  | { type: 'SESSION_START'; session: RecorderSessionInfo }
  | { type: 'SESSION_STOP'; sessionId: string; reason?: string }
  | { type: 'SESSION_PAUSE'; sessionId: string }
  | { type: 'SESSION_RESUME'; sessionId: string }
  | { type: 'SEGMENT_SAVED'; segment: RecorderSegmentInfo }
  | { type: 'SEGMENT_UPLOAD_START'; sessionId: string; segmentIndex: number }
  | { type: 'SEGMENT_UPLOADED'; sessionId: string; segmentIndex: number; storagePath: string }
  | { type: 'SEGMENT_UPLOAD_FAILED'; sessionId: string; segmentIndex: number; error: string }
  | { type: 'HEARTBEAT'; sessionId: string; at: number; elapsedMs: number }
  | { type: 'RECORDER_READY'; sessionId: string }
  | { type: 'RECORDER_ERROR'; sessionId: string; error: string }
  | { type: 'REQUEST_STATE' }
  | {
      type: 'STATE_SYNC';
      session: RecorderSessionInfo | null;
      segments: RecorderSegmentInfo[];
      isRecording: boolean;
      isPaused: boolean;
    };

export type RecorderChannelHandler = (msg: RecorderChannelMessage) => void;

export interface RecorderChannel {
  send: (msg: RecorderChannelMessage) => void;
  subscribe: (handler: RecorderChannelHandler) => () => void;
  close: () => void;
}

/**
 * Crea un canal de sincronización para el grabador.
 * Cada llamada crea un `BroadcastChannel` nuevo; usa `getRecorderChannel()`
 * si necesitas un singleton por ventana.
 */
export function createRecorderChannel(): RecorderChannel {
  const channel = new BroadcastChannel(RECORDER_CHANNEL_NAME);
  const handlers = new Set<RecorderChannelHandler>();

  channel.onmessage = (event: MessageEvent<RecorderChannelMessage>) => {
    handlers.forEach((handler) => handler(event.data));
  };

  return {
    send: (msg: RecorderChannelMessage) => {
      channel.postMessage(msg);
    },
    subscribe: (handler: RecorderChannelHandler) => {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
    close: () => {
      handlers.clear();
      channel.close();
    },
  };
}

let globalChannel: RecorderChannel | null = null;

/**
 * Singleton del canal por ventana.
 */
export function getRecorderChannel(): RecorderChannel {
  if (!globalChannel) {
    globalChannel = createRecorderChannel();
  }
  return globalChannel;
}

export function closeRecorderChannel(): void {
  if (globalChannel) {
    globalChannel.close();
    globalChannel = null;
  }
}

export function postRecorderMessage(msg: RecorderChannelMessage): void {
  getRecorderChannel().send(msg);
}

export function subscribeRecorderMessages(handler: RecorderChannelHandler): () => void {
  return getRecorderChannel().subscribe(handler);
}
