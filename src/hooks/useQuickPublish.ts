/**
 * useQuickPublish — state machine for the Publicación Rápida flow.
 *
 * Steps: upload → liturgy → processing → review → publishing → done
 *
 * Sub-states are independent so one failure does not reset another:
 *   - processing : voice mix + MP3 encode
 *   - cover      : Gemini illustration generation / cover upload
 *   - publish    : Supabase storage upload + episode row update
 *
 * The decoded source AudioBuffer is kept in a ref so retries do not re-decode.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import {
  decodeAudioFile,
  getAudioFileInfo,
  type AudioFileInfo,
} from '@/lib/sermon-editor/audioProcessor';
import {
  fetchDefaultMusicTracks,
  processQuickAudio,
  type MusicTrack,
} from '@/lib/sermon-editor/quickProcessor';
import {
  buildSermonCoverPrompt,
  getCasaLogoAsBase64,
  type GenerateIllustrationResponse,
} from '@/lib/covers/coverPromptBuilder';
import { base64ToSpotifyCover } from '@/lib/sermon-editor/coverImageUtils';
import {
  publishEpisode,
  type PublishStage,
} from '@/lib/sermon-editor/publishService';
import {
  createMP3Metadata,
  embedMetadata,
  blobToArrayBuffer,
} from '@/lib/sermon-editor/metadataEmbedder';
import {
  validateForSpotify,
  type ValidationResult,
} from '@/lib/sermon-editor/spotifyValidator';

export type QuickStep =
  | 'upload'
  | 'liturgy'
  | 'processing'
  | 'review'
  | 'publishing'
  | 'done';

export interface QuickLiturgy {
  id: string;
  titulo: string;
  fecha: string;
  resumen: string | null;
  predicador: string | null;
}

export interface QuickMetadata {
  title: string;
  speaker: string;
  date: Date;
  description: string;
  liturgyId?: string | null;
}

export interface ProcessingState {
  status: 'idle' | 'running' | 'error' | 'done';
  progress: number;
  label: string;
  error?: string;
}

export interface CoverState {
  status: 'idle' | 'generating' | 'error' | 'done';
  blob?: Blob;
  previewUrl?: string;
  error?: string;
}

export interface PublishState {
  stage?: PublishStage;
  error?: string;
  episodeId?: string;
}

export interface QuickPublishState {
  step: QuickStep;
  fileInfo: AudioFileInfo | null;
  liturgies: QuickLiturgy[];
  matchedLiturgy: QuickLiturgy | null;
  loadingLiturgies: boolean;
  metadata: QuickMetadata;
  processing: ProcessingState;
  cover: CoverState;
  publish: PublishState;
  processedMp3: Blob | null;
  durationSeconds: number;
  musicWarning: string | null;
  validation: ValidationResult;
  feedUrl: string | null;
}

const INITIAL_METADATA: QuickMetadata = {
  title: '',
  speaker: '',
  date: new Date(),
  description: '',
  liturgyId: null,
};

const INITIAL_PROCESSING: ProcessingState = {
  status: 'idle',
  progress: 0,
  label: '',
};

const INITIAL_COVER: CoverState = { status: 'idle' };

const INITIAL_PUBLISH: PublishState = {};

const EMPTY_VALIDATION: ValidationResult = {
  isValid: false,
  errors: ['Sube el audio primero'],
  warnings: [],
};

interface IllustrationRequestBody {
  jsonPrompt: string;
  referenceImage: string;
  count: number;
  aspectRatio: '1:1';
}

export function useQuickPublish() {
  const [step, setStep] = useState<QuickStep>('upload');
  const [fileInfo, setFileInfo] = useState<AudioFileInfo | null>(null);
  const [liturgies, setLiturgies] = useState<QuickLiturgy[]>([]);
  const [matchedLiturgy, setMatchedLiturgy] = useState<QuickLiturgy | null>(
    null,
  );
  const [loadingLiturgies, setLoadingLiturgies] = useState(false);
  const [metadata, setMetadata] = useState<QuickMetadata>(INITIAL_METADATA);
  const [processing, setProcessing] =
    useState<ProcessingState>(INITIAL_PROCESSING);
  const [cover, setCover] = useState<CoverState>(INITIAL_COVER);
  const [publish, setPublish] = useState<PublishState>(INITIAL_PUBLISH);
  const [processedMp3, setProcessedMp3] = useState<Blob | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [musicWarning, setMusicWarning] = useState<string | null>(null);
  const [feedUrl, setFeedUrl] = useState<string | null>(null);

  const sourceBufferRef = useRef<AudioBuffer | null>(null);
  const coverPreviewUrlRef = useRef<string | null>(null);

  // Release the cover preview URL whenever it changes or on unmount.
  useEffect(() => {
    return () => {
      if (coverPreviewUrlRef.current) {
        URL.revokeObjectURL(coverPreviewUrlRef.current);
        coverPreviewUrlRef.current = null;
      }
    };
  }, []);

  const setCoverBlob = useCallback((blob: Blob) => {
    if (coverPreviewUrlRef.current) {
      URL.revokeObjectURL(coverPreviewUrlRef.current);
    }
    const url = URL.createObjectURL(blob);
    coverPreviewUrlRef.current = url;
    setCover({ status: 'done', blob, previewUrl: url });
  }, []);

  const clearCoverPreview = useCallback(() => {
    if (coverPreviewUrlRef.current) {
      URL.revokeObjectURL(coverPreviewUrlRef.current);
      coverPreviewUrlRef.current = null;
    }
  }, []);

  // ── Step 2: liturgy (declared before handleFileSelected because the
  //    upload handler kicks this off in the background).
  const loadLiturgies = useCallback(async () => {
    setLoadingLiturgies(true);
    try {
      const { data, error } = await supabase
        .from('liturgias')
        .select('id, titulo, fecha, resumen, predicador')
        .order('fecha', { ascending: false })
        .limit(50);
      if (error) throw error;
      const rows = (data ?? []) as QuickLiturgy[];
      setLiturgies(rows);

      // Auto-match: same date as today if present.
      const today = format(new Date(), 'yyyy-MM-dd');
      const match = rows.find((l) => l.fecha === today) ?? null;
      setMatchedLiturgy(match);
    } catch (err) {
      console.error('[useQuickPublish] failed to load liturgies', err);
      setLiturgies([]);
      setMatchedLiturgy(null);
    } finally {
      setLoadingLiturgies(false);
    }
  }, []);

  // ── Step 1: upload ─────────────────────────────────────────────────────
  const handleFileSelected = useCallback(
    async (file: File) => {
      try {
        const buffer = await decodeAudioFile(file);
        sourceBufferRef.current = buffer;
        const info = await getAudioFileInfo(file, buffer);
        setFileInfo(info);
        // Reset downstream state so re-uploading restarts the flow cleanly.
        setProcessedMp3(null);
        setProcessing(INITIAL_PROCESSING);
        setPublish(INITIAL_PUBLISH);
        setMusicWarning(null);
        // Load liturgies in the background; advance immediately.
        void loadLiturgies();
        setStep('liturgy');
      } catch (err) {
        console.error('[useQuickPublish] decode failed', err);
        // Surface the failure via fileInfo cleared + processing.error so the
        // AudioUploader's error prop can show it.
        sourceBufferRef.current = null;
        setProcessing({
          status: 'error',
          progress: 0,
          label: '',
          error:
            err instanceof Error
              ? err.message
              : 'No se pudo decodificar el audio.',
        });
      }
    },
    [loadLiturgies],
  );

  const clearAudio = useCallback(() => {
    sourceBufferRef.current = null;
    setFileInfo(null);
    setProcessing(INITIAL_PROCESSING);
    setStep('upload');
  }, []);

  const selectLiturgy = useCallback((l: QuickLiturgy) => {
    const date = parseDateOnly(l.fecha) ?? new Date();
    setMetadata({
      title: l.titulo,
      speaker: l.predicador ?? '',
      date,
      description: l.resumen ?? '',
      liturgyId: l.id,
    });
  }, []);

  const continueWithoutLiturgy = useCallback(
    (manual: { title: string; speaker: string; date: Date }) => {
      setMetadata({
        title: manual.title,
        speaker: manual.speaker,
        date: manual.date,
        description: '',
        liturgyId: null,
      });
    },
    [],
  );

  const updateMetadata = useCallback((partial: Partial<QuickMetadata>) => {
    setMetadata((prev) => ({ ...prev, ...partial }));
  }, []);

  // ── Step 3: processing + cover (run in parallel) ───────────────────────
  const startProcessing = useCallback(async () => {
    const source = sourceBufferRef.current;
    if (!source) {
      setProcessing({
        status: 'error',
        progress: 0,
        label: '',
        error: 'No hay audio cargado.',
      });
      return;
    }

    setProcessing({ status: 'running', progress: 0, label: 'Iniciando…' });

    let tracks: { intro: MusicTrack | null; outro: MusicTrack | null };
    try {
      tracks = await fetchDefaultMusicTracks();
    } catch (err) {
      console.error('[useQuickPublish] music fetch failed', err);
      setProcessing({
        status: 'error',
        progress: 0,
        label: '',
        error:
          err instanceof Error
            ? err.message
            : 'No se pudo cargar la música de intro/cierre.',
      });
      return;
    }

    if (!tracks.intro && !tracks.outro) {
      setMusicWarning(
        'No hay música de intro/cierre configurada — el episodio se publicará sin música.',
      );
    } else {
      setMusicWarning(null);
    }

    try {
      const result = await processQuickAudio(source, {
        introUrl: tracks.intro?.audio_url ?? null,
        outroUrl: tracks.outro?.audio_url ?? null,
        onProgress: (pct, label) => {
          setProcessing({
            status: 'running',
            progress: pct,
            label,
          });
        },
      });

      setProcessedMp3(result.mp3Blob);
      setDurationSeconds(result.durationSeconds);
      setProcessing({
        status: 'done',
        progress: 100,
        label: 'Listo',
      });
    } catch (err) {
      console.error('[useQuickPublish] processing failed', err);
      setProcessing((prev) => ({
        status: 'error',
        progress: prev.progress,
        label: prev.label,
        error:
          err instanceof Error
            ? err.message
            : 'Falló el procesamiento del audio.',
      }));
    }
  }, []);

  const generateCover = useCallback(
    async (theme?: string) => {
      const { title, speaker } = metadata;
      if (!title || !speaker) {
        setCover({
          status: 'error',
          error: 'Título y predicador son requeridos para generar la portada.',
        });
        return;
      }

      setCover({ status: 'generating' });

      try {
        const logoBase64 = await getCasaLogoAsBase64();
        const jsonPrompt = buildSermonCoverPrompt({
          title,
          preacher: speaker,
          illustrationTheme: theme,
          aspect: '1:1',
        });

        const body: IllustrationRequestBody = {
          jsonPrompt,
          referenceImage: logoBase64,
          count: 1,
          aspectRatio: '1:1',
        };

        const { data, error } = await supabase.functions.invoke<
          GenerateIllustrationResponse
        >('generate-illustration', { body });

        if (error) throw error;

        const valid = (data?.illustrations ?? []).filter(
          (i) => i && i.length > 0,
        );
        if (valid.length === 0) {
          throw new Error('No se pudieron generar portadas');
        }

        const blob = await base64ToSpotifyCover(valid[0]);
        setCoverBlob(blob);
      } catch (err) {
        console.error('[useQuickPublish] cover generation failed', err);
        setCover({
          status: 'error',
          error:
            err instanceof Error
              ? err.message
              : 'No se pudo generar la portada.',
        });
      }
    },
    [metadata, setCoverBlob],
  );

  const setCustomCover = useCallback(
    (blob: Blob) => {
      setCoverBlob(blob);
    },
    [setCoverBlob],
  );

  /**
   * Run processing + cover generation in parallel. Advances the step to
   * 'review' as soon as processing finishes — the cover can still be
   * generating in the background and the review panel handles its own
   * cover state.
   */
  const confirmLiturgyStep = useCallback(async () => {
    setStep('processing');
    setProcessing(INITIAL_PROCESSING);
    setCover(INITIAL_COVER);

    const audioPromise = startProcessing().then(() => {
      // After processing finishes (success or error), advance to review.
      // The review screen renders error states inline so this never blocks.
      setStep('review');
    });

    const coverPromise = generateCover();

    await Promise.allSettled([audioPromise, coverPromise]);
  }, [startProcessing, generateCover]);

  const changeLiturgy = useCallback(() => {
    setStep('liturgy');
  }, []);

  // ── Step 4: publishing ─────────────────────────────────────────────────
  const publishNow = useCallback(async () => {
    if (!processedMp3 || !cover.blob) return;

    setStep('publishing');
    setPublish({ stage: 'saving-draft' });

    try {
      const coverBuffer = await blobToArrayBuffer(cover.blob);
      const mp3Meta = createMP3Metadata(
        metadata.title,
        metadata.speaker,
        metadata.date,
        {
          description: metadata.description || undefined,
          coverImageBuffer: coverBuffer,
        },
      );
      const embedded = await embedMetadata(processedMp3, mp3Meta);
      if (embedded === processedMp3) {
        console.warn(
          '[useQuickPublish] embedMetadata returned original blob — ID3 not embedded',
        );
      }

      const result = await publishEpisode({
        mp3Blob: embedded,
        coverBlob: cover.blob,
        durationSeconds,
        metadata: {
          title: metadata.title,
          description: metadata.description,
          speaker: metadata.speaker,
          episodeDate: format(metadata.date, 'yyyy-MM-dd'),
          liturgyId: metadata.liturgyId ?? null,
        },
        existingEpisodeId: publish.episodeId,
        onStage: (stage) =>
          setPublish((prev) => ({ ...prev, stage, episodeId: prev.episodeId })),
      });

      setPublish({
        stage: 'done',
        episodeId: result.episodeId,
      });
      setFeedUrl(result.feedUrl);
      setStep('done');
    } catch (err) {
      console.error('[useQuickPublish] publish failed', err);
      const message =
        err instanceof Error ? err.message : 'No se pudo publicar el episodio.';
      const errEpisodeId =
        typeof err === 'object' &&
        err !== null &&
        'episodeId' in err &&
        typeof (err as { episodeId: unknown }).episodeId === 'string'
          ? ((err as { episodeId: string }).episodeId as string)
          : publish.episodeId;
      setPublish((prev) => ({
        ...prev,
        error: message,
        episodeId: errEpisodeId ?? prev.episodeId,
      }));
      setStep('review');
    }
  }, [
    processedMp3,
    cover.blob,
    metadata,
    durationSeconds,
    publish.episodeId,
  ]);

  // ── Reset ──────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    sourceBufferRef.current = null;
    clearCoverPreview();
    setStep('upload');
    setFileInfo(null);
    setMatchedLiturgy(null);
    setMetadata(INITIAL_METADATA);
    setProcessing(INITIAL_PROCESSING);
    setCover(INITIAL_COVER);
    setPublish(INITIAL_PUBLISH);
    setProcessedMp3(null);
    setDurationSeconds(0);
    setMusicWarning(null);
    setFeedUrl(null);
  }, [clearCoverPreview]);

  // ── Derived: validation ────────────────────────────────────────────────
  const validation: ValidationResult = processedMp3
    ? validateForSpotify(
        processedMp3,
        cover.blob ?? null,
        {
          title: metadata.title,
          speaker: metadata.speaker,
          description: metadata.description,
        },
        durationSeconds,
      )
    : EMPTY_VALIDATION;

  const state: QuickPublishState = {
    step,
    fileInfo,
    liturgies,
    matchedLiturgy,
    loadingLiturgies,
    metadata,
    processing,
    cover,
    publish,
    processedMp3,
    durationSeconds,
    musicWarning,
    validation,
    feedUrl,
  };

  return {
    state,
    handleFileSelected,
    clearAudio,
    selectLiturgy,
    continueWithoutLiturgy,
    updateMetadata,
    confirmLiturgyStep,
    changeLiturgy,
    generateCover,
    setCustomCover,
    publishNow,
    reset,
  };
}

function parseDateOnly(yyyymmdd: string): Date | null {
  // 'yyyy-mm-dd' interpreted in local time so the calendar date does not
  // shift due to UTC parsing.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyymmdd);
  if (!match) return null;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d));
}
