/**
 * Segment Manager component for multi-segment audio editing
 * Displays list of segments with controls for reordering, selecting, and managing
 * PROMPT_009: Multi-segment audio support
 */
import React, { useRef } from 'react';
import { ChevronUp, ChevronDown, Trash2, Plus, Music, Scissors, Link2, Play, Square, Pause, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatDurationLong } from '@/lib/sermon-editor/audioProcessor';
import type { AudioSegment, MusicTrack } from '@/hooks/useSermonEditor';

interface SegmentManagerProps {
  segments: AudioSegment[];
  activeSegmentId: string | null;
  onSelectSegment: (segmentId: string) => void;
  onAddSegment: (file: File) => void;
  onRemoveSegment: (segmentId: string) => void;
  onMoveUp: (segmentId: string) => void;
  onMoveDown: (segmentId: string) => void;
  onSetJoinMode: (segmentId: string, mode: 'crossfade' | 'cut') => void;
  disabled?: boolean;
  maxSegments?: number;
  // Intro/outro music props
  introTrack?: MusicTrack | null;
  outroTrack?: MusicTrack | null;
  includeIntro?: boolean;
  includeOutro?: boolean;
  // Composite preview props (PROMPT_009)
  isGeneratingPreview?: boolean;
  hasPreviewBuffer?: boolean;
  isPlayingPreview?: boolean;
  previewCurrentTime?: number;
  previewDuration?: number;
  onGeneratePreview?: () => void;
  onPlayPreview?: () => void;
  onPausePreview?: () => void;
  onStopPreview?: () => void;
  onSeekPreview?: (time: number) => void;
}

