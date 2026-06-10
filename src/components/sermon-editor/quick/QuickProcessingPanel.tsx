/**
 * QuickProcessingPanel — shown during step 3 while the audio is being
 * mixed/encoded and the cover is being generated in parallel.
 */
import React from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { CoverState, ProcessingState } from '@/hooks/useQuickPublish';

interface QuickProcessingPanelProps {
  processing: ProcessingState;
  cover: CoverState;
  musicWarning: string | null;
}

export function QuickProcessingPanel({
  processing,
  cover,
  musicWarning,
}: QuickProcessingPanelProps) {
  return (
    <Card>
      <CardContent className="space-y-6 p-6">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Preparando tu reflexión…</h2>
          <p className="text-sm text-muted-foreground">
            Estamos mejorando la voz, añadiendo intro/cierre y generando la portada en paralelo.
          </p>
        </div>

        <section className="space-y-2" aria-live="polite">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Audio</span>
            <span className="text-muted-foreground">
              {Math.round(processing.progress)}%
            </span>
          </div>
          <Progress value={processing.progress} />
          <p className="text-xs text-muted-foreground">
            {processing.status === 'error'
              ? processing.error ?? 'Falló el procesamiento'
              : processing.label || 'Iniciando…'}
          </p>
        </section>

        <section className="space-y-2" aria-live="polite">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span>Portada</span>
            {cover.status === 'generating' && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {cover.status === 'generating' && 'Generando portada…'}
            {cover.status === 'done' && 'Portada lista.'}
            {cover.status === 'error' &&
              (cover.error ?? 'No se pudo generar la portada.')}
            {cover.status === 'idle' && 'En espera.'}
          </p>
        </section>

        {musicWarning && (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {musicWarning}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
