/**
 * Audio file upload component with drag & drop support
 */
import React, { useCallback, useState, useRef } from 'react';
import { Upload, FileAudio, X, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  isSupportedAudioFormat,
  getSupportedFormats,
  formatFileSize,
  formatDurationLong,
  AudioFileInfo,
} from '@/lib/sermon-editor/audioProcessor';

// Maximum file size: 500MB (covers ~3 hour WAV at 44.1kHz stereo)
const MAX_FILE_SIZE = 500 * 1024 * 1024;

interface AudioUploaderProps {
  onFileSelected: (file: File) => void;
  fileInfo: AudioFileInfo | null;
  isLoading: boolean;
  error: string | null;
  onClear: () => void;
}

/**
 * Validate file format and size
 */
function validateFile(file: File): { valid: boolean; error?: string } {
  if (!isSupportedAudioFormat(file)) {
    const ext = file.name.split('.').pop() || file.type || 'desconocido';
    return {
      valid: false,
      error: `Formato no soportado: ${ext}. Use ${getSupportedFormats()}.`,
    };
  }
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `Archivo demasiado grande (${formatFileSize(file.size)}). Máximo: 500MB.`,
    };
  }
  return { valid: true };
}

export function AudioUploader({
  onFileSelected,
  fileInfo,
  isLoading,
  error,
  onClear,
}: AudioUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        const validation = validateFile(file);
        if (validation.valid) {
          onFileSelected(file);
        } else {
          toast.error(validation.error, {
            style: {
              background: '#292524',
              color: '#fef3c7',
              border: '1px solid #D97706',
            },
          });
        }
      }
    },
    [onFileSelected]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        const file = files[0];
        const validation = validateFile(file);
        if (validation.valid) {
          onFileSelected(file);
        } else {
          toast.error(validation.error, {
            style: {
              background: '#292524',
              color: '#fef3c7',
              border: '1px solid #D97706',
            },
          });
        }
      }
      // Reset input so same file can be selected again
      e.target.value = '';
    },
    [onFileSelected]
  );

  // Show file info if loaded
  if (fileInfo && !isLoading) {
    return (
      <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                <FileAudio className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="font-medium text-foreground truncate max-w-[300px]">
                  {fileInfo.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(fileInfo.size)} &bull;{' '}
                  {formatDurationLong(fileInfo.duration)} &bull;{' '}
                  {fileInfo.sampleRate / 1000} kHz &bull;{' '}
                  {fileInfo.numberOfChannels === 1 ? 'Mono' : 'Estéreo'}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClear}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show error state
  if (error) {
    return (
      <Card className="border-destructive bg-destructive/10">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <div className="flex-1">
              <p className="font-medium text-destructive">Error al cargar audio</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={onClear}>
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
            <p className="text-muted-foreground">Cargando audio...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Generate unique ID for the file input
  const inputId = 'audio-upload-input';

  // Show upload zone - using label/input pattern for bulletproof click handling
  return (
    <div
      className={`relative transition-colors rounded-lg border-2 ${
        isDragOver
          ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20'
          : 'border-dashed border-muted-foreground/25 hover:border-amber-400'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        accept="audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,audio/flac,.mp3,.wav,.m4a,.flac"
        onChange={handleFileChange}
        className="sr-only"
      />

      {/* Clickable label that triggers the file input */}
      <label
        htmlFor={inputId}
        className="block cursor-pointer p-8"
      >
        <div className="flex flex-col items-center justify-center gap-4">
          <div
            className={`p-4 rounded-full transition-colors ${
              isDragOver
                ? 'bg-amber-200 dark:bg-amber-800'
                : 'bg-amber-100 dark:bg-amber-900/50'
            }`}
          >
            <Upload
              className={`h-8 w-8 ${
                isDragOver
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            />
          </div>
          <div className="text-center">
            <p className="font-medium text-foreground">
              {isDragOver
                ? 'Suelta el archivo aquí'
                : 'Arrastra un archivo de audio aquí'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              o haz clic para seleccionar
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Formatos soportados: {getSupportedFormats()} (máx. 500MB)
            </p>
          </div>
        </div>
      </label>
    </div>
  );
}
