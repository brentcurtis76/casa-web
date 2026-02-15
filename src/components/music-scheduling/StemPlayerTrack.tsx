/**
 * StemPlayerTrack — Single track row component for the Stem Player.
 *
 * Layout: [Label] [Mute] [Solo] [Volume Slider] [Waveform]
 */

import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { VolumeX, Volume2 } from 'lucide-react';
import { CASA_BRAND } from '@/lib/brand-kit';
import { STEM_TYPE_LABELS } from '@/lib/music-planning/practiceLabels';
import type { StemTrack } from '@/hooks/useStemPlayer';
import type { StemType } from '@/types/musicPlanning';

interface StemPlayerTrackProps {
  track: StemTrack;
  onVolumeChange: (stemType: StemType, volume: number) => void;
  onToggleMute: (stemType: StemType) => void;
  onToggleSolo: (stemType: StemType) => void;
  // Callback to register the waveform container
  onContainerReady: (stemType: StemType, container: HTMLDivElement | null) => void;
}

const StemPlayerTrack = ({
  track,
  onVolumeChange,
  onToggleMute,
  onToggleSolo,
  onContainerReady,
}: StemPlayerTrackProps) => {
  const containerRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) {
        onContainerReady(track.stemType, node);
      }
    },
    [track.stemType, onContainerReady]
  );

  const handleVolumeChange = (values: number[]) => {
    onVolumeChange(track.stemType, values[0]);
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 border border-gray-200 rounded-lg bg-white">
      {/* Controls row (always horizontal) */}
      <div className="flex items-center gap-3 w-full sm:w-auto">
        {/* Stem Label */}
        <div className="w-24 flex-shrink-0">
          <Badge variant="outline" className="text-xs font-medium">
            {STEM_TYPE_LABELS[track.stemType]}
          </Badge>
        </div>

        {/* Mute Button */}
        <Button
          variant={track.isMuted ? 'default' : 'outline'}
          size="icon"
          onClick={() => onToggleMute(track.stemType)}
          aria-label={track.isMuted ? 'Activar' : 'Silenciar'}
          className="flex-shrink-0"
          style={
            track.isMuted
              ? { backgroundColor: CASA_BRAND.colors.primary.amber, color: CASA_BRAND.colors.primary.black }
              : undefined
          }
        >
          {track.isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>

        {/* Solo Button */}
        <Button
          variant={track.isSoloed ? 'default' : 'outline'}
          size="sm"
          onClick={() => onToggleSolo(track.stemType)}
          aria-label={track.isSoloed ? 'Desactivar solo' : 'Solo'}
          className="flex-shrink-0 w-10 h-10 font-bold"
          style={
            track.isSoloed
              ? { backgroundColor: CASA_BRAND.colors.primary.amber, color: CASA_BRAND.colors.primary.black }
              : undefined
          }
        >
          S
        </Button>

        {/* Volume Slider */}
        <div className="w-24 flex-shrink-0">
          <Slider
            value={[track.volume]}
            onValueChange={handleVolumeChange}
            min={0}
            max={100}
            step={1}
            aria-label="Volumen"
            className="cursor-pointer"
          />
        </div>
      </div>

      {/* Waveform Container (full width on mobile) */}
      <div className="flex-1 min-w-0 h-12 w-full sm:w-auto relative">
        {!track.isLoaded && !track.isError && (
          <Skeleton className="w-full h-full" />
        )}
        {track.isError && (
          <div className="flex items-center justify-center h-full">
            <Badge variant="destructive" className="text-xs">
              Error al cargar
            </Badge>
          </div>
        )}
        <div
          ref={containerRef}
          className={`w-full h-full ${track.isMuted ? 'opacity-40' : 'opacity-100'}`}
          aria-label={`Forma de onda de ${STEM_TYPE_LABELS[track.stemType]}`}
        />
      </div>
    </div>
  );
};

export default StemPlayerTrack;
