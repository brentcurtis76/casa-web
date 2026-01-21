/**
 * Playback controls component
 */
import React from 'react';
import { Play, Pause, Square, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDurationLong } from '@/lib/sermon-editor/audioProcessor';

interface PlaybackControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onVolumeChange: (volume: number) => void;
  onPlaybackRateChange: (rate: number) => void;
  disabled?: boolean;
}

const PLAYBACK_RATES = [
  { value: '0.5', label: '0.5x' },
  { value: '0.75', label: '0.75x' },
  { value: '1', label: '1x' },
  { value: '1.25', label: '1.25x' },
  { value: '1.5', label: '1.5x' },
  { value: '2', label: '2x' },
];

export function PlaybackControls({
  isPlaying,
  currentTime,
  duration,
  volume,
  playbackRate,
  onPlay,
  onPause,
  onStop,
  onVolumeChange,
  onPlaybackRateChange,
  disabled = false,
}: PlaybackControlsProps) {
  const [isMuted, setIsMuted] = React.useState(false);
  const [prevVolume, setPrevVolume] = React.useState(volume);

  const handleMuteToggle = () => {
    if (isMuted) {
      onVolumeChange(prevVolume);
      setIsMuted(false);
    } else {
      setPrevVolume(volume);
      onVolumeChange(0);
      setIsMuted(true);
    }
  };

  const handleVolumeChange = (values: number[]) => {
    const newVolume = values[0];
    onVolumeChange(newVolume);
    if (newVolume > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-muted/30 rounded-lg">
      {/* Main controls */}
      <div className="flex items-center gap-2">
        {/* Play/Pause button */}
        <Button
          variant="default"
          size="icon"
          className="h-12 w-12 rounded-full bg-amber-600 hover:bg-amber-700"
          onClick={isPlaying ? onPause : onPlay}
          disabled={disabled}
        >
          {isPlaying ? (
            <Pause className="h-6 w-6" />
          ) : (
            <Play className="h-6 w-6 ml-0.5" />
          )}
        </Button>

        {/* Stop button */}
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10"
          onClick={onStop}
          disabled={disabled}
        >
          <Square className="h-4 w-4" />
        </Button>
      </div>

      {/* Time display */}
      <div className="flex items-center gap-2 font-mono text-sm">
        <span className="min-w-[60px] text-right">{formatDurationLong(currentTime)}</span>
        <span className="text-muted-foreground">/</span>
        <span className="min-w-[60px] text-muted-foreground">{formatDurationLong(duration)}</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Volume control */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleMuteToggle}
          disabled={disabled}
        >
          {isMuted || volume === 0 ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </Button>
        <Slider
          value={[isMuted ? 0 : volume]}
          min={0}
          max={1}
          step={0.01}
          onValueChange={handleVolumeChange}
          disabled={disabled}
          className="w-24"
        />
      </div>

      {/* Playback rate */}
      <Select
        value={playbackRate.toString()}
        onValueChange={(value) => onPlaybackRateChange(parseFloat(value))}
        disabled={disabled}
      >
        <SelectTrigger className="w-20 h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PLAYBACK_RATES.map((rate) => (
            <SelectItem key={rate.value} value={rate.value}>
              {rate.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
