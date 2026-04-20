/**
 * Recorder Uploader — capa de orquestación para subir segmentos del
 * grabador popup a Supabase Storage y crear filas finales en
 * church_leadership_recordings al terminar.
 *
 * - uploadLiveSnapshot: snapshot rodante (~15s) sobrescrito continuamente.
 * - uploadSegment: sube un chunk ~2min (webm/opus independientemente
 *   reproducible) y crea una fila en church_leadership_recording_segments.
 * - finalize: agrega duraciones/tamaños y crea la fila canónica en
 *   church_leadership_recordings usando insertRecordingRow.
 * - recoverAndFinalize: recupera sesiones huérfanas de IndexedDB tras un
 *   crash, sube segmentos faltantes, y finaliza.
 */

import { supabase } from '@/integrations/supabase/client';
import { insertRecordingRow } from '@/lib/leadership/recordingService';
import {
  listSegments,
  listSessions,
  deleteSession,
} from '@/lib/leadership/recorderSession';
import type { RecordingRow } from '@/types/leadershipModule';

// =====================================================
// Constantes
// =====================================================

const STORAGE_BUCKET = 'leadership-recordings';
const DEFAULT_MIME = 'audio/webm';

// =====================================================
// Tipos públicos
// =====================================================

export interface RecordingSessionRow {
  id: string;
  meeting_id: string;
  user_id: string | null;
  status: 'active' | 'completed' | 'abandoned';
  started_at: string;
  last_heartbeat_at: string;
  ended_at: string | null;
  last_live_path: string | null;
  mime_type: string;
}

export interface RecordingSegmentRow {
  id: string;
  session_id: string;
  segment_index: number;
  storage_path: string;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  size_bytes: number;
  mime_type: string;
  created_at: string;
}

export interface UploadSegmentMeta {
  startedAt: Date;
  endedAt: Date;
  durationSeconds: number;
  mimeType?: string;
}

export interface FinalizeOptions {
  meetingId?: string;
  userId?: string;
  filename?: string;
}

export interface RecoverySummary {
  recovered: number;
  failed: Array<{ sessionId: string; error: string }>;
}

// =====================================================
// Helpers de rutas
// =====================================================

function liveSnapshotPath(sessionId: string): string {
  return `sessions/${sessionId}/live.webm`;
}

function segmentPath(sessionId: string, segmentIndex: number): string {
  const padded = String(segmentIndex).padStart(5, '0');
  return `sessions/${sessionId}/segments/${padded}.webm`;
}

function manifestPath(sessionId: string): string {
  return `sessions/${sessionId}/manifest.json`;
}

// =====================================================
// Helpers DB
// =====================================================

async function getSessionRow(sessionId: string): Promise<RecordingSessionRow | null> {
  const { data, error } = await supabase
    .from('church_leadership_recording_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (error) throw new Error(`Error al leer sesión ${sessionId}: ${error.message}`);
  return (data as RecordingSessionRow | null) ?? null;
}

async function listSegmentRows(sessionId: string): Promise<RecordingSegmentRow[]> {
  const { data, error } = await supabase
    .from('church_leadership_recording_segments')
    .select('*')
    .eq('session_id', sessionId)
    .order('segment_index', { ascending: true });

  if (error) throw new Error(`Error al leer segmentos de ${sessionId}: ${error.message}`);
  return (data ?? []) as RecordingSegmentRow[];
}

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(`No se pudo obtener usuario: ${error.message}`);
  const userId = data.user?.id;
  if (!userId) throw new Error('Usuario no autenticado');
  return userId;
}

// =====================================================
// 1. uploadLiveSnapshot
// =====================================================

/**
 * Sube/sobrescribe el snapshot rodante (~15s) de la sesión activa.
 * Usa upsert para permitir reemplazo sin borrar primero.
 */
