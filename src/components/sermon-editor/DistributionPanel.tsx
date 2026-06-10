/**
 * Distribution Panel - Spotify validation and package export
 * PROMPT_006: Spotify Integration
 *
 * Features:
 * - Spotify requirements validation
 * - ZIP package download (MP3 + cover + metadata.txt)
 * - Copy buttons for metadata fields
 * - Direct link to Spotify for Podcasters
 */
import React, { useState, useCallback } from 'react';
import { format } from 'date-fns';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  Package,
  Loader2,
  Rss,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { SermonMetadata } from './MetadataForm';
import type { ValidationResult } from '@/lib/sermon-editor/spotifyValidator';
import { createDistributionZip, DistributionPackage } from '@/lib/sermon-editor/distributionPackage';
import {
  publishEpisode,
  PODCAST_FEED_URL,
  type PublishStage,
} from '@/lib/sermon-editor/publishService';

interface DistributionPanelProps {
  audioBlob: Blob | null;
  coverImage: Blob | null;
  metadata: SermonMetadata;
  validation: ValidationResult;
  /** Final audio duration in seconds (post-trim, post-intro/outro). */
  durationSeconds: number;
  disabled?: boolean;
}

interface PublishUiState {
  stage: PublishStage | null;
  error: string | null;
  publishedEpisodeId: string | null;
  isPublishing: boolean;
  isDone: boolean;
}

const INITIAL_PUBLISH_UI: PublishUiState = {
  stage: null,
  error: null,
  publishedEpisodeId: null,
  isPublishing: false,
  isDone: false,
};

const PUBLISH_STAGE_LABELS: Record<PublishStage, string> = {
  'saving-draft': 'Preparando archivo…',
  'uploading-audio': 'Subiendo audio…',
  'uploading-cover': 'Subiendo portada…',
  publishing: 'Registrando episodio…',
  done: 'Publicado',
};

// Brand toast styles
const toastStyles = {
  success: {
    style: { background: '#292524', color: '#fef3c7', border: '1px solid #D97706' },
  },
  error: {
    style: { background: '#292524', color: '#fef3c7', border: '1px solid #dc2626' },
  },
};

