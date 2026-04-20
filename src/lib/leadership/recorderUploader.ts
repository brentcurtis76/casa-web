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

export interface ServerOrphanSession {
  sessionId: string;
  startedAt: string;
  segmentCount: number;
  approxDurationSeconds: number;
}

export class MeetingIdMismatchError extends Error {
  readonly sessionId: string;
  readonly expectedMeetingId: string;
  readonly actualMeetingId: string;

  constructor(sessionId: string, expectedMeetingId: string, actualMeetingId: string) {
    super(
      `La sesión ${sessionId} pertenece a la reunión ${actualMeetingId}, se esperaba ${expectedMeetingId}`,
    );
    this.name = 'MeetingIdMismatchError';
    this.sessionId = sessionId;
    this.expectedMeetingId = expectedMeetingId;
    this.actualMeetingId = actualMeetingId;
  }
}

// =====================================================
// Helpers de rutas
// =====================================================

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertSessionUuid(sessionId: string): void {
  if (!UUID_RE.test(sessionId)) {
    throw new Error(`Identificador de sesión inválido: ${sessionId}`);
  }
}

function liveSnapshotPath(sessionId: string): string {
  assertSessionUuid(sessionId);
  return `sessions/${sessionId}/live.webm`;
}

function segmentPath(sessionId: string, segmentIndex: number): string {
  assertSessionUuid(sessionId);
  const padded = String(segmentIndex).padStart(5, '0');
  return `sessions/${sessionId}/segments/${padded}.webm`;
}

function finalRecordingPath(meetingId: string, sessionId: string): string {
  assertSessionUuid(sessionId);
  return `meetings/${meetingId}/${sessionId}/final.webm`;
}

function finalManifestPath(meetingId: string, sessionId: string): string {
  assertSessionUuid(sessionId);
  return `meetings/${meetingId}/${sessionId}/manifest.json`;
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
    .upsert(
      {
        session_id: sessionId,
        segment_index: segmentIndex,
        storage_path: storagePath,
        started_at: meta.startedAt.toISOString(),
        ended_at: meta.endedAt.toISOString(),
        duration_seconds: meta.durationSeconds,
        size_bytes: blob.size,
        mime_type: mimeType,
      },
      { onConflict: 'session_id,segment_index' },
    )
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

  // Descarga cada segmento desde Storage y concatena en un único webm
  // reproducible. MediaRecorder con timeslice produce chunks webm/opus
  // independientes, por lo que concatenarlos con el mismo mime_type da un
  // archivo reproducible sin necesidad de remuxing.
  const segmentBlobs: Blob[] = [];
  for (const seg of segments) {
    const { data: segData, error: downloadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(seg.storage_path);
    if (downloadError || !segData) {
      throw new Error(
        `Error al descargar segmento ${seg.segment_index} (${seg.storage_path}): ${
          downloadError?.message ?? 'sin datos'
        }`,
      );
    }
    segmentBlobs.push(segData);
  }

  const finalBlob = new Blob(segmentBlobs, { type: mimeType });
  const finalStoragePath = finalRecordingPath(meetingId, sessionId);

  const { error: finalUploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(finalStoragePath, finalBlob, {
      upsert: true,
      contentType: mimeType,
    });

  if (finalUploadError) {
    throw new Error(`Error al subir grabación final: ${finalUploadError.message}`);
  }

  // Manifest como debug a path hermano; no bloquear si falla.
  const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], {
    type: 'application/json',
  });
  const debugManifestPath = finalManifestPath(meetingId, sessionId);
  const { error: manifestError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(debugManifestPath, manifestBlob, {
      upsert: true,
      contentType: 'application/json',
    });
  if (manifestError) {
    console.warn(
      `[recorderUploader] No se pudo subir manifest debug (${debugManifestPath}): ${manifestError.message}`,
    );
  }

  const filename =
    opts.filename ??
    `grabacion-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;

  const recording = await insertRecordingRow({
    meetingId,
    storagePath: finalStoragePath,
    filename,
    mimeType,
    sizeBytes: finalBlob.size,
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
// 4. listServerOrphans
// =====================================================

/**
 * Lista sesiones activas en el servidor (estado 'active') para el usuario y la
 * reunión dados. Útil para descubrir huérfanas que ya tienen segmentos subidos
 * al servidor pero cuyos chunks locales en IDB pueden no existir (p. ej. tras
 * limpieza de caché, cambio de dispositivo, u otro navegador).
 */
export async function listServerOrphans(
  userId: string,
  meetingId: string,
): Promise<ServerOrphanSession[]> {
  const { data, error } = await supabase
    .from('church_leadership_recording_sessions')
    .select(
      'id, started_at, church_leadership_recording_segments(duration_seconds)',
    )
    .eq('status', 'active')
    .eq('user_id', userId)
    .eq('meeting_id', meetingId);

  if (error) {
    throw new Error(`Error al listar huérfanas del servidor: ${error.message}`);
  }

  type Row = {
    id: string;
    started_at: string;
    church_leadership_recording_segments:
      | Array<{ duration_seconds: number | string | null }>
      | null;
  };

  return ((data ?? []) as Row[]).map((row) => {
    const segments = row.church_leadership_recording_segments ?? [];
    const approxDurationSeconds = segments.reduce(
      (sum, seg) => sum + Number(seg.duration_seconds ?? 0),
      0,
    );
    return {
      sessionId: row.id,
      startedAt: row.started_at,
      segmentCount: segments.length,
      approxDurationSeconds,
    };
  });
}

// =====================================================
// 5. recoverAndFinalize
// =====================================================

/**
 * Recupera sesiones huérfanas y las finaliza. Combina sesiones locales (IDB)
 * con huérfanas del servidor para la reunión dada (si se pasa `meetingId`),
 * sube los segmentos que falten desde IDB y luego invoca finalize(). Si una
 * sesión no tiene chunks locales (server-only), se intenta finalizar con los
 * segmentos ya subidos al servidor.
 *
 * Cuando se provee `meetingId`, cada sesión se verifica contra él y se lanza
 * `MeetingIdMismatchError` si no coincide (el error se captura por sesión y se
 * acumula en `summary.failed`).
 *
 * Seguro para invocar en arranque. Los errores por sesión se acumulan en el
 * resumen retornado en lugar de lanzarse.
 */
export async function recoverAndFinalize(
  meetingId?: string,
): Promise<RecoverySummary> {
  const summary: RecoverySummary = { recovered: 0, failed: [] };

  let localSessionIds: string[] = [];
  try {
    localSessionIds = await listSessions(meetingId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    summary.failed.push({ sessionId: '<indexeddb>', error: message });
  }

  const sessionIds = new Set<string>(localSessionIds);

  if (meetingId) {
    try {
      const userId = await getCurrentUserId();
      const serverOrphans = await listServerOrphans(userId, meetingId);
      for (const orphan of serverOrphans) {
        sessionIds.add(orphan.sessionId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      summary.failed.push({ sessionId: '<server-orphans>', error: message });
    }
  }

  for (const sessionId of sessionIds) {
    try {
      const session = await getSessionRow(sessionId);
      if (!session) {
        // Sesión local sin fila DB — no hay a qué ligarla. Limpia cache.
        await deleteSession(sessionId);
        continue;
      }

      if (meetingId && session.meeting_id !== meetingId) {
        throw new MeetingIdMismatchError(
          sessionId,
          meetingId,
          session.meeting_id,
        );
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

      const postRows =
        localChunks.length === 0 ? existingRows : await listSegmentRows(sessionId);
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
