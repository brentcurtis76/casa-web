/**
 * Trim controls for setting start and end points
 * Updated: Added "Aplicar recorte" button to commit trims permanently
 */
import React, { useState, useEffect } from 'react';
import { Scissors, RotateCcw, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { formatDurationLong } from '@/lib/sermon-editor/audioProcessor';

interface TrimControlsProps {
  duration: number;
  trimStart: number;
  trimEnd: number;
  onTrimStartChange: (time: number) => void;
  onTrimEndChange: (time: number) => void;
  onReset: () => void;
  onApplyTrim: () => void;
  isApplying?: boolean;
  disabled?: boolean;
}

// Parse time string (MM:SS or HH:MM:SS) to seconds
function parseTimeString(timeStr: string): number | null {
  const parts = timeStr.split(':').map((p) => parseInt(p, 10));

  if (parts.some(isNaN)) return null;

  if (parts.length === 2) {
    // MM:SS
    const [mins, secs] = parts;
    if (mins < 0 || secs < 0 || secs >= 60) return null;
    return mins * 60 + secs;
  } else if (parts.length === 3) {
    // HH:MM:SS
    const [hours, mins, secs] = parts;
    if (hours < 0 || mins < 0 || mins >= 60 || secs < 0 || secs >= 60) return null;
    return hours * 3600 + mins * 60 + secs;
  }

  return null;
}

export function TrimControls({
  duration,
  trimStart,
  trimEnd,
  onTrimStartChange,
  onTrimEndChange,
  onReset,
  onApplyTrim,
  isApplying = false,
  disabled = false,
}: TrimControlsProps) {
  const [startInput, setStartInput] = useState(formatDurationLong(trimStart));
  const [endInput, setEndInput] = useState(formatDurationLong(trimEnd));

  // Update inputs when trim values change externally
  useEffect(() => {
    setStartInput(formatDurationLong(trimStart));
  }, [trimStart]);

  useEffect(() => {
    setEndInput(formatDurationLong(trimEnd));
  }, [trimEnd]);

  const handleStartInputChange = (value: string) => {
    setStartInput(value);
  };

  const handleEndInputChange = (value: string) => {
    setEndInput(value);
  };

  const handleStartInputBlur = () => {
    const parsed = parseTimeString(startInput);
    if (parsed !== null && parsed >= 0 && parsed < trimEnd) {
      onTrimStartChange(parsed);
    } else {
      // Reset to current value if invalid
      setStartInput(formatDurationLong(trimStart));
    }
  };

  const handleEndInputBlur = () => {
    const parsed = parseTimeString(endInput);
    if (parsed !== null && parsed > trimStart && parsed <= duration) {
      onTrimEndChange(parsed);
    } else {
      // Reset to current value if invalid
      setEndInput(formatDurationLong(trimEnd));
    }
  };

  const handleStartSliderChange = (values: number[]) => {
    const newStart = values[0];
    if (newStart < trimEnd - 1) {
      onTrimStartChange(newStart);
    }
  };

  const handleEndSliderChange = (values: number[]) => {
    const newEnd = values[0];
    if (newEnd > trimStart + 1) {
      onTrimEndChange(newEnd);
    }
  };

  const hasChanges = trimStart > 0 || trimEnd < duration;

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scissors className="h-5 w-5 text-amber-600" />
          <h3 className="font-medium">Recortar Audio</h3>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={onReset}
                disabled={disabled || isApplying}
                className="text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Restablecer
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={onApplyTrim}
                disabled={disabled || isApplying}
                className="bg-amber-600 hover:bg-amber-700"
              >
                <Check className="h-4 w-4 mr-1" />
                {isApplying ? 'Aplicando...' : 'Aplicar recorte'}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Start trim controls */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="trim-start" className="text-sm text-amber-600 font-medium">
              Punto de inicio
            </Label>
            <Input
              id="trim-start"
              value={startInput}
              onChange={(e) => handleStartInputChange(e.target.value)}
              onBlur={handleStartInputBlur}
              onKeyDown={(e) => e.key === 'Enter' && handleStartInputBlur()}
              disabled={disabled}
              className="w-24 h-8 text-center font-mono text-sm"
              placeholder="00:00"
            />
          </div>
          <Slider
            value={[trimStart]}
            min={0}
            max={duration}
            step={0.1}
            onValueChange={handleStartSliderChange}
            disabled={disabled}
            className="[&_[role=slider]]:bg-amber-500 [&_[role=slider]]:border-amber-600"
            rangeClassName="bg-amber-500"
          />
        </div>

        {/* End trim controls */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="trim-end" className="text-sm text-casa-600 font-medium">
              Punto de fin
            </Label>
            <Input
              id="trim-end"
              value={endInput}
              onChange={(e) => handleEndInputChange(e.target.value)}
              onBlur={handleEndInputBlur}
              onKeyDown={(e) => e.key === 'Enter' && handleEndInputBlur()}
              disabled={disabled}
              className="w-24 h-8 text-center font-mono text-sm"
              placeholder="00:00"
            />
          </div>
          <Slider
            value={[trimEnd]}
            min={0}
            max={duration}
            step={0.1}
            onValueChange={handleEndSliderChange}
            disabled={disabled}
            className="[&_[role=slider]]:bg-casa-600 [&_[role=slider]]:border-casa-700"
            rangeClassName="bg-casa-600"
          />
        </div>
      </div>

      {/* Summary */}
      {hasChanges && (
        <div className="pt-2 border-t border-border">
          <p className="text-sm text-muted-foreground">
            Se recortará{' '}
            <span className="text-foreground font-medium">
              {formatDurationLong(trimStart)}
            </span>{' '}
            del inicio y{' '}
            <span className="text-foreground font-medium">
              {formatDurationLong(duration - trimEnd)}
            </span>{' '}
            del final.
          </p>
        </div>
      )}
    </div>
  );
}
