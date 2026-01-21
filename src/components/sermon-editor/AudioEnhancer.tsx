/**
 * Audio enhancement controls component
 * Provides UI for normalization, EQ, compression, and gain
 * PROMPT_008: Audio Enhancement Tools
 */
import React from 'react';
import { Sliders, Volume2, Activity, Gauge } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import {
  EnhancementSettings,
  COMPRESSION_PRESETS,
  CompressionPreset,
} from '@/lib/sermon-editor/audioEnhancer';

interface AudioEnhancerProps {
  settings: EnhancementSettings;
  onSettingsChange: (settings: EnhancementSettings) => void;
  disabled?: boolean;
}

export function AudioEnhancer({
  settings,
  onSettingsChange,
  disabled = false,
}: AudioEnhancerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  // Update a specific setting
  const updateSetting = <K extends keyof EnhancementSettings>(
    key: K,
    value: EnhancementSettings[K]
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  // Update EQ setting
  const updateEQ = (band: 'bass' | 'mid' | 'treble', value: number) => {
    onSettingsChange({
      ...settings,
      eq: { ...settings.eq, [band]: value },
    });
  };

  // Apply compression preset
  const applyCompressionPreset = (preset: CompressionPreset) => {
    if (preset === 'off') {
      onSettingsChange({
        ...settings,
        compressionEnabled: false,
        compression: COMPRESSION_PRESETS.off,
      });
    } else {
      onSettingsChange({
        ...settings,
        compressionEnabled: true,
        compression: COMPRESSION_PRESETS[preset],
      });
    }
  };

  // Get current compression preset name (if matching)
  const getCurrentPresetName = (): CompressionPreset | 'custom' => {
    if (!settings.compressionEnabled) return 'off';

    for (const [name, preset] of Object.entries(COMPRESSION_PRESETS)) {
      if (
        preset.threshold === settings.compression.threshold &&
        preset.ratio === settings.compression.ratio &&
        preset.attack === settings.compression.attack &&
        preset.release === settings.compression.release
      ) {
        return name as CompressionPreset;
      }
    }
    return 'custom';
  };

  // Format dB value for display
  const formatDb = (value: number) => {
    if (value > 0) return `+${value.toFixed(1)} dB`;
    if (value < 0) return `${value.toFixed(1)} dB`;
    return '0 dB';
  };

  return (
    <div className="space-y-4">
      {/* Main enable toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-muted-foreground" />
          <Label htmlFor="enhancement-enabled" className="text-sm font-medium">
            Habilitar mejoras de audio
          </Label>
        </div>
        <Switch
          id="enhancement-enabled"
          checked={settings.enabled}
          onCheckedChange={(checked) => updateSetting('enabled', checked)}
          disabled={disabled}
        />
      </div>

      {settings.enabled && (
        <div className="space-y-6 pt-2">
          {/* Gain Control */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm">Ganancia</Label>
              </div>
              <span className="text-sm font-mono text-muted-foreground w-20 text-right">
                {formatDb(settings.gain)}
              </span>
            </div>
            <Slider
              value={[settings.gain]}
              onValueChange={([value]) => updateSetting('gain', value)}
              min={-12}
              max={12}
              step={0.5}
              disabled={disabled}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>-12 dB</span>
              <span>0</span>
              <span>+12 dB</span>
            </div>
          </div>

          {/* Normalization */}
          <div className="space-y-3 p-3 rounded-lg bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="normalize-enabled" className="text-sm">
                  Normalizar audio
                </Label>
              </div>
              <Switch
                id="normalize-enabled"
                checked={settings.normalize}
                onCheckedChange={(checked) => updateSetting('normalize', checked)}
                disabled={disabled}
              />
            </div>
            {settings.normalize && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Nivel objetivo</Label>
                  <span className="text-xs font-mono text-muted-foreground">
                    {settings.normalizeTarget} dB
                  </span>
                </div>
                <Slider
                  value={[settings.normalizeTarget]}
                  onValueChange={([value]) => updateSetting('normalizeTarget', value)}
                  min={-6}
                  max={0}
                  step={0.5}
                  disabled={disabled}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Ajusta el volumen máximo al nivel especificado
                </p>
              </div>
            )}
          </div>

          {/* EQ Section */}
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between px-3 py-2 h-auto"
                disabled={disabled}
              >
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Ecualizador (3 bandas)</span>
                </div>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-3">
              {/* Bass */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Graves (250 Hz)</Label>
                  <span className="text-xs font-mono text-muted-foreground w-16 text-right">
                    {formatDb(settings.eq.bass)}
                  </span>
                </div>
                <Slider
                  value={[settings.eq.bass]}
                  onValueChange={([value]) => updateEQ('bass', value)}
                  min={-12}
                  max={12}
                  step={0.5}
                  disabled={disabled}
                  className="w-full"
                />
              </div>

              {/* Mid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Medios (1 kHz)</Label>
                  <span className="text-xs font-mono text-muted-foreground w-16 text-right">
                    {formatDb(settings.eq.mid)}
                  </span>
                </div>
                <Slider
                  value={[settings.eq.mid]}
                  onValueChange={([value]) => updateEQ('mid', value)}
                  min={-12}
                  max={12}
                  step={0.5}
                  disabled={disabled}
                  className="w-full"
                />
              </div>

              {/* Treble */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Agudos (4 kHz)</Label>
                  <span className="text-xs font-mono text-muted-foreground w-16 text-right">
                    {formatDb(settings.eq.treble)}
                  </span>
                </div>
                <Slider
                  value={[settings.eq.treble]}
                  onValueChange={([value]) => updateEQ('treble', value)}
                  min={-12}
                  max={12}
                  step={0.5}
                  disabled={disabled}
                  className="w-full"
                />
              </div>

              {/* Reset EQ button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  onSettingsChange({
                    ...settings,
                    eq: { bass: 0, mid: 0, treble: 0 },
                  })
                }
                disabled={
                  disabled ||
                  (settings.eq.bass === 0 &&
                    settings.eq.mid === 0 &&
                    settings.eq.treble === 0)
                }
                className="w-full"
              >
                Restablecer EQ
              </Button>
            </CollapsibleContent>
          </Collapsible>

          {/* Compression Section */}
          <div className="space-y-3 p-3 rounded-lg bg-muted/30">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Compresor</Label>
              <Select
                value={getCurrentPresetName()}
                onValueChange={(value) => applyCompressionPreset(value as CompressionPreset)}
                disabled={disabled}
              >
                <SelectTrigger className="w-32 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Desactivado</SelectItem>
                  <SelectItem value="subtle">Sutil</SelectItem>
                  <SelectItem value="voice">Voz</SelectItem>
                  <SelectItem value="podcast">Podcast</SelectItem>
                  <SelectItem value="aggressive">Agresivo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {settings.compressionEnabled && (
              <div className="text-xs text-muted-foreground space-y-1">
                <p>
                  Umbral: {settings.compression.threshold} dB | Ratio:{' '}
                  {settings.compression.ratio}:1
                </p>
                <p>
                  Attack: {(settings.compression.attack * 1000).toFixed(0)} ms | Release:{' '}
                  {(settings.compression.release * 1000).toFixed(0)} ms
                </p>
              </div>
            )}
          </div>

          {/* Info text */}
          <p className="text-xs text-muted-foreground">
            Los cambios se aplican en tiempo real durante la reproducción.
          </p>
        </div>
      )}
    </div>
  );
}
