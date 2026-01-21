/**
 * Waveform visualization component using wavesurfer.js
 * Includes silence region visualization and interaction
 * Updated for PROMPT_004: Added intro/outro music visualization
 */
import React, { useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin, { Region } from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDurationLong } from '@/lib/sermon-editor/audioProcessor';
import { SilenceRegion } from '@/lib/sermon-editor/silenceDetector';

interface MusicTrackInfo {
  name: string;
  duration_seconds: number | null;
}

interface WaveformDisplayProps {
  onInit: (container: HTMLElement) => void;
  onDestroy: () => void;
  currentTime: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  isReady: boolean;
  isLoading?: boolean; // Show loading state while waveform renders
  wavesurfer: WaveSurfer | null;
  silences?: SilenceRegion[];
  onSilenceClick?: (silence: SilenceRegion) => void;
  regionsPlugin?: RegionsPlugin | null;
  // Music track props (PROMPT_004)
  introTrack?: MusicTrackInfo | null;
  outroTrack?: MusicTrackInfo | null;
  includeIntro?: boolean;
  includeOutro?: boolean;
}

// Default pixels per second for WaveSurfer zoom
const DEFAULT_ZOOM = 50;
const MIN_ZOOM = 10;
const MAX_ZOOM = 500;

export function WaveformDisplay({
  onInit,
  onDestroy,
  currentTime,
  duration,
  trimStart,
  trimEnd,
  isReady,
  isLoading = false,
  wavesurfer,
  silences = [],
  onSilenceClick,
  regionsPlugin,
  introTrack,
  outroTrack,
  includeIntro = false,
  includeOutro = false,
}: WaveformDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = React.useState(DEFAULT_ZOOM);

  // Initialize WaveSurfer when container is ready
  useEffect(() => {
    if (containerRef.current) {
      onInit(containerRef.current);
    }

    return () => {
      onDestroy();
    };
  }, [onInit, onDestroy]);

  // Update silence regions when silences change
  useEffect(() => {
    if (!regionsPlugin || !isReady) return;

    // Clear existing silence regions
    regionsPlugin.getRegions().forEach((region: Region) => {
      if (region.id?.startsWith('silence-')) {
        region.remove();
      }
    });

    // Add silence regions
    silences.forEach((silence) => {
      regionsPlugin.addRegion({
        id: silence.id,
        start: silence.start,
        end: silence.end,
        color: silence.markedForRemoval
          ? 'rgba(239, 68, 68, 0.4)'  // Red for marked
          : 'rgba(251, 191, 36, 0.3)', // Amber for unreviewed
        drag: false,
        resize: false,
      });
    });
  }, [regionsPlugin, silences, isReady]);

  // Calculate trim region overlay positions
  const leftOverlayWidth = duration > 0 ? (trimStart / duration) * 100 : 0;
  const rightOverlayWidth = duration > 0 ? ((duration - trimEnd) / duration) * 100 : 0;

  const handleZoomIn = () => {
    const newZoom = Math.min(zoomLevel * 1.5, MAX_ZOOM);
    setZoomLevel(newZoom);
    wavesurfer?.zoom(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoomLevel / 1.5, MIN_ZOOM);
    setZoomLevel(newZoom);
    wavesurfer?.zoom(newZoom);
  };

  // Format zoom level for display
  const getZoomLabel = () => {
    if (zoomLevel <= MIN_ZOOM) return 'Mín';
    if (zoomLevel >= MAX_ZOOM) return 'Máx';
    return `${Math.round(zoomLevel)}px/s`;
  };

  // Calculate intro/outro durations for timeline display
  // PROMPT_004b Fix 3: Subtract crossfade durations for accurate display
  const CROSSFADE_DURATION = 0.5; // Must match audioProcessor.ts
  const introDuration = includeIntro && introTrack?.duration_seconds ? introTrack.duration_seconds : 0;
  const outroDuration = includeOutro && outroTrack?.duration_seconds ? outroTrack.duration_seconds : 0;
  const sermonDuration = trimEnd - trimStart;

  // Calculate crossfade overlaps (same formula as in audioProcessor.ts)
  const introOverlap = introDuration > 0 ? Math.min(CROSSFADE_DURATION, introDuration / 2, sermonDuration / 2) : 0;
  const outroOverlap = outroDuration > 0 ? Math.min(CROSSFADE_DURATION, outroDuration / 2, sermonDuration / 2) : 0;
  const totalDuration = introDuration + sermonDuration + outroDuration - introOverlap - outroOverlap;

  return (
    <div className="space-y-2">
      {/* Time display */}
      <div className="flex justify-between items-center text-sm">
        <span className="font-mono text-muted-foreground">
          {formatDurationLong(currentTime)}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={handleZoomOut}
            disabled={zoomLevel <= MIN_ZOOM || !isReady}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-16 text-center">
            {getZoomLabel()}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={handleZoomIn}
            disabled={zoomLevel >= MAX_ZOOM || !isReady}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
        <span className="font-mono text-muted-foreground">
          {formatDurationLong(duration)}
        </span>
      </div>

      {/* Timeline with intro/outro indicators (PROMPT_004) */}
      {isReady && (includeIntro || includeOutro) && (
        <div className="flex items-center h-6 text-xs rounded overflow-hidden border">
          {/* Intro section */}
          {includeIntro && introDuration > 0 && (
            <div
              className="flex items-center justify-center bg-amber-100 border-r border-amber-300 text-amber-700 font-medium px-2"
              style={{ flexShrink: 0 }}
            >
              INTRO {introDuration.toFixed(1)}s
            </div>
          )}

          {/* Sermon section */}
          <div className="flex-1 flex items-center justify-center bg-amber-50 text-amber-700 font-medium px-2 truncate">
            REFLEXIÓN {formatDurationLong(sermonDuration)}
          </div>

          {/* Outro section */}
          {includeOutro && outroDuration > 0 && (
            <div
              className="flex items-center justify-center bg-stone-100 border-l border-stone-300 text-stone-700 font-medium px-2"
              style={{ flexShrink: 0 }}
            >
              OUTRO {outroDuration.toFixed(1)}s
            </div>
          )}
        </div>
      )}

      {/* Waveform container with trim overlays */}
      <div className="relative rounded-lg overflow-hidden bg-muted/30">
        {/* WaveSurfer container - no CSS transform, using native zoom */}
        <div
          ref={containerRef}
          className="w-full min-h-[128px] overflow-x-auto"
        />

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
              <span className="text-sm text-muted-foreground">Generando Visualización de Audio...</span>
            </div>
          </div>
        )}

        {/* Left trim overlay (trimmed region) */}
        {isReady && leftOverlayWidth > 0 && (
          <div
            className="absolute top-0 left-0 h-full bg-black/40 pointer-events-none"
            style={{ width: `${leftOverlayWidth}%` }}
          />
        )}

        {/* Right trim overlay (trimmed region) */}
        {isReady && rightOverlayWidth > 0 && (
          <div
            className="absolute top-0 right-0 h-full bg-black/40 pointer-events-none"
            style={{ width: `${rightOverlayWidth}%` }}
          />
        )}

        {/* Trim start marker */}
        {isReady && trimStart > 0 && (
          <div
            className="absolute top-0 h-full w-0.5 bg-amber-500 pointer-events-none z-10"
            style={{ left: `${leftOverlayWidth}%` }}
          >
            <div className="absolute -top-1 -translate-x-1/2 w-3 h-3 bg-amber-500 rounded-full" />
          </div>
        )}

        {/* Trim end marker */}
        {isReady && trimEnd < duration && (
          <div
            className="absolute top-0 h-full w-0.5 bg-casa-600 pointer-events-none z-10"
            style={{ left: `${100 - rightOverlayWidth}%` }}
          >
            <div className="absolute -top-1 -translate-x-1/2 w-3 h-3 bg-casa-600 rounded-full" />
          </div>
        )}
      </div>

      {/* Trim info with total duration including intro/outro */}
      {isReady && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            Inicio: <span className="text-amber-600 font-mono">{formatDurationLong(trimStart)}</span>
          </span>
          <span>
            {(includeIntro || includeOutro) ? (
              <>
                Total:{' '}
                <span className="text-foreground font-medium font-mono">
                  {formatDurationLong(totalDuration)}
                </span>
              </>
            ) : (
              <>
                Duración:{' '}
                <span className="text-foreground font-medium font-mono">
                  {formatDurationLong(sermonDuration)}
                </span>
              </>
            )}
          </span>
          <span>
            Fin: <span className="text-casa-600 font-mono">{formatDurationLong(trimEnd)}</span>
          </span>
        </div>
      )}
    </div>
  );
}
