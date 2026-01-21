/**
 * Settings panel for silence detection parameters
 */
import React from 'react';
import { RotateCcw, ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SilenceDetectionOptions, DEFAULT_SILENCE_OPTIONS } from '@/lib/sermon-editor/silenceDetector';

interface SilenceSettingsProps {
  options: SilenceDetectionOptions;
  onOptionsChange: (options: SilenceDetectionOptions) => void;
  onRedetect: () => void;
  disabled: boolean;
}

export function SilenceSettings({
  options,
  onOptionsChange,
  onRedetect,
  disabled,
}: SilenceSettingsProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleThresholdChange = (value: number[]) => {
    onOptionsChange({
      ...options,
      silenceThreshold: value[0],
    });
  };

  const handleMinDurationChange = (value: number[]) => {
    onOptionsChange({
      ...options,
      minSilenceDuration: value[0],
    });
  };

  const handleEdgePaddingChange = (value: number[]) => {
    onOptionsChange({
      ...options,
      edgePadding: value[0],
    });
  };

  const handleReset = () => {
    onOptionsChange(DEFAULT_SILENCE_OPTIONS);
  };

  const hasChanges =
    options.silenceThreshold !== DEFAULT_SILENCE_OPTIONS.silenceThreshold ||
    options.minSilenceDuration !== DEFAULT_SILENCE_OPTIONS.minSilenceDuration ||
    options.edgePadding !== DEFAULT_SILENCE_OPTIONS.edgePadding;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full flex items-center justify-between p-3 h-auto hover:bg-muted/50"
          disabled={disabled}
        >
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            <span className="text-sm font-medium">Configuración de detección</span>
          </div>
          {isOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="px-3 pb-3 pt-2 space-y-4">
        {/* Silence Threshold */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="threshold" className="text-sm">
              Umbral de silencio (dB)
            </Label>
            <span className="text-sm font-mono text-muted-foreground">
              {options.silenceThreshold} dB
            </span>
          </div>
          <Slider
            id="threshold"
            min={-60}
            max={-20}
            step={1}
            value={[options.silenceThreshold]}
            onValueChange={handleThresholdChange}
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">
            Valores más bajos (-60) detectan más silencios. Valores más altos (-20) solo detectan silencio profundo.
          </p>
        </div>

        {/* Minimum Duration */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="minDuration" className="text-sm">
              Duración mínima (segundos)
            </Label>
            <span className="text-sm font-mono text-muted-foreground">
              {options.minSilenceDuration}s
            </span>
          </div>
          <Slider
            id="minDuration"
            min={1}
            max={10}
            step={0.5}
            value={[options.minSilenceDuration]}
            onValueChange={handleMinDurationChange}
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">
            Solo detectar silencios mayores a esta duración.
          </p>
        </div>

        {/* Edge Padding */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="edgePadding" className="text-sm">
              Margen a mantener (segundos)
            </Label>
            <span className="text-sm font-mono text-muted-foreground">
              {options.edgePadding}s
            </span>
          </div>
          <Slider
            id="edgePadding"
            min={0}
            max={2}
            step={0.1}
            value={[options.edgePadding]}
            onValueChange={handleEdgePaddingChange}
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">
            Mantiene este tiempo al inicio y fin de cada silencio para transiciones suaves.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2">
          <Button
            variant="default"
            size="sm"
            onClick={onRedetect}
            disabled={disabled}
            className="flex-1"
          >
            Re-detectar silencios
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={disabled || !hasChanges}
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Restaurar
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
