/**
 * Quick Publish processor — opinionated single-pass pipeline that turns
 * a raw decoded AudioBuffer into a finished MP3 ready to publish.
 *
 * Order (enhance voice BEFORE mixing music so normalization/compression
 * never touch the intro/outro):
 *   1. applyEnhancements(source, QUICK_ENHANCEMENT_SETTINGS)
 *   2. fetchAudioBuffer for intro/outro (each optional)
 *   3. concatenateWithCrossfade(enhanced, { intro, outro, crossfadeDuration: 0.5 })
 *   4. encodeToMp3 at 128 kbps
 *
 * No ID3 embedding and no download — ID3 happens at publish time so we can
 * embed the chosen cover image (which may be edited after processing).
 */

import { supabase } from '@/integrations/supabase/client';
import {
  applyEnhancements,
  COMPRESSION_PRESETS,
  type EnhancementSettings,
} from './audioEnhancer';
import {
  concatenateWithCrossfade,
  fetchAudioBuffer,
} from './audioProcessor';
import { encodeToMp3 } from './mp3Encoder';

export interface MusicTrack {
  id: string;
  name: string;
  type: 'intro' | 'outro';
  audio_url: string;
  duration_seconds: number | null;
  is_default: boolean;
}

export const QUICK_ENHANCEMENT_SETTINGS: EnhancementSettings = {
  enabled: true,
  gain: 0,
  normalize: true,
  normalizeTarget: -1,
  eq: { bass: 0, mid: 0, treble: 0 },
  compression: { ...COMPRESSION_PRESETS.voice },
  compressionEnabled: true,
};

export class QuickProcessError extends Error {
  readonly stage:
    | 'enhancing'
    | 'fetching-music'
    | 'mixing'
    | 'encoding';

  constructor(message: string, stage: QuickProcessError['stage'], cause?: unknown) {
    super(message);
    this.name = 'QuickProcessError';
    this.stage = stage;
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
}

export interface QuickProcessResult {
  mp3Blob: Blob;
  durationSeconds: number;
}

export interface ProcessQuickAudioOpts {
  introUrl?: string | null;
  outroUrl?: string | null;
  onProgress?: (pct: number, label: string) => void;
}

/**
 * Fetch default intro/outro music tracks. Returns null for either if none
 * is configured as default.
 */
export async function fetchDefaultMusicTracks(): Promise<{
  intro: MusicTrack | null;
  outro: MusicTrack | null;
}> {
  const { data, error } = await supabase
    .from('sermon_music_tracks')
    .select('*')
    .eq('is_default', true);

  if (error) {
    throw new Error(
      `No se pudieron cargar las pistas de música por defecto: ${error.message}`,
    );
  }

  const tracks = (data ?? []) as MusicTrack[];
  const intro = tracks.find((t) => t.type === 'intro') ?? null;
  const outro = tracks.find((t) => t.type === 'outro') ?? null;
  return { intro, outro };
}

export async function processQuickAudio(
  source: AudioBuffer,
  opts: ProcessQuickAudioOpts = {},
): Promise<QuickProcessResult> {
  const { introUrl, outroUrl, onProgress } = opts;

  // 1. Enhance the voice (normalize + voice-preset compression).
  onProgress?.(0, 'Mejorando la voz…');
  let enhanced: AudioBuffer;
  try {
    enhanced = await applyEnhancements(source, QUICK_ENHANCEMENT_SETTINGS);
  } catch (err) {
    throw new QuickProcessError(
      'No se pudo mejorar la voz.',
      'enhancing',
      err,
    );
  }
  onProgress?.(15, 'Mejorando la voz…');

  // 2. Fetch intro/outro buffers if URLs were provided.
  onProgress?.(15, 'Preparando música…');
  let introBuffer: AudioBuffer | null = null;
  let outroBuffer: AudioBuffer | null = null;
  try {
    if (introUrl) introBuffer = await fetchAudioBuffer(introUrl);
    if (outroUrl) outroBuffer = await fetchAudioBuffer(outroUrl);
  } catch (err) {
    throw new QuickProcessError(
      'No se pudo cargar la música de intro/cierre.',
      'fetching-music',
      err,
    );
  }
  onProgress?.(30, 'Preparando música…');

  // 3. Mix intro/outro with the enhanced voice.
  onProgress?.(30, 'Añadiendo intro y cierre…');
  let finalBuffer: AudioBuffer;
  try {
    if (introBuffer || outroBuffer) {
      finalBuffer = await concatenateWithCrossfade(enhanced, {
        introBuffer,
        outroBuffer,
        crossfadeDuration: 0.5,
      });
    } else {
      finalBuffer = enhanced;
    }
  } catch (err) {
    throw new QuickProcessError(
      'No se pudo mezclar el audio con la música.',
      'mixing',
      err,
    );
  }
  onProgress?.(40, 'Añadiendo intro y cierre…');

  // 4. Encode to MP3 (40 → 100% of the bar).
  onProgress?.(40, 'Codificando MP3…');
  let mp3Blob: Blob;
  try {
    mp3Blob = await encodeToMp3(finalBuffer, {
      bitrate: 128,
      onProgress: (p) => onProgress?.(40 + p * 0.6, 'Codificando MP3…'),
    });
  } catch (err) {
    throw new QuickProcessError(
      'No se pudo codificar el MP3.',
      'encoding',
      err,
    );
  }
  onProgress?.(100, 'Codificando MP3…');

  return {
    mp3Blob,
    durationSeconds: finalBuffer.duration,
  };
}
