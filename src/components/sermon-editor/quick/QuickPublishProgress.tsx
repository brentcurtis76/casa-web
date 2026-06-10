/**
 * QuickPublishProgress — checklist + success screen for the publish step.
 */
import React from 'react';
import { CheckCircle2, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PODCAST_FEED_URL } from '@/lib/sermon-editor/publishService';
import type { PublishStage } from '@/lib/sermon-editor/publishService';

interface QuickPublishProgressProps {
  stage?: PublishStage;
  feedUrl: string | null;
  done: boolean;
  onPublishAnother: () => void;
}

const STEPS: Array<{
  stage: PublishStage;
  label: string;
}> = [
  { stage: 'saving-draft', label: 'Preparando archivo…' },
  { stage: 'uploading-audio', label: 'Subiendo audio…' },
  { stage: 'uploading-cover', label: 'Subiendo portada…' },
  { stage: 'publishing', label: 'Registrando episodio…' },
];

function stageIndex(stage: PublishStage | undefined): number {
  if (!stage) return -1;
  return STEPS.findIndex((s) => s.stage === stage);
}

export function QuickPublishProgress({
  stage,
  feedUrl,
  done,
  onPublishAnother,
}: QuickPublishProgressProps) {
  if (done) {
    return (
      <Card>
        <CardContent className="space-y-4 p-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-amber-600 mx-auto" />
          <h2 className="text-xl font-semibold">¡Reflexión publicada!</h2>
          <p className="text-sm text-muted-foreground">
            El episodio ya está en el feed del podcast. Spotify lo detectará
            automáticamente; puede tardar desde unos minutos hasta unas horas
            en aparecer.
          </p>
          <div className="flex flex-wrap gap-2 justify-center pt-2">
            <Button asChild variant="outline">
              <a
                href={feedUrl ?? PODCAST_FEED_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Ver feed RSS
              </a>
            </Button>
            <Button
              onClick={onPublishAnother}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Publicar otra reflexión
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const current = stageIndex(stage);

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <h2 className="text-lg font-semibold">Publicando episodio…</h2>
        <ul className="space-y-2">
          {STEPS.map((s, i) => {
            const isCurrent = i === current;
            const isDone = i < current;
            return (
              <li
                key={s.stage}
                className="flex items-center gap-2 text-sm"
                aria-current={isCurrent ? 'step' : undefined}
              >
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4 text-amber-600" />
                ) : isCurrent ? (
                  <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                ) : (
                  <span className="h-4 w-4 rounded-full border border-muted-foreground/40" />
                )}
                <span
                  className={
                    isDone
                      ? 'text-muted-foreground line-through'
                      : isCurrent
                        ? 'font-medium'
                        : 'text-muted-foreground'
                  }
                >
                  {s.label}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
