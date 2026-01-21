/**
 * ImportDialog - Dialog for importing presentation from JSON file
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Upload, FileJson, AlertTriangle, RefreshCw } from 'lucide-react';
import { CASA_BRAND } from '@/lib/brand-kit';
import { cn } from '@/lib/utils';
import type { ImportValidationResult } from '@/lib/presentation/types';
import { validateImportFile, formatExportDate } from '@/lib/presentation/exportImport';

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentLiturgyId?: string;
  onImport: (validationResult: ImportValidationResult) => void;
}

export const ImportDialog: React.FC<ImportDialogProps> = ({
  open,
  onOpenChange,
  currentLiturgyId,
  onImport,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportValidationResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file validation
  const processFile = useCallback(
    async (file: File) => {
      setIsProcessing(true);
      setImportError(null);
      setSelectedFile(file);

      try {
        const result = await validateImportFile(file, currentLiturgyId);
        setImportPreview(result);
      } catch (error) {
        setImportError(error instanceof Error ? error.message : 'Error al procesar archivo');
        setImportPreview(null);
      } finally {
        setIsProcessing(false);
      }
    },
    [currentLiturgyId]
  );

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // Only set false if actually leaving the container (fixes flicker on child elements)
    const relatedTarget = e.relatedTarget as Node | null;
    if (!e.currentTarget.contains(relatedTarget)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        if (file.type === 'application/json' || file.name.endsWith('.json')) {
          processFile(file);
        } else {
          setImportError('Por favor selecciona un archivo JSON');
        }
      }
    },
    [processFile]
  );

  // File input handler
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        processFile(e.target.files[0]);
      }
    },
    [processFile]
  );

  // Clear selection
  const handleClearImport = useCallback(() => {
    setSelectedFile(null);
    setImportPreview(null);
    setImportError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Apply import
  const handleApplyImport = useCallback(() => {
    if (importPreview) {
      onImport(importPreview);
      onOpenChange(false);
    }
  }, [importPreview, onImport, onOpenChange]);

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setSelectedFile(null);
      setImportPreview(null);
      setImportError(null);
      setIsDragging(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[500px]"
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
            Importar presentación
          </DialogTitle>
          <DialogDescription style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
            Carga una presentación desde un archivo JSON exportado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!importPreview ? (
            // File selection
            <div
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                isDragging && 'border-amber-500 bg-amber-500/10'
              )}
              style={{
                borderColor: isDragging
                  ? CASA_BRAND.colors.primary.amber
                  : CASA_BRAND.colors.secondary.grayDark,
                backgroundColor: isDragging
                  ? `${CASA_BRAND.colors.primary.amber}10`
                  : CASA_BRAND.colors.primary.black,
              }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {isProcessing ? (
                <>
                  <RefreshCw
                    size={32}
                    className="mx-auto mb-2 animate-spin"
                    style={{ color: CASA_BRAND.colors.primary.amber }}
                  />
                  <p style={{ color: CASA_BRAND.colors.primary.white }}>
                    Procesando archivo...
                  </p>
                </>
              ) : (
                <>
                  <Upload
                    size={32}
                    className="mx-auto mb-2"
                    style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                  />
                  <p style={{ color: CASA_BRAND.colors.primary.white }}>
                    Arrastra un archivo JSON aquí
                  </p>
                  <p
                    className="text-sm mt-1"
                    style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                  >
                    o haz clic para seleccionar
                  </p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          ) : (
            // Preview of import
            <div className="space-y-4">
              <div
                className="rounded-lg p-4"
                style={{
                  backgroundColor: CASA_BRAND.colors.primary.black,
                  border: `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
                }}
              >
                <h4
                  className="font-medium mb-1"
                  style={{ color: CASA_BRAND.colors.primary.white }}
                >
                  Archivo seleccionado
                </h4>
                <p
                  className="text-sm"
                  style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                >
                  {selectedFile?.name}
                </p>
              </div>

              <div
                className="space-y-2 text-sm"
                style={{ color: CASA_BRAND.colors.primary.white }}
              >
                <p>
                  <strong style={{ color: CASA_BRAND.colors.primary.amber }}>
                    Liturgia original:
                  </strong>{' '}
                  {importPreview.liturgyTitle}
                </p>
                <p>
                  <strong style={{ color: CASA_BRAND.colors.primary.amber }}>
                    Exportado:
                  </strong>{' '}
                  {formatExportDate(importPreview.importData.exportedAt)}
                </p>
                {importPreview.importData.exportedBy && (
                  <p>
                    <strong style={{ color: CASA_BRAND.colors.primary.amber }}>
                      Por:
                    </strong>{' '}
                    {importPreview.importData.exportedBy}
                  </p>
                )}
              </div>

              {!importPreview.liturgyMatches && currentLiturgyId && (
                <Alert
                  className="border-amber-500/50"
                  style={{
                    backgroundColor: `${CASA_BRAND.colors.primary.amber}15`,
                    borderColor: `${CASA_BRAND.colors.primary.amber}50`,
                  }}
                >
                  <AlertTriangle
                    size={16}
                    style={{ color: CASA_BRAND.colors.primary.amber }}
                  />
                  <AlertTitle style={{ color: CASA_BRAND.colors.primary.amber }}>
                    Liturgia diferente
                  </AlertTitle>
                  <AlertDescription
                    style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                  >
                    Este archivo fue exportado de una liturgia diferente. Las
                    diapositivas temporales se agregarán pero pueden no coincidir con
                    el contenido actual.
                  </AlertDescription>
                </Alert>
              )}

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
                  Se importará:
                </p>
                <ul
                  className="text-sm space-y-1"
                  style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                >
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {importPreview.importData.state.tempSlides.length} diapositiva
                    {importPreview.importData.state.tempSlides.length !== 1 ? 's' : ''}{' '}
                    temporal
                    {importPreview.importData.state.tempSlides.length !== 1 ? 'es' : ''}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    Configuración de estilos
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    Logo y superposiciones de texto
                  </li>
                </ul>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleClearImport}
                style={{
                  borderColor: CASA_BRAND.colors.secondary.grayDark,
                  color: CASA_BRAND.colors.primary.white,
                }}
              >
                Seleccionar otro archivo
              </Button>
            </div>
          )}

          {importError && (
            <Alert variant="destructive">
              <AlertTriangle size={16} />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{importError}</AlertDescription>
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
            onClick={handleApplyImport}
            disabled={!importPreview}
            style={{
              backgroundColor: CASA_BRAND.colors.primary.amber,
              color: CASA_BRAND.colors.primary.black,
            }}
          >
            <Upload size={16} className="mr-2" />
            Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportDialog;