export function DistributionPanel({
  audioBlob,
  coverImage,
  metadata,
  validation,
  durationSeconds,
  disabled = false,
}: DistributionPanelProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [publishUi, setPublishUi] = useState<PublishUiState>(INITIAL_PUBLISH_UI);

  const handlePublish = useCallback(async () => {
    if (!audioBlob || !coverImage) return;
    setPublishUi({
      stage: 'saving-draft',
      error: null,
      publishedEpisodeId: publishUi.publishedEpisodeId,
      isPublishing: true,
      isDone: false,
    });

    try {
      const result = await publishEpisode({
        mp3Blob: audioBlob,
        coverBlob: coverImage,
        durationSeconds: Math.max(0, Math.round(durationSeconds)),
        metadata: {
          title: metadata.title,
          description: metadata.description ?? '',
          speaker: metadata.speaker,
          episodeDate: format(metadata.date, 'yyyy-MM-dd'),
          liturgyId: metadata.liturgyId ?? null,
        },
        existingEpisodeId: publishUi.publishedEpisodeId ?? undefined,
        onStage: (stage) =>
          setPublishUi((prev) => ({ ...prev, stage })),
      });

      setPublishUi({
        stage: 'done',
        error: null,
        publishedEpisodeId: result.episodeId,
        isPublishing: false,
        isDone: true,
      });
      toast.success('Episodio publicado', toastStyles.success);
    } catch (err) {
      console.error('[DistributionPanel] publish failed', err);
      const message =
        err instanceof Error ? err.message : 'No se pudo publicar el episodio';
      const errEpisodeId =
        typeof err === 'object' &&
        err !== null &&
        'episodeId' in err &&
        typeof (err as { episodeId: unknown }).episodeId === 'string'
          ? ((err as { episodeId: string }).episodeId as string)
          : publishUi.publishedEpisodeId;
      setPublishUi({
        stage: null,
        error: message,
        publishedEpisodeId: errEpisodeId,
        isPublishing: false,
        isDone: false,
      });
      toast.error(message, toastStyles.error);
    }
  }, [
    audioBlob,
    coverImage,
    metadata,
    durationSeconds,
    publishUi.publishedEpisodeId,
  ]);

  // Copy text to clipboard
  const copyToClipboard = useCallback(async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success('Copiado al portapapeles', toastStyles.success);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error('Error al copiar', toastStyles.error);
    }
  }, []);

  // Download ZIP package
  const downloadPackage = useCallback(async () => {
    if (!audioBlob || !coverImage) return;

    setIsDownloading(true);
    try {
      const pkg: DistributionPackage = {
        audioFile: audioBlob,
        audioFileName: `sermon_${metadata.title}.mp3`,
        coverImage: coverImage,
        coverFileName: `portada_${metadata.title}.jpg`,
        metadata,
        validation,
      };

      const zipBlob = await createDistributionZip(pkg);

      // Trigger download
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sermon_${metadata.title}_spotify.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Paquete descargado', toastStyles.success);
    } catch (err) {
      console.error('Error creating package:', err);
      toast.error('Error al crear el paquete', toastStyles.error);
    } finally {
      setIsDownloading(false);
    }
  }, [audioBlob, coverImage, metadata, validation]);

  // Open Spotify for Podcasters
  const openSpotify = useCallback(() => {
    window.open('https://podcasters.spotify.com', '_blank', 'noopener,noreferrer');
  }, []);

  // Render validation item
  const ValidationItem = ({
    passed,
    label,
    isWarning = false
  }: {
    passed: boolean;
    label: string;
    isWarning?: boolean;
  }) => (
    <div className="flex items-center gap-2 text-sm">
      {passed ? (
        <CheckCircle2 className="h-4 w-4 text-amber-500 flex-shrink-0" />
      ) : isWarning ? (
        <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
      )}
      <span className={passed ? 'text-muted-foreground' : isWarning ? 'text-amber-600' : 'text-red-600'}>
        {label}
      </span>
    </div>
  );

  // Copy field button
  const CopyField = ({ label, value, field }: { label: string; value: string; field: string }) => (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground w-24">{label}:</span>
      <div className="flex-1 text-sm truncate bg-muted px-2 py-1 rounded">
        {value || '\u2014'}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => copyToClipboard(value, field)}
        disabled={!value}
        className="h-8 w-8 p-0"
      >
        {copiedField === field ? (
          <Check className="h-4 w-4 text-amber-500" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Validation Section */}
      <div className="rounded-lg border p-4 space-y-2">
        <h4 className="font-medium text-sm flex items-center gap-2">
          {validation.isValid ? (
            <CheckCircle2 className="h-4 w-4 text-amber-500" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
          Validacion para Spotify
        </h4>

        <div className="space-y-1 pl-6">
          {/* Show errors */}
          {validation.errors.map((error, i) => (
            <ValidationItem key={`error-${i}`} passed={false} label={error} />
          ))}

          {/* Show success items if valid */}
          {validation.isValid && (
            <>
              <ValidationItem passed label={`Audio: MP3, ${audioBlob ? (audioBlob.size / (1024 * 1024)).toFixed(1) : 0}MB`} />
              <ValidationItem passed label={`Portada: 1400x1400, ${coverImage ? (coverImage.size / 1024).toFixed(0) : 0}KB`} />
              <ValidationItem passed label={`Titulo: ${metadata.title?.length || 0} caracteres`} />
            </>
          )}

          {/* Show warnings */}
          {validation.warnings.map((warning, i) => (
            <ValidationItem key={`warning-${i}`} passed={false} label={warning} isWarning />
          ))}
        </div>
      </div>

      {/* Primary action — publish to the self-hosted podcast feed */}
      <div className="space-y-2">
        <Button
          onClick={handlePublish}
          disabled={
            !validation.isValid ||
            disabled ||
            publishUi.isPublishing ||
            publishUi.isDone
          }
          className="w-full bg-amber-600 hover:bg-amber-700"
        >
          {publishUi.isPublishing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          {publishUi.isDone
            ? 'Publicado'
            : publishUi.publishedEpisodeId && !publishUi.isPublishing
              ? 'Reintentar publicación'
              : 'Publicar episodio'}
        </Button>

        {publishUi.isPublishing && publishUi.stage && (
          <p className="text-xs text-muted-foreground">
            {PUBLISH_STAGE_LABELS[publishUi.stage]}
          </p>
        )}

        {publishUi.error && (
          <p className="text-xs text-red-600">{publishUi.error}</p>
        )}

        {publishUi.isDone && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm flex items-center justify-between gap-3">
            <span className="text-amber-800">
              Episodio publicado en el feed.
            </span>
            <Button asChild variant="ghost" size="sm">
              <a
                href={PODCAST_FEED_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Rss className="h-4 w-4 mr-2" />
                Ver feed
              </a>
            </Button>
          </div>
        )}
      </div>

      {/* Secondary actions — legacy ZIP download + Spotify console */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={downloadPackage}
          disabled={!validation.isValid || disabled || isDownloading}
          className="flex-1"
        >
          {isDownloading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Package className="h-4 w-4 mr-2" />
          )}
          Descargar paquete (manual)
        </Button>

        <Button
          variant="outline"
          onClick={openSpotify}
          className="flex-1"
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Abrir Spotify
        </Button>
      </div>

      {/* Metadata Copy Section */}
      <div className="space-y-2 border-t pt-4">
        <h4 className="text-sm font-medium text-muted-foreground">
          Metadatos para copiar
        </h4>
        <CopyField label="Titulo" value={metadata.title} field="title" />
        <CopyField label="Predicador" value={metadata.speaker} field="speaker" />
        <CopyField
          label="Fecha"
          value={metadata.date?.toISOString().split('T')[0] || ''}
          field="date"
        />
        {metadata.description && (
          <CopyField label="Descripcion" value={metadata.description} field="description" />
        )}
      </div>
    </div>
  );
}