export async function uploadLiveSnapshot(
  sessionId: string,
  blob: Blob,
  mimeType: string = blob.type || DEFAULT_MIME,
): Promise<{ storagePath: string }> {
  const storagePath = liveSnapshotPath(sessionId);

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, blob, {
      upsert: true,
      contentType: mimeType,
      cacheControl: '0',
    });

  if (uploadError) {
    throw new Error(`Error al subir snapshot en vivo: ${uploadError.message}`);
  }

  const { error: updateError } = await supabase
    .from('church_leadership_recording_sessions')
    .update({
      last_live_path: storagePath,
      last_heartbeat_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (updateError) {
    throw new Error(`Error al actualizar heartbeat: ${updateError.message}`);
  }

  return { storagePath };
}

// =====================================================
// 2. uploadSegment
// =====================================================

/**
 * Sube un segmento ya ensamblado por el caller (MediaRecorder con timeslice
 * configurado para que cada Blob sea un webm/opus reproducible de forma
 * independiente) y crea la fila en church_leadership_recording_segments.
 */
export async function uploadSegment(
  sessionId: string,
  segmentIndex: number,
  blob: Blob,
  meta: UploadSegmentMeta,
): Promise<RecordingSegmentRow> {
  const storagePath = segmentPath(sessionId, segmentIndex);
  const mimeType = meta.mimeType ?? blob.type ?? DEFAULT_MIME;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, blob, {
      upsert: true,
      contentType: mimeType,
    });

  if (uploadError) {
    throw new Error(
      `Error al subir segmento ${segmentIndex} de ${sessionId}: ${uploadError.message}`,
    );
  }

  const { data, error: insertError } = await supabase
    .from('church_leadership_recording_segments')
    .insert({
      session_id: sessionId,
      segment_index: segmentIndex,
      storage_path: storagePath,
      started_at: meta.startedAt.toISOString(),
      ended_at: meta.endedAt.toISOString(),
      duration_seconds: meta.durationSeconds,
      size_bytes: blob.size,
      mime_type: mimeType,
    })
    .select('*')
    .single();

  if (insertError) {
    throw new Error(
      `Error al registrar segmento ${segmentIndex}: ${insertError.message}`,
    );
  }

  return data as RecordingSegmentRow;
}

// =====================================================
// 3. finalize
// =====================================================

interface Manifest {
  session_id: string;
  meeting_id: string;
  mime_type: string;
  total_duration_seconds: number;
  total_size_bytes: number;
  started_at: string;
  ended_at: string;
  segments: Array<{
    index: number;
    storage_path: string;
    duration_seconds: number;
    size_bytes: number;
    started_at: string;
    ended_at: string;
  }>;
}

/**
 * Cierra una sesión: agrega segmentos, sube un manifest, crea la fila en
 * church_leadership_recordings via insertRecordingRow, y marca la sesión
 * como completed. Retorna la fila de grabación creada.
 */
