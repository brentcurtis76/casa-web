/**
 * Panel displaying detected silences for manual review and removal
 * Users MUST manually decide which silences to remove
 */
import React, { useCallback } from 'react';
import { Play, Trash2, RotateCcw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SilenceRegion, countMarkedSilences, calculateRemovedDuration } from '@/lib/sermon-editor/silenceDetector';
import { formatDurationLong } from '@/lib/sermon-editor/audioProcessor';

interface SilenceListPanelProps {
  silences: SilenceRegion[];
  onPreview: (silence: SilenceRegion) => void;
  onToggleRemoval: (silenceId: string) => void;
  onDetect: () => void;
  isDetecting: boolean;
  disabled: boolean;
}

export function SilenceListPanel({
  silences,
  onPreview,
  onToggleRemoval,
  onDetect,
  isDetecting,
  disabled,
}: SilenceListPanelProps) {
  const markedCount = countMarkedSilences(silences);
  const removedDuration = calculateRemovedDuration(silences);

  // Memoize callbacks to prevent SilenceRow re-renders
  const handlePreview = useCallback((id: string) => {
    const silence = silences.find(s => s.id === id);
    if (silence) onPreview(silence);
  }, [silences, onPreview]);

  const handleToggleRemoval = useCallback((id: string) => {
    onToggleRemoval(id);
  }, [onToggleRemoval]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            Silencios Detectados
            {silences.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {silences.length}
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={onDetect}
            disabled={disabled || isDetecting}
          >
            {isDetecting ? 'Detectando...' : 'Detectar silencios'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Warning message */}
        {silences.length > 0 && (
          <div className="flex items-start gap-2 p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
            <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Escucha cada silencio antes de eliminarlo. Algunos pueden contener
              pausas intencionales o habla suave.
            </p>
          </div>
        )}

        {/* Silence list */}
        {silences.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {isDetecting ? (
              <p>Analizando audio...</p>
            ) : (
              <p>No se han detectado silencios. Haz clic en "Detectar silencios" para analizar el audio.</p>
            )}
          </div>
        ) : (
          <ScrollArea className="h-[200px] pr-4">
            <div className="space-y-2">
              {silences.map((silence, index) => (
                <SilenceRow
                  key={silence.id}
                  silence={silence}
                  index={index + 1}
                  onPreview={handlePreview}
                  onToggleRemoval={handleToggleRemoval}
                />
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Summary */}
        {silences.length > 0 && (
          <div className="flex items-center justify-between pt-3 border-t text-sm">
            <span className="text-muted-foreground">
              {markedCount} de {silences.length} silencios marcados para eliminar
            </span>
            {markedCount > 0 && (
              <span className="font-medium text-amber-600">
                -{formatDurationLong(removedDuration)}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface SilenceRowProps {
  silence: SilenceRegion;
  index: number;
  onPreview: (id: string) => void;
  onToggleRemoval: (id: string) => void;
}

// Memoized row component to prevent unnecessary re-renders
const SilenceRow = React.memo(function SilenceRow({
  silence,
  index,
  onPreview,
  onToggleRemoval,
}: SilenceRowProps) {
  const handlePreview = useCallback(() => {
    onPreview(silence.id);
  }, [onPreview, silence.id]);

  const handleToggle = useCallback(() => {
    onToggleRemoval(silence.id);
  }, [onToggleRemoval, silence.id]);

  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
        silence.markedForRemoval
          ? 'bg-red-500/10 border-red-500/30'
          : 'bg-muted/30 border-transparent hover:border-border'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground w-6">
          #{index}
        </span>
        <div className="text-sm">
          <span className="font-mono">{formatDurationLong(silence.start)}</span>
          <span className="text-muted-foreground mx-1">-</span>
          <span className="font-mono">{formatDurationLong(silence.end)}</span>
          <span className="text-muted-foreground ml-2">
            ({silence.duration.toFixed(1)}s)
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePreview}
          className="h-8 px-2"
        >
          <Play className="h-4 w-4 mr-1" />
          Escuchar
        </Button>

        <Button
          variant={silence.markedForRemoval ? 'secondary' : 'destructive'}
          size="sm"
          onClick={handleToggle}
          className="h-8 px-2"
        >
          {silence.markedForRemoval ? (
            <>
              <RotateCcw className="h-4 w-4 mr-1" />
              Mantener
            </>
          ) : (
            <>
              <Trash2 className="h-4 w-4 mr-1" />
              Eliminar
            </>
          )}
        </Button>
      </div>
    </div>
  );
});
