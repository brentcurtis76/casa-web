/**
 * Publish Service — Publicación Rápida Phase A
 *
 * Sube el MP3 (y cover opcional) al bucket `podcast-media` y deja el episodio
 * en `church_podcast_episodes` con estado `published`. La edge function
 * `podcast-rss` lo expone vía RSS.
 *
 * El flujo es idempotente: si una fase falla, se lanza un `PublishError` con
 * el `episodeId` y la etapa, para que el caller pueda reintentar con
 * `existingEpisodeId`.
 */

import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

const PODCAST_BUCKET = 'podcast-media';

export const PODCAST_FEED_URL =
  'https://mulsqxfhxxdsadxsljss.supabase.co/functions/v1/podcast-rss';

export type PodcastEpisode =
  Database['public']['Tables']['church_podcast_episodes']['Row'];

export interface EpisodeMetadataInput {
  title: string;
  description: string;
  speaker: string;
  /** yyyy-mm-dd */
  episodeDate: string;
  liturgyId?: string | null;
}

export type PublishStage =
  | 'saving-draft'
  | 'uploading-audio'
  | 'uploading-cover'
  | 'publishing'
  | 'done';

export interface PublishResult {
  episodeId: string;
  audioUrl: string;
  coverUrl: string | null;
  guid: string;
  episodeNumber: number;
  feedUrl: string;
}

export class PublishError extends Error {
  readonly stage: PublishStage;
  readonly episodeId: string | null;
  readonly cause?: unknown;

  constructor(
    message: string,
    stage: PublishStage,
    episodeId: string | null,
    cause?: unknown,
  ) {
    super(message);
    this.name = 'PublishError';
    this.stage = stage;
    this.episodeId = episodeId;
    this.cause = cause;
  }
}

interface PublishArgs {
  mp3Blob: Blob;
  coverBlob: Blob | null;
  durationSeconds: number;
  metadata: EpisodeMetadataInput;
  publishedAt?: Date;
  existingEpisodeId?: string;
  onStage?: (s: PublishStage) => void;
}

/**
 * Devuelve el próximo número de episodio (max + 1, o 1 si no hay ninguno).
 */
async function getNextEpisodeNumber(): Promise<number> {
  const { data, error } = await supabase
    .from('church_podcast_episodes')
    .select('episode_number')
    .not('episode_number', 'is', null)
    .order('episode_number', { ascending: false })
    .limit(1);

  if (error) {
    throw new PublishError(
      `No se pudo calcular el número de episodio: ${error.message}`,
      'publishing',
      null,
      error,
    );
  }

  const current = data?.[0]?.episode_number ?? 0;
  return current + 1;
}

/**
 * Detecta el error de violación de constraint único de Postgres.
 * Supabase devuelve `code: '23505'` cuando aplica.
 */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === '23505'
  );
}

