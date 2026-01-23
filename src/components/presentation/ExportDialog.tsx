/**
 * ExportDialog - Dialog for exporting presentation to JSON file
 */

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, FileJson, AlertTriangle } from 'lucide-react';
import { CASA_BRAND } from '@/lib/brand-kit';
import type { PresentationData, StyleState, LogoState, TextOverlayState, ImageOverlayState, TempSlideEdit } from '@/lib/presentation/types';
import { exportPresentation } from '@/lib/presentation/exportImport';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: PresentationData | null;
  tempEdits: Record<string, TempSlideEdit>;
  styleState: StyleState;
  logoState: LogoState;
  textOverlayState: TextOverlayState;
  imageOverlayState: ImageOverlayState;
  userName?: string;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
  open,
  onOpenChange,
  data,
  tempEdits,
  styleState,
  logoState,
  textOverlayState,
  imageOverlayState,
  userName,
}) => {
  const [exportFilename, setExportFilename] = useState('');
  const [includeFullSlides, setIncludeFullSlides] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Calculate stats
  const stats = useMemo(() => {
    if (!data) return { tempSlidesCount: 0, totalSlides: 0 };
    const tempSlides = data.slides.filter((s) => s.id.startsWith('temp-'));
    return {
      tempSlidesCount: tempSlides.length,
      totalSlides: data.slides.length,
    };
  }, [data]);

  // Generate default filename
  const defaultFilename = useMemo(() => {
    if (!data) return 'presentacion.json';
    const safeTitle = data.liturgyTitle
      .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s-]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 50);
    const date = new Date().toISOString().slice(0, 10);
    return `presentacion_${safeTitle}_${date}.json`;
  }, [data]);

  const handleExport = async () => {
    if (!data) return;

    setIsExporting(true);
    setExportError(null);
    try {
      await exportPresentation(
        data,
        tempEdits,
        styleState,
        logoState,
        textOverlayState,
        imageOverlayState,
        {
          includeFullSlides,
          filename: exportFilename || defaultFilename,
          userName,
        }
      );
      onOpenChange(false);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Error al exportar la presentación');
    } finally {
      setIsExporting(false);
    }
  };

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setExportFilename('');
      setIncludeFullSlides(false);
      setExportError(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[425px]"
        style={{
          backgroundColor: CASA_BRAND.colors.secondary.carbon,
          borderColor: CASA_BRAND.colors.secondary.grayDark,
        }}
      >
        <DialogHeader>
          <DialogTitle
            className="flex items-center gap-2"
            style={{ color: CASA_BRAND.colors.primary.white }}
          >
            <FileJson size={20} style={{ color: CASA_BRAND.colors.primary.amber }} />
            Exportar presentación
          </DialogTitle>
          <DialogDescription style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
            Descarga tu presentación como archivo JSON para respaldo o transferencia.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Filename input */}
          <div className="space-y-2">
            <Label
              htmlFor="export-filename"
              style={{ color: CASA_BRAND.colors.primary.white }}
            >
              Nombre del archivo
            </Label>
            <Input
              id="export-filename"
              value={exportFilename}
              onChange={(e) => setExportFilename(e.target.value)}
              placeholder={defaultFilename}
              style={{
                backgroundColor: CASA_BRAND.colors.primary.black,
                borderColor: CASA_BRAND.colors.secondary.grayDark,
                color: CASA_BRAND.colors.primary.white,
              }}
            />
          </div>

          {/* Include full slides toggle */}
          <div className="flex items-center justify-between">
            <Label
              htmlFor="include-full"
              className="flex flex-col gap-1"
              style={{ color: CASA_BRAND.colors.primary.white }}
            >
              <span>Incluir todas las diapositivas</span>
              <span
                className="text-xs font-normal"
                style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
              >
                Archivo más grande, permite visualización standalone
              </span>
            </Label>
            <Switch
              id="include-full"
              checked={includeFullSlides}
              onCheckedChange={setIncludeFullSlides}
              className="border-2 data-[state=unchecked]:bg-gray-700"
              style={{
                borderColor: includeFullSlides ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.secondary.grayMedium,
                backgroundColor: includeFullSlides ? CASA_BRAND.colors.primary.amber : undefined,
              }}
            />
          </div>

          {/* Export summary */}
          <div
            className="rounded-lg p-4"
            style={{
              backgroundColor: CASA_BRAND.colors.primary.black,
              border: `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
            }}
          >
            <p
              className="text-sm font-medium mb-2"
              style={{ color: CASA_BRAND.colors.primary.amber }}
            >
              Se exportará:
            </p>
            <ul
              className="text-sm space-y-1"
              style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
            >
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {stats.tempSlidesCount} diapositiva{stats.tempSlidesCount !== 1 ? 's' : ''} temporal{stats.tempSlidesCount !== 1 ? 'es' : ''}
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                Configuración de estilos
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                Logo y superposiciones de texto
              </li>
              {includeFullSlides && (
                <li
                  className="flex items-center gap-2"
                  style={{ color: CASA_BRAND.colors.primary.amber }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {stats.totalSlides} diapositivas de la liturgia
                </li>
              )}
            </ul>
          </div>

          {exportError && (
            <Alert variant="destructive">
              <AlertTriangle size={16} />
              <AlertDescription>{exportError}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            style={{
              borderColor: CASA_BRAND.colors.secondary.grayDark,
              color: CASA_BRAND.colors.primary.white,
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleExport}
            disabled={!data || isExporting}
            style={{
              backgroundColor: CASA_BRAND.colors.primary.amber,
              color: CASA_BRAND.colors.primary.black,
            }}
          >
            <Download size={16} className="mr-2" />
            {isExporting ? 'Exportando...' : 'Exportar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExportDialog;
