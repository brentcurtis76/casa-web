/**
 * Distribution Panel - Spotify validation and package export
 * PROMPT_006: Spotify Integration
 *
 * Features:
 * - Spotify requirements validation
 * - ZIP package download (MP3 + cover + metadata.txt)
 * - Copy buttons for metadata fields
 * - Direct link to Spotify for Podcasters
 */
import React, { useState, useCallback } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  Package,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { SermonMetadata } from './MetadataForm';
import type { ValidationResult } from '@/lib/sermon-editor/spotifyValidator';
import { createDistributionZip, DistributionPackage } from '@/lib/sermon-editor/distributionPackage';

interface DistributionPanelProps {
  audioBlob: Blob | null;
  coverImage: Blob | null;
  metadata: SermonMetadata;
  validation: ValidationResult;
  disabled?: boolean;
}

// Brand toast styles
const toastStyles = {
  success: {
    style: { background: '#292524', color: '#fef3c7', border: '1px solid #D97706' },
  },
  error: {
    style: { background: '#292524', color: '#fef3c7', border: '1px solid #dc2626' },
  },
};

export function DistributionPanel({
  audioBlob,
  coverImage,
  metadata,
  validation,
  disabled = false,
}: DistributionPanelProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Copy text to clipboard
  const copyToClipboard = useCallback(async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success('Copiado al portapapeles', toastStyles.success);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error('Error al copiar', toastStyles.error);
    }
  }, []);

  // Download ZIP package
  const downloadPackage = useCallback(async () => {
    if (!audioBlob || !coverImage) return;

    setIsDownloading(true);
    try {
      const pkg: DistributionPackage = {
        audioFile: audioBlob,
        audioFileName: `sermon_${metadata.title}.mp3`,
        coverImage: coverImage,
        coverFileName: `portada_${metadata.title}.jpg`,
        metadata,
        validation,
      };

      const zipBlob = await createDistributionZip(pkg);

      // Trigger download
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sermon_${metadata.title}_spotify.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Paquete descargado', toastStyles.success);
    } catch (err) {
      console.error('Error creating package:', err);
      toast.error('Error al crear el paquete', toastStyles.error);
    } finally {
      setIsDownloading(false);
    }
  }, [audioBlob, coverImage, metadata, validation]);

  // Open Spotify for Podcasters
  const openSpotify = useCallback(() => {
    window.open('https://podcasters.spotify.com', '_blank', 'noopener,noreferrer');
  }, []);

  // Render validation item
  const ValidationItem = ({
    passed,
    label,
    isWarning = false
  }: {
    passed: boolean;
    label: string;
    isWarning?: boolean;
  }) => (
    <div className="flex items-center gap-2 text-sm">
      {passed ? (
        <CheckCircle2 className="h-4 w-4 text-amber-500 flex-shrink-0" />
      ) : isWarning ? (
        <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
      )}
      <span className={passed ? 'text-muted-foreground' : isWarning ? 'text-amber-600' : 'text-red-600'}>
        {label}
      </span>
    </div>
  );

  // Copy field button
  const CopyField = ({ label, value, field }: { label: string; value: string; field: string }) => (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground w-24">{label}:</span>
      <div className="flex-1 text-sm truncate bg-muted px-2 py-1 rounded">
        {value || '\u2014'}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => copyToClipboard(value, field)}
        disabled={!value}
        className="h-8 w-8 p-0"
      >
        {copiedField === field ? (
          <Check className="h-4 w-4 text-amber-500" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Validation Section */}
      <div className="rounded-lg border p-4 space-y-2">
        <h4 className="font-medium text-sm flex items-center gap-2">
          {validation.isValid ? (
            <CheckCircle2 className="h-4 w-4 text-amber-500" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
          Validacion para Spotify
        </h4>

        <div className="space-y-1 pl-6">
          {/* Show errors */}
          {validation.errors.map((error, i) => (
            <ValidationItem key={`error-${i}`} passed={false} label={error} />
          ))}

          {/* Show success items if valid */}
          {validation.isValid && (
            <>
              <ValidationItem passed label={`Audio: MP3, ${audioBlob ? (audioBlob.size / (1024 * 1024)).toFixed(1) : 0}MB`} />
              <ValidationItem passed label={`Portada: 1400x1400, ${coverImage ? (coverImage.size / 1024).toFixed(0) : 0}KB`} />
              <ValidationItem passed label={`Titulo: ${metadata.title?.length || 0} caracteres`} />
            </>
          )}

          {/* Show warnings */}
          {validation.warnings.map((warning, i) => (
            <ValidationItem key={`warning-${i}`} passed={false} label={warning} isWarning />
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={downloadPackage}
          disabled={!validation.isValid || disabled || isDownloading}
          className="flex-1 bg-amber-600 hover:bg-amber-700"
        >
          {isDownloading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Package className="h-4 w-4 mr-2" />
          )}
          Descargar Paquete
        </Button>

        <Button
          variant="outline"
          onClick={openSpotify}
          className="flex-1"
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Abrir Spotify
        </Button>
      </div>

      {/* Metadata Copy Section */}
      <div className="space-y-2 border-t pt-4">
        <h4 className="text-sm font-medium text-muted-foreground">
          Metadatos para copiar
        </h4>
        <CopyField label="Titulo" value={metadata.title} field="title" />
        <CopyField label="Predicador" value={metadata.speaker} field="speaker" />
        <CopyField
          label="Fecha"
          value={metadata.date?.toISOString().split('T')[0] || ''}
          field="date"
        />
        {metadata.description && (
          <CopyField label="Descripcion" value={metadata.description} field="description" />
        )}
      </div>
    </div>
  );
}
