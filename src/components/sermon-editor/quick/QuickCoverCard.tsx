/**
 * QuickCoverCard — cover preview + regenerate / upload affordances for
 * the review step of Publicación Rápida.
 */
import React, { useRef, useState } from 'react';
import { ImageOff, Loader2, RefreshCw, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CoverCropTool } from '@/components/sermon-editor/CoverCropTool';
import type { CoverState } from '@/hooks/useQuickPublish';

interface QuickCoverCardProps {
  cover: CoverState;
  onRegenerate: (theme?: string) => void;
  onUpload: (blob: Blob) => void;
}

export function QuickCoverCard({
  cover,
  onRegenerate,
  onUpload,
}: QuickCoverCardProps) {
  const [theme, setTheme] = useState('');
  const [showThemeInput, setShowThemeInput] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openFilePicker = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPendingFile(file);
    // Reset so the same file can be re-selected later.
    e.target.value = '';
  };

  const handleCropDone = (blob: Blob) => {
    onUpload(blob);
    setPendingFile(null);
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <h3 className="text-sm font-medium">Portada</h3>

        <div className="aspect-square w-full max-w-sm mx-auto rounded-md border bg-muted overflow-hidden flex items-center justify-center">
          {cover.status === 'generating' && (
            <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
              Generando portada…
            </div>
          )}
          {cover.status === 'done' && cover.previewUrl && (
            <img
              src={cover.previewUrl}
              alt="Portada del episodio"
              className="h-full w-full object-cover"
            />
          )}
          {cover.status === 'error' && (
            <div className="flex flex-col items-center gap-2 text-center text-sm text-muted-foreground px-4">
              <ImageOff className="h-6 w-6 text-muted-foreground" />
              No se pudo generar la portada. Puedes reintentar o subir una imagen.
            </div>
          )}
          {cover.status === 'idle' && (
            <p className="text-sm text-muted-foreground">Sin portada todavía.</p>
          )}
        </div>

        {cover.status === 'error' && cover.error && (
          <p className="text-xs text-red-600">{cover.error}</p>
        )}

        <div className="flex flex-wrap gap-2 justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRegenerate(theme.trim() || undefined)}
            disabled={cover.status === 'generating'}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {cover.status === 'error' ? 'Reintentar' : 'Regenerar portada'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={openFilePicker}
            disabled={cover.status === 'generating'}
          >
            <Upload className="h-4 w-4 mr-2" />
            Subir imagen
          </Button>
        </div>

        {cover.status !== 'idle' && (
          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={() => setShowThemeInput((s) => !s)}
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              {showThemeInput ? 'Ocultar tema' : 'Tema de la ilustración (opcional)'}
            </button>
            {showThemeInput && (
              <div className="space-y-1">
                <Label htmlFor="quick-cover-theme" className="text-xs">
                  Sugerencia de tema
                </Label>
                <Input
                  id="quick-cover-theme"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  placeholder="Ej. barca en la tormenta"
                />
              </div>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={handleFileChange}
        />

        {pendingFile && (
          <CoverCropTool
            file={pendingFile}
            onCrop={handleCropDone}
            onCancel={() => setPendingFile(null)}
          />
        )}
      </CardContent>
    </Card>
  );
}