export async function finalize(
  sessionId: string,
  opts: FinalizeOptions = {},
): Promise<RecordingRow> {
  const session = await getSessionRow(sessionId);
  if (!session) throw new Error(`Sesión ${sessionId} no encontrada`);

  const meetingId = opts.meetingId ?? session.meeting_id;
  const userId = opts.userId ?? session.user_id ?? (await getCurrentUserId());

  const segments = await listSegmentRows(sessionId);
  if (segments.length === 0) {
    throw new Error(`No hay segmentos para finalizar sesión ${sessionId}`);
  }

  const totalDuration = segments.reduce((sum, s) => sum + Number(s.duration_seconds), 0);
  const totalSize = segments.reduce((sum, s) => sum + Number(s.size_bytes), 0);
  const startedAt = segments[0].started_at;
  const endedAt = segments[segments.length - 1].ended_at;
  const mimeType = segments[0].mime_type || session.mime_type || DEFAULT_MIME;

  const manifest: Manifest = {
    session_id: sessionId,
    meeting_id: meetingId,
    mime_type: mimeType,
    total_duration_seconds: totalDuration,
    total_size_bytes: totalSize,
    started_at: startedAt,
    ended_at: endedAt,
    segments: segments.map((s) => ({
      index: s.segment_index,
      storage_path: s.storage_path,
      duration_seconds: Number(s.duration_seconds),
      size_bytes: Number(s.size_bytes),
      started_at: s.started_at,
      ended_at: s.ended_at,
    })),
  };

  const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], {
    type: 'application/json',
  });
  const manifestStoragePath = manifestPath(sessionId);

  const { error: manifestError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(manifestStoragePath, manifestBlob, {
      upsert: true,
      contentType: 'application/json',
    });

  if (manifestError) {
    throw new Error(`Error al subir manifest: ${manifestError.message}`);
  }

  const filename = opts.filename ?? `session-${sessionId}.webm`;

  const recording = await insertRecordingRow({
    meetingId,
    storagePath: manifestStoragePath,
    filename,
    mimeType,
    sizeBytes: totalSize,
    durationSeconds: Math.round(totalDuration),
    userId,
  });

  const { error: sessionUpdateError } = await supabase
    .from('church_leadership_recording_sessions')
    .update({
      status: 'completed',
      ended_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (sessionUpdateError) {
    throw new Error(
      `Error al cerrar sesión ${sessionId}: ${sessionUpdateError.message}`,
    );
  }

  return recording;
}

// =====================================================
// 4. recoverAndFinalize
// =====================================================

/**
 * Escanea IndexedDB en busca de sesiones huérfanas (con chunks bufferizados
 * pero no finalizadas) y las finaliza. Para cada sesión: sube los segmentos
 * faltantes en Storage y luego invoca finalize(). Idempotente: segmentos ya
 * subidos (presentes en church_leadership_recording_segments) se saltan.
 *
 * Seguro para invocar en arranque. Los errores por sesión se acumulan en el
 * resumen retornado en lugar de lanzarse.
 */
export async function recoverAndFinalize(): Promise<RecoverySummary> {
  const summary: RecoverySummary = { recovered: 0, failed: [] };

  let localSessionIds: string[];
  try {
    localSessionIds = await listSessions();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    summary.failed.push({ sessionId: '<indexeddb>', error: message });
    return summary;
  }

  for (const sessionId of localSessionIds) {
    try {
      const session = await getSessionRow(sessionId);
      if (!session) {
        // Sesión local sin fila DB — no hay a qué ligarla. Limpia cache.
        await deleteSession(sessionId);
        continue;
      }

      if (session.status === 'completed') {
        // Ya finalizada; limpia los chunks locales residuales.
        await deleteSession(sessionId);
        continue;
      }

      const existingRows = await listSegmentRows(sessionId);
      const uploadedIndexes = new Set(existingRows.map((r) => r.segment_index));

      const localChunks = await listSegments(sessionId);
      for (const chunk of localChunks) {
        if (uploadedIndexes.has(chunk.segmentIndex)) continue;

        const createdAt = chunk.meta.createdAt ?? Date.now();
        const durationMs = chunk.meta.durationMs ?? 0;
        const startedAt = new Date(createdAt - durationMs);
        const endedAt = new Date(createdAt);

        await uploadSegment(sessionId, chunk.segmentIndex, chunk.blob, {
          startedAt,
          endedAt,
          durationSeconds: durationMs / 1000,
          mimeType: chunk.meta.mimeType ?? chunk.blob.type ?? DEFAULT_MIME,
        });
      }

      const postRows = await listSegmentRows(sessionId);
      if (postRows.length === 0) {
        // Nada que finalizar; marcamos la sesión como abandonada.
        await supabase
          .from('church_leadership_recording_sessions')
          .update({
            status: 'abandoned',
            ended_at: new Date().toISOString(),
          })
          .eq('id', sessionId);
        await deleteSession(sessionId);
        continue;
      }

      await finalize(sessionId);
      await deleteSession(sessionId);
      summary.recovered += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      summary.failed.push({ sessionId, error: message });
    }
  }

  return summary;
}