export async function publishEpisode(args: PublishArgs): Promise<PublishResult> {
  const {
    mp3Blob,
    coverBlob,
    durationSeconds,
    metadata,
    publishedAt,
    existingEpisodeId,
    onStage,
  } = args;

  // ── Stage 1: draft row (insert or reuse) ────────────────────────────────
  onStage?.('saving-draft');

  let episodeId: string;
  let guid: string;
  let existingEpisodeNumber: number | null = null;

  if (existingEpisodeId) {
    const { data, error } = await supabase
      .from('church_podcast_episodes')
      .select('id, guid, episode_number')
      .eq('id', existingEpisodeId)
      .single();

    if (error || !data) {
      throw new PublishError(
        `No se pudo recuperar el episodio existente: ${error?.message ?? 'no encontrado'}`,
        'saving-draft',
        existingEpisodeId,
        error,
      );
    }

    episodeId = data.id;
    guid = data.guid;
    existingEpisodeNumber = data.episode_number;
  } else {
    const { data: userData } = await supabase.auth.getUser();
    const createdBy = userData?.user?.id ?? null;

    const { data, error } = await supabase
      .from('church_podcast_episodes')
      .insert({
        title: metadata.title,
        description: metadata.description || null,
        speaker: metadata.speaker || null,
        episode_date: metadata.episodeDate,
        liturgy_id: metadata.liturgyId ?? null,
        created_by: createdBy,
      })
      .select('id, guid, episode_number')
      .single();

    if (error || !data) {
      throw new PublishError(
        `No se pudo crear el borrador del episodio: ${error?.message ?? 'desconocido'}`,
        'saving-draft',
        null,
        error,
      );
    }

    episodeId = data.id;
    guid = data.guid;
    existingEpisodeNumber = data.episode_number;
  }

  // ── Stage 2: upload audio ──────────────────────────────────────────────
  onStage?.('uploading-audio');

  const audioPath = `episodes/${episodeId}/audio.mp3`;

  const { error: audioUploadError } = await supabase.storage
    .from(PODCAST_BUCKET)
    .upload(audioPath, mp3Blob, {
      contentType: 'audio/mpeg',
      upsert: true,
      cacheControl: '3600',
    });

  if (audioUploadError) {
    throw new PublishError(
      `Falló la subida del audio: ${audioUploadError.message}`,
      'uploading-audio',
      episodeId,
      audioUploadError,
    );
  }

  const { data: audioPublic } = supabase.storage
    .from(PODCAST_BUCKET)
    .getPublicUrl(audioPath);
  const audioUrl = audioPublic.publicUrl;

  // ── Stage 3: upload cover (optional) ───────────────────────────────────
  let coverUrl: string | null = null;
  if (coverBlob) {
    onStage?.('uploading-cover');

    const coverPath = `episodes/${episodeId}/cover.jpg`;
    const { error: coverUploadError } = await supabase.storage
      .from(PODCAST_BUCKET)
      .upload(coverPath, coverBlob, {
        contentType: 'image/jpeg',
        upsert: true,
        cacheControl: '3600',
      });

    if (coverUploadError) {
      throw new PublishError(
        `Falló la subida de la portada: ${coverUploadError.message}`,
        'uploading-cover',
        episodeId,
        coverUploadError,
      );
    }

    const { data: coverPublic } = supabase.storage
      .from(PODCAST_BUCKET)
      .getPublicUrl(coverPath);
    coverUrl = coverPublic.publicUrl;
  }

  // ── Stage 4: assign episode_number + publish ───────────────────────────
  onStage?.('publishing');

  const publishedAtIso = (publishedAt ?? new Date()).toISOString();
  const durationInt = Math.round(durationSeconds);

  const tryPublish = async (episodeNumber: number) => {
    return supabase
      .from('church_podcast_episodes')
      .update({
        status: 'published',
        audio_url: audioUrl,
        audio_size_bytes: mp3Blob.size,
        duration_seconds: durationInt,
        cover_url: coverUrl,
        published_at: publishedAtIso,
        episode_number: episodeNumber,
      })
      .eq('id', episodeId)
      .select('episode_number')
      .single();
  };

  let episodeNumber =
    existingEpisodeNumber ?? (await getNextEpisodeNumber());

  let result = await tryPublish(episodeNumber);

  if (result.error && isUniqueViolation(result.error) && existingEpisodeNumber === null) {
    // Race against another publish — retry once with a fresh max+1.
    episodeNumber = await getNextEpisodeNumber();
    result = await tryPublish(episodeNumber);
  }

  if (result.error || !result.data) {
    throw new PublishError(
      `No se pudo publicar el episodio: ${result.error?.message ?? 'desconocido'}`,
      'publishing',
      episodeId,
      result.error,
    );
  }

  onStage?.('done');

  return {
    episodeId,
    audioUrl,
    coverUrl,
    guid,
    episodeNumber: result.data.episode_number ?? episodeNumber,
    feedUrl: PODCAST_FEED_URL,
  };
}

/**
 * Lista todos los episodios (incluye borradores) — vista admin.
 */
export async function listEpisodes(): Promise<PodcastEpisode[]> {
  const { data, error } = await supabase
    .from('church_podcast_episodes')
    .select('*')
    .order('episode_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`No se pudieron listar los episodios: ${error.message}`);
  }
  return data ?? [];
}

/**
 * Despublica un episodio (lo regresa a estado `draft`).
 * Conserva los archivos en storage y los metadatos para poder re-publicar.
 */
export async function unpublishEpisode(episodeId: string): Promise<void> {
  const { error } = await supabase
    .from('church_podcast_episodes')
    .update({ status: 'draft' })
    .eq('id', episodeId);

  if (error) {
    throw new Error(`No se pudo despublicar el episodio: ${error.message}`);
  }
}
