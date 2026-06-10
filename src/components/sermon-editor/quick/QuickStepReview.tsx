/**
 * QuickStepReview — step 4 of Publicación Rápida. Slim editable metadata
 * + audio preview + cover card + validation panel + primary publish button.
 *
 * Intentionally does NOT reuse MetadataForm — that form drags in its own
 * liturgy select and a hardcoded preacher suggestions list.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  AlertTriangle,
  CheckCircle2,
  Link2,
  Link2Off,
  Pencil,
  XCircle,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  formatDurationLong,
  formatFileSize,
} from '@/lib/sermon-editor/audioProcessor';
import type {
  CoverState,
  ProcessingState,
  PublishState,
  QuickLiturgy,
  QuickMetadata,
} from '@/hooks/useQuickPublish';
import type { ValidationResult } from '@/lib/sermon-editor/spotifyValidator';
import { QuickCoverCard } from './QuickCoverCard';

const TITLE_MAX = 100;
const DESCRIPTION_MAX = 4000;

interface QuickStepReviewProps {
  metadata: QuickMetadata;
  processing: ProcessingState;
  processedMp3: Blob | null;
  durationSeconds: number;
  cover: CoverState;
  publish: PublishState;
  validation: ValidationResult;
  musicWarning: string | null;
  liturgies: QuickLiturgy[];
  onUpdateMetadata: (partial: Partial<QuickMetadata>) => void;
  onChangeLiturgy: () => void;
  onRegenerateCover: (theme?: string) => void;
  onUploadCover: (blob: Blob) => void;
  onPublish: () => void;
}

export function QuickStepReview(props: QuickStepReviewProps) {
  const {
    metadata,
    processing,
    processedMp3,
    durationSeconds,
    cover,
    publish,
    validation,
    musicWarning,
    liturgies,
    onUpdateMetadata,
    onChangeLiturgy,
    onRegenerateCover,
    onUploadCover,
    onPublish,
  } = props;

  // Object URL lifecycle lives in an effect (not useMemo): effects only run
  // for committed renders, and the cleanup revokes exactly the URL it created.
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!processedMp3) {
      setAudioUrl(null);
      return;
    }
    const url = URL.createObjectURL(processedMp3);
    setAudioUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [processedMp3]);

  const linkedLiturgy = useMemo(() => {
    if (!metadata.liturgyId) return null;
    return liturgies.find((l) => l.id === metadata.liturgyId) ?? null;
  }, [metadata.liturgyId, liturgies]);

  const dateString = format(metadata.date, 'yyyy-MM-dd');
  const audioSizeMb = processedMp3
    ? (processedMp3.size / (1024 * 1024)).toFixed(1)
    : null;

  const isProcessingError = processing.status === 'error';
  const canPublish =
    validation.isValid &&
    cover.status === 'done' &&
    processing.status === 'done' &&
    !isProcessingError;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Revisa y publica</h2>
            {linkedLiturgy ? (
              <Badge variant="outline" className="gap-1">
                <Link2 className="h-3 w-3" />
                Vinculada: {linkedLiturgy.titulo}
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <Link2Off className="h-3 w-3" />
                Sin liturgia
              </Badge>
            )}
          </div>

          <button
            type="button"
            onClick={onChangeLiturgy}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline inline-flex items-center gap-1"
          >
            <Pencil className="h-3 w-3" />
            Cambiar vínculo de liturgia
          </button>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="quick-review-title">Título</Label>
                <Input
                  id="quick-review-title"
                  value={metadata.title}
                  maxLength={TITLE_MAX}
                  onChange={(e) =>
                    onUpdateMetadata({ title: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground text-right">
                  {metadata.title.length}/{TITLE_MAX}
                </p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="quick-review-speaker">Predicador</Label>
                <Input
                  id="quick-review-speaker"
                  value={metadata.speaker}
                  onChange={(e) =>
                    onUpdateMetadata({ speaker: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="quick-review-date">Fecha del episodio</Label>
                <Input
                  id="quick-review-date"
                  type="date"
                  value={dateString}
                  onChange={(e) =>
                    onUpdateMetadata({
                      date: new Date(e.target.value + 'T00:00:00'),
                    })
                  }
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="quick-review-description">Descripción</Label>
                <Textarea
                  id="quick-review-description"
                  value={metadata.description}
                  maxLength={DESCRIPTION_MAX}
                  rows={4}
                  onChange={(e) =>
                    onUpdateMetadata({ description: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground text-right">
                  {metadata.description.length}/{DESCRIPTION_MAX}
                </p>
              </div>

              {processedMp3 && audioUrl && (
                <div className="space-y-1 pt-2">
                  <Label>Vista previa</Label>
                  <audio controls src={audioUrl} className="w-full" />
                  <p className="text-xs text-muted-foreground">
                    {formatDurationLong(durationSeconds)} ·{' '}
                    {audioSizeMb ? `${audioSizeMb} MB` : formatFileSize(processedMp3.size)}
                  </p>
                </div>
              )}

              {isProcessingError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {processing.error ?? 'Falló el procesamiento del audio.'}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <div className="space-y-4">
              <QuickCoverCard
                cover={cover}
                onRegenerate={onRegenerateCover}
                onUpload={onUploadCover}
              />
              {musicWarning && (
                <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {musicWarning}
                </p>
              )}
            </div>
          </div>

          <ValidationPanel validation={validation} />

          {publish.error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{publish.error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end">
            <Button
              onClick={onPublish}
              disabled={!canPublish}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {publish.episodeId
                ? 'Reintentar publicación (no se volverá a procesar el audio)'
                : 'Publicar en Spotify'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ValidationPanel({ validation }: { validation: ValidationResult }) {
  if (validation.isValid && validation.warnings.length === 0) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-amber-600" />
        Listo para publicar.
      </div>
    );
  }
  return (
    <div className="space-y-1 rounded-md border p-3 text-sm">
      {validation.errors.map((e, i) => (
        <div
          key={`err-${i}`}
          className="flex items-start gap-2 text-red-600"
        >
          <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{e}</span>
        </div>
      ))}
      {validation.warnings.map((w, i) => (
        <div
          key={`warn-${i}`}
          className="flex items-start gap-2 text-amber-700"
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{w}</span>
        </div>
      ))}
    </div>
  );
}
