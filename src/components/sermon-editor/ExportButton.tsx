/**
 * Export button with progress indicator
 * Updated for PROMPT_005: Shows metadata and cover status
 */
import React from 'react';
import { Download, Loader2, Music2, Image, Tag, Sliders } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { formatDurationLong } from '@/lib/sermon-editor/audioProcessor';

interface ExportButtonProps {
  onExport: () => void;
  isExporting: boolean;
  exportProgress: number;
  trimStart: number;
  trimEnd: number;
  disabled?: boolean;
  // PROMPT_005: Metadata status
  hasMetadata?: boolean;
  hasCoverArt?: boolean;
  hasMusic?: boolean;
  // PROMPT_008: Audio enhancements
  hasEnhancements?: boolean;
}

export function ExportButton({
  onExport,
  isExporting,
  exportProgress,
  trimStart,
  trimEnd,
  disabled = false,
  hasMetadata = false,
  hasCoverArt = false,
  hasMusic = false,
  hasEnhancements = false,
}: ExportButtonProps) {
  const trimmedDuration = trimEnd - trimStart;

  if (isExporting) {
    return (
      <div className="space-y-2">
        <Button
          disabled
          className="w-full bg-amber-600 hover:bg-amber-700"
        >
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Exportando MP3... {Math.round(exportProgress)}%
        </Button>
        <Progress value={exportProgress} className="h-2" />
      </div>
    );
  }

  // Build feature indicators
  const features = [];
  if (hasMetadata) features.push({ icon: Tag, label: 'ID3' });
  if (hasCoverArt) features.push({ icon: Image, label: 'Portada' });
  if (hasMusic) features.push({ icon: Music2, label: 'Música' });
  if (hasEnhancements) features.push({ icon: Sliders, label: 'Mejoras' });

  return (
    <div className="space-y-2">
      <Button
        onClick={onExport}
        disabled={disabled}
        className="w-full bg-amber-600 hover:bg-amber-700"
        size="lg"
      >
        <Download className="h-4 w-4 mr-2" />
        Descargar MP3 ({formatDurationLong(trimmedDuration)})
      </Button>

      {/* Feature indicators */}
      {features.length > 0 && (
        <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
          <span>Incluye:</span>
          {features.map(({ icon: Icon, label }) => (
            <span key={label} className="flex items-center gap-1 text-amber-600">
              <Icon className="h-3 w-3" />
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
