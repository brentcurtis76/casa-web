/**
 * StemPlayerTransport — Playback transport bar for the Stem Player.
 *
 * Layout: [Play/Pause] [Stop] [Time] [Seek Slider] [Loop Toggle] [Tempo Controls]
 */

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, Square, Repeat, Plus, Minus } from 'lucide-react';
import { CASA_BRAND } from '@/lib/brand-kit';

interface StemPlayerTransportProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  loopActive: boolean;
  tempoFactor: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (values: number[]) => void;
  onToggleLoop: () => void;
  onTempoChange: (delta: number) => void;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const StemPlayerTransport = ({
  isPlaying,
  currentTime,
  duration,
  loopActive,
  tempoFactor,
  onPlay,
  onPause,
  onStop,
  onSeek,
  onToggleLoop,
  onTempoChange,
}: StemPlayerTransportProps) => {
  return (
    <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 shadow-lg">
      <div className="flex flex-wrap items-center gap-4">
        {/* Playback Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="icon"
            onClick={isPlaying ? onPause : onPlay}
            aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
            style={{
              backgroundColor: CASA_BRAND.colors.primary.amber,
              color: CASA_BRAND.colors.primary.black,
            }}
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onStop}
            aria-label="Detener"
          >
            <Square className="h-5 w-5" />
          </Button>
        </div>

        {/* Time Display */}
        <div className="flex items-center gap-1 text-sm font-mono text-gray-700 min-w-[100px]" aria-live="off">
          <span>{formatTime(currentTime)}</span>
          <span>/</span>
          <span>{formatTime(duration)}</span>
        </div>

        {/* Seek Slider */}
        <div className="flex-1 min-w-[200px]">
          <Slider
            value={[currentTime]}
            onValueChange={onSeek}
            min={0}
            max={duration || 1}
            step={0.1}
            aria-label="Posición de reproducción"
            className="cursor-pointer"
          />
        </div>

        {/* Loop Toggle */}
        <Button
          variant={loopActive ? 'default' : 'outline'}
          size="icon"
          onClick={onToggleLoop}
          aria-label={loopActive ? 'Desactivar loop' : 'Activar loop'}
          style={
            loopActive
              ? {
                  backgroundColor: CASA_BRAND.colors.primary.amber,
                  color: CASA_BRAND.colors.primary.black,
                }
              : undefined
          }
        >
          <Repeat className="h-5 w-5" />
        </Button>

        {/* Tempo Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => onTempoChange(-0.05)}
            aria-label="Disminuir tempo"
            disabled={tempoFactor <= 0.5}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Badge variant="outline" className="min-w-[60px] text-center font-mono">
            {tempoFactor.toFixed(2)}x
          </Badge>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onTempoChange(0.05)}
            aria-label="Aumentar tempo"
            disabled={tempoFactor >= 2.0}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StemPlayerTransport;
