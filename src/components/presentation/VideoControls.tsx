/**
 * VideoControls - Controles de reproducción de video para el presenter
 * Incluye play/pause, barra de progreso, volumen y tiempo
 */

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { CASA_BRAND } from '@/lib/brand-kit';
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward } from 'lucide-react';
import { formatDuration } from '@/lib/presentation/videoService';
import type { VideoPlaybackState } from './VideoSlideRenderer';

interface VideoControlsProps {
  playbackState: VideoPlaybackState;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onMuteToggle: () => void;
  onVolumeChange: (volume: number) => void;
  disabled?: boolean;
}

export const VideoControls: React.FC<VideoControlsProps> = ({
  playbackState,
  onPlay,
  onPause,
  onSeek,
  onMuteToggle,
  onVolumeChange,
  disabled = false,
}) => {
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const volumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { isPlaying, currentTime, duration, muted, volume } = playbackState;

  // Sync seekValue with currentTime when not seeking
  useEffect(() => {
    if (!isSeeking) {
      setSeekValue(currentTime);
    }
  }, [currentTime, isSeeking]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      onPause();
    } else {
      onPlay();
    }
  }, [isPlaying, onPlay, onPause]);

  const handleSeekStart = useCallback(() => {
    setIsSeeking(true);
  }, []);

  const handleSeekChange = useCallback((value: number[]) => {
    setSeekValue(value[0]);
  }, []);

  const handleSeekEnd = useCallback((value: number[]) => {
    setIsSeeking(false);
    onSeek(value[0]);
  }, [onSeek]);

  const handleSkipBack = useCallback(() => {
    const newTime = Math.max(0, currentTime - 10);
    onSeek(newTime);
  }, [currentTime, onSeek]);

  const handleSkipForward = useCallback(() => {
    const newTime = Math.min(duration, currentTime + 10);
    onSeek(newTime);
  }, [currentTime, duration, onSeek]);

  const handleVolumeChange = useCallback((value: number[]) => {
    onVolumeChange(value[0]);
  }, [onVolumeChange]);

  const handleVolumeHover = useCallback((show: boolean) => {
    if (volumeTimeoutRef.current) {
      clearTimeout(volumeTimeoutRef.current);
    }

    if (show) {
      setShowVolumeSlider(true);
    } else {
      volumeTimeoutRef.current = setTimeout(() => {
        setShowVolumeSlider(false);
      }, 300);
    }
  }, []);

  const progress = duration > 0 ? (seekValue / duration) * 100 : 0;

  return (
    <div
      className="flex flex-col gap-2 p-3 rounded-lg"
      style={{
        backgroundColor: CASA_BRAND.colors.secondary.carbon,
        border: `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
      }}
    >
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        {/* Current time */}
        <span
          className="text-xs w-12 text-right tabular-nums"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            color: CASA_BRAND.colors.secondary.grayLight,
          }}
        >
          {formatDuration(seekValue)}
        </span>

        {/* Seek slider */}
        <div className="flex-1 relative">
          <Slider
            value={[seekValue]}
            max={duration || 100}
            step={0.1}
            disabled={disabled || duration === 0}
            onValueChange={handleSeekChange}
            onValueCommit={handleSeekEnd}
            onPointerDown={handleSeekStart}
            className="w-full"
          />
          {/* Progress indicator */}
          <div
            className="absolute top-1/2 left-0 h-1 rounded-full pointer-events-none"
            style={{
              width: `${progress}%`,
              backgroundColor: CASA_BRAND.colors.primary.amber,
              transform: 'translateY(-50%)',
            }}
          />
        </div>

        {/* Duration */}
        <span
          className="text-xs w-12 tabular-nums"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            color: CASA_BRAND.colors.secondary.grayMedium,
          }}
        >
          {formatDuration(duration)}
        </span>
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between">
        {/* Playback controls */}
        <div className="flex items-center gap-1">
          {/* Skip back 10s */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkipBack}
            disabled={disabled}
            className="h-8 w-8 p-0"
            title="Retroceder 10s"
          >
            <SkipBack size={16} style={{ color: CASA_BRAND.colors.secondary.grayLight }} />
          </Button>

          {/* Play/Pause */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePlayPause}
            disabled={disabled}
            className="h-10 w-10 p-0 rounded-full"
            style={{
              backgroundColor: CASA_BRAND.colors.primary.amber + '20',
            }}
            title={isPlaying ? 'Pausar' : 'Reproducir'}
          >
            {isPlaying ? (
              <Pause size={20} style={{ color: CASA_BRAND.colors.primary.amber }} />
            ) : (
              <Play size={20} style={{ color: CASA_BRAND.colors.primary.amber }} />
            )}
          </Button>

          {/* Skip forward 10s */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkipForward}
            disabled={disabled}
            className="h-8 w-8 p-0"
            title="Avanzar 10s"
          >
            <SkipForward size={16} style={{ color: CASA_BRAND.colors.secondary.grayLight }} />
          </Button>
        </div>

        {/* Volume control - horizontal slider next to mute button */}
        <div
          className="flex items-center gap-2"
          onMouseEnter={() => handleVolumeHover(true)}
          onMouseLeave={() => handleVolumeHover(false)}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={onMuteToggle}
            disabled={disabled}
            className="h-8 w-8 p-0"
            title={muted ? 'Activar sonido' : 'Silenciar'}
          >
            {muted ? (
              <VolumeX size={18} style={{ color: CASA_BRAND.colors.secondary.grayMedium }} />
            ) : (
              <Volume2 size={18} style={{ color: CASA_BRAND.colors.secondary.grayLight }} />
            )}
          </Button>

          {/* Horizontal volume slider - always visible on hover */}
          <div
            className="transition-all duration-200 overflow-hidden"
            style={{
              width: showVolumeSlider ? '80px' : '0px',
              opacity: showVolumeSlider ? 1 : 0,
            }}
          >
            <Slider
              value={[muted ? 0 : volume]}
              max={1}
              step={0.01}
              disabled={disabled}
              onValueChange={handleVolumeChange}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Status indicator */}
      <div className="flex items-center justify-center gap-2">
        <div
          className="w-2 h-2 rounded-full"
          style={{
            backgroundColor: isPlaying
              ? '#22c55e'
              : CASA_BRAND.colors.secondary.grayDark,
          }}
        />
        <span
          className="text-xs"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            color: CASA_BRAND.colors.secondary.grayMedium,
          }}
        >
          {isPlaying ? 'Reproduciendo' : 'Pausado'}
        </span>
      </div>
    </div>
  );
};

export default VideoControls;