export function SegmentManager({
  segments,
  activeSegmentId,
  onSelectSegment,
  onAddSegment,
  onRemoveSegment,
  onMoveUp,
  onMoveDown,
  onSetJoinMode,
  disabled = false,
  maxSegments = 4,
  introTrack,
  outroTrack,
  includeIntro = false,
  includeOutro = false,
  // Composite preview props
  isGeneratingPreview = false,
  hasPreviewBuffer = false,
  isPlayingPreview = false,
  previewCurrentTime = 0,
  previewDuration = 0,
  onGeneratePreview,
  onPlayPreview,
  onPausePreview,
  onStopPreview,
  onSeekPreview,
}: SegmentManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onAddSegment(file);
      // Reset input so the same file can be selected again if needed
      e.target.value = '';
    }
  };

  // Calculate total duration including intro/outro
  const segmentsDuration = segments.reduce((sum, seg) => {
    const segDuration = seg.trimEnd - seg.trimStart;
    return sum + segDuration;
  }, 0);

  const introDuration = includeIntro && introTrack?.duration_seconds ? introTrack.duration_seconds : 0;
  const outroDuration = includeOutro && outroTrack?.duration_seconds ? outroTrack.duration_seconds : 0;
  const totalDuration = segmentsDuration + introDuration + outroDuration;

  // Don't render if no segments
  if (segments.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Music className="h-5 w-5" />
            Segmentos ({segments.length})
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Total: {formatDurationLong(totalDuration)}
            </span>
            {segments.length < maxSegments && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddClick}
                disabled={disabled}
                className="gap-1"
              >
                <Plus className="h-4 w-4" />
                Añadir
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Segments list */}
        <div className="flex flex-wrap gap-3 items-center">
          <TooltipProvider>
            {/* Intro track indicator */}
            {includeIntro && introTrack && (
              <>
                <div className="flex flex-col rounded-lg border border-dashed border-amber-500 bg-amber-50 dark:bg-amber-950/20 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Play className="h-3 w-3 text-amber-600" />
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Intro</span>
                  </div>
                  <div className="text-sm font-mono text-center text-amber-700 dark:text-amber-400">
                    {formatDurationLong(introTrack.duration_seconds || 0)}
                  </div>
                  <div className="text-xs text-amber-600 dark:text-amber-500 truncate max-w-[100px] mt-1">
                    {introTrack.name}
                  </div>
                </div>
                {/* Crossfade indicator between intro and first segment */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-center h-8 w-8 text-amber-600">
                      <Link2 className="h-4 w-4" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Crossfade con intro</TooltipContent>
                </Tooltip>
              </>
            )}

            {segments.map((segment, index) => {
              const isActive = segment.id === activeSegmentId;
              const isFirst = index === 0;
              const isLast = index === segments.length - 1;
              const segmentDuration = segment.trimEnd - segment.trimStart;

              return (
                <React.Fragment key={segment.id}>
                  {/* Segment card */}
                  <div
                    className={cn(
                      'relative flex flex-col rounded-lg border p-3 cursor-pointer transition-all',
                      'hover:border-amber-500 hover:shadow-sm',
                      isActive
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20 ring-2 ring-amber-500/30'
                        : 'border-border bg-card'
                    )}
                    onClick={() => onSelectSegment(segment.id)}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <div className="absolute -top-1 -left-1 w-3 h-3 bg-amber-500 rounded-full" />
                    )}

                    {/* Segment number and filename */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-muted-foreground">
                        #{index + 1}
                      </span>
                      <span className="text-sm font-medium truncate max-w-[120px]">
                        {segment.fileInfo?.name?.replace(/\.[^/.]+$/, '') || `Segmento ${index + 1}`}
                      </span>
                    </div>

                    {/* Duration */}
                    <div className="text-lg font-mono text-center mb-2">
                      {formatDurationLong(segmentDuration)}
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-center gap-1">
                      {/* Move up */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              onMoveUp(segment.id);
                            }}
                            disabled={disabled || isFirst}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Mover arriba</TooltipContent>
                      </Tooltip>

                      {/* Move down */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              onMoveDown(segment.id);
                            }}
                            disabled={disabled || isLast}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Mover abajo</TooltipContent>
                      </Tooltip>

                      {/* Delete */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveSegment(segment.id);
                            }}
                            disabled={disabled}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Eliminar segmento</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  {/* Join mode indicator between segments */}
                  {!isLast && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            'h-8 w-8 rounded-full',
                            segment.joinMode === 'crossfade'
                              ? 'text-amber-600 hover:text-amber-700'
                              : 'text-stone-600 hover:text-stone-700'
                          )}
                          onClick={() =>
                            onSetJoinMode(
                              segment.id,
                              segment.joinMode === 'crossfade' ? 'cut' : 'crossfade'
                            )
                          }
                          disabled={disabled}
                        >
                          {segment.joinMode === 'crossfade' ? (
                            <Link2 className="h-4 w-4" />
                          ) : (
                            <Scissors className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {segment.joinMode === 'crossfade'
                          ? 'Crossfade (mezcla suave) - clic para cambiar a corte directo'
                          : 'Corte directo - clic para cambiar a crossfade'}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </React.Fragment>
              );
            })}

            {/* Outro track indicator */}
            {includeOutro && outroTrack && (
              <>
                {/* Crossfade indicator between last segment and outro */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-center h-8 w-8 text-stone-600">
                      <Link2 className="h-4 w-4" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Crossfade con outro</TooltipContent>
                </Tooltip>
                <div className="flex flex-col rounded-lg border border-dashed border-stone-500 bg-stone-50 dark:bg-stone-950/20 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Square className="h-3 w-3 text-stone-600" />
                    <span className="text-xs font-medium text-stone-700 dark:text-stone-400">Outro</span>
                  </div>
                  <div className="text-sm font-mono text-center text-stone-700 dark:text-stone-400">
                    {formatDurationLong(outroTrack.duration_seconds || 0)}
                  </div>
                  <div className="text-xs text-stone-600 dark:text-stone-500 truncate max-w-[100px] mt-1">
                    {outroTrack.name}
                  </div>
                </div>
              </>
            )}
          </TooltipProvider>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Link2 className="h-3 w-3 text-amber-600" />
            Crossfade
          </span>
          <span className="flex items-center gap-1">
            <Scissors className="h-3 w-3 text-stone-600" />
            Corte directo
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 bg-amber-500 rounded-full" />
            Activo
          </span>
        </div>

        {/* Composite Preview Player (PROMPT_009) */}
        {onGeneratePreview && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Vista Previa Completa</span>
              <Button
                variant="outline"
                size="sm"
                onClick={onGeneratePreview}
                disabled={disabled || isGeneratingPreview || segments.length === 0}
                className="gap-1"
              >
                {isGeneratingPreview ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    {hasPreviewBuffer ? 'Regenerar' : 'Generar'}
                  </>
                )}
              </Button>
            </div>

            {hasPreviewBuffer && (
              <div className="space-y-3">
                {/* Playback controls */}
                <div className="flex items-center gap-2">
                  {isPlayingPreview ? (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
                      onClick={onPausePreview}
                    >
                      <Pause className="h-5 w-5" />
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
                      onClick={onPlayPreview}
                    >
                      <Play className="h-5 w-5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10"
                    onClick={onStopPreview}
                  >
                    <Square className="h-4 w-4" />
                  </Button>

                  {/* Time display */}
                  <div className="flex-1 text-center font-mono text-sm">
                    {formatDurationLong(previewCurrentTime)} / {formatDurationLong(previewDuration)}
                  </div>
                </div>

                {/* Progress slider */}
                <Slider
                  value={[previewCurrentTime]}
                  max={previewDuration}
                  step={0.1}
                  onValueChange={(values) => onSeekPreview?.(values[0])}
                  className="w-full"
                />

                <p className="text-xs text-muted-foreground text-center">
                  Escucha cómo sonará tu reflexión completa con intro, segmentos y outro
                </p>
              </div>
            )}

            {!hasPreviewBuffer && !isGeneratingPreview && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Genera una vista previa para escuchar todos los segmentos juntos
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
