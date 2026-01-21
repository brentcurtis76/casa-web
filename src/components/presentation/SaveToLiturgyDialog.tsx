/**
 * SaveToLiturgyDialog - Dialog para guardar cambios permanentemente en la liturgia
 *
 * Permite a los usuarios guardar:
 * - Diapositivas temporales como contenido permanente
 * - Estilos de presentación (fuentes, colores, fondos)
 * - Configuración del logo y textos superpuestos
 *
 * Phase 1.6: Presentation Persistence - Save to Liturgy (Option A)
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
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
import { Save, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';
import { CASA_BRAND } from '@/lib/brand-kit';
import type { PresentationData, StyleState, LogoState, TextOverlayState, TempSlideEdit } from '@/lib/presentation/types';
import { DEFAULT_LOGO_STATE, DEFAULT_TEXT_OVERLAY_STATE } from '@/lib/presentation/types';
import {
  saveToLiturgy,
  calculateChangeSummary,
  type SaveToLiturgyChangeSummary,
} from '@/lib/presentation/saveToLiturgyService';

interface SaveToLiturgyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: PresentationData | null;
  slides: import('@/types/shared/slide').Slide[];
  tempEdits: Record<string, TempSlideEdit>;
  styleState: StyleState;
  logoState: LogoState;
  textOverlayState: TextOverlayState;
  onSaved?: () => void;
}

export const SaveToLiturgyDialog: React.FC<SaveToLiturgyDialogProps> = ({
  open,
  onOpenChange,
  data,
  slides,
  tempEdits,
  styleState,
  logoState,
  textOverlayState,
  onSaved,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate change summary
  const changeSummary = useMemo<SaveToLiturgyChangeSummary | null>(() => {
    if (!slides) return null;
    return calculateChangeSummary(
      slides,
      styleState,
      logoState,
      textOverlayState,
      DEFAULT_LOGO_STATE,
      DEFAULT_TEXT_OVERLAY_STATE
    );
  }, [slides, styleState, logoState, textOverlayState]);

  // Check if there are any changes to save
  const hasChanges = useMemo(() => {
    if (!changeSummary) return false;
    return (
      changeSummary.tempSlides.count > 0 ||
      changeSummary.hasStyleChanges ||
      changeSummary.hasLogoChanges ||
      changeSummary.hasTextOverlayChanges
    );
  }, [changeSummary]);

  const handleSave = async () => {
    if (!data) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const result = await saveToLiturgy(
        data.liturgyId,
        slides,
        styleState,
        logoState,
        textOverlayState,
        tempEdits
      );

      if (!result.success) {
        setSaveError(result.error || 'Error al guardar');
        return;
      }

      setSaveSuccess(true);
      onSaved?.();

      // Close dialog after short delay to show success
      closeTimeoutRef.current = setTimeout(() => {
        onOpenChange(false);
      }, 1500);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : 'Error al guardar en la liturgia'
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Reset state when dialog opens and cleanup timeout on close/unmount
  useEffect(() => {
    if (open) {
      setSaveError(null);
      setSaveSuccess(false);
    }
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
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
            <Save size={20} style={{ color: CASA_BRAND.colors.primary.amber }} />
            Guardar en liturgia
          </DialogTitle>
          <DialogDescription style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
            Guarda los cambios permanentemente en la liturgia. Estos cambios
            estarán disponibles para todos los usuarios.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning about permanent changes */}
          <Alert
            className="border-amber-500/50"
            style={{
              backgroundColor: CASA_BRAND.colors.primary.amber + '15',
            }}
          >
            <AlertTriangle
              size={16}
              style={{ color: CASA_BRAND.colors.primary.amber }}
            />
            <AlertTitle
              className="font-medium"
              style={{ color: CASA_BRAND.colors.primary.amber }}
            >
              Cambios permanentes
            </AlertTitle>
            <AlertDescription
              style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
            >
              Estos cambios se guardarán en la liturgia y serán visibles para
              todos los usuarios que abran esta liturgia.
            </AlertDescription>
          </Alert>

          {/* Changes summary */}
          {changeSummary && hasChanges ? (
            <div
              className="rounded-lg p-4"
              style={{
                backgroundColor: CASA_BRAND.colors.primary.black,
                border: `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
              }}
            >
              <p
                className="text-sm font-medium mb-3"
                style={{ color: CASA_BRAND.colors.primary.amber }}
              >
                Se guardarán los siguientes cambios:
              </p>

              <ul
                className="text-sm space-y-2"
                style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
              >
                {/* Temp slides */}
                {changeSummary.tempSlides.count > 0 && (
                  <li>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: CASA_BRAND.colors.primary.amber }}
                      />
                      <span style={{ color: CASA_BRAND.colors.primary.white }}>
                        {changeSummary.tempSlides.count} diapositiva
                        {changeSummary.tempSlides.count !== 1 ? 's' : ''} nueva
                        {changeSummary.tempSlides.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {changeSummary.tempSlides.items.length > 0 && (
                      <ul className="ml-6 space-y-1">
                        {changeSummary.tempSlides.items.slice(0, 5).map((item) => (
                          <li
                            key={item.id}
                            className="text-xs truncate"
                            style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                          >
                            {item.previewText}
                            {item.previewText.length >= 50 && '...'}
                          </li>
                        ))}
                        {changeSummary.tempSlides.items.length > 5 && (
                          <li
                            className="text-xs italic"
                            style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                          >
                            ... y {changeSummary.tempSlides.items.length - 5} más
                          </li>
                        )}
                      </ul>
                    )}
                  </li>
                )}

                {/* Style changes */}
                {changeSummary.hasStyleChanges && (
                  <li className="flex items-center gap-2">
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: CASA_BRAND.colors.primary.amber }}
                    />
                    <span style={{ color: CASA_BRAND.colors.primary.white }}>
                      Estilos de presentación (fuentes, colores, fondos)
                    </span>
                  </li>
                )}

                {/* Logo changes */}
                {changeSummary.hasLogoChanges && (
                  <li className="flex items-center gap-2">
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: CASA_BRAND.colors.primary.amber }}
                    />
                    <span style={{ color: CASA_BRAND.colors.primary.white }}>
                      Configuración del logo
                    </span>
                  </li>
                )}

                {/* Text overlay changes */}
                {changeSummary.hasTextOverlayChanges && (
                  <li className="flex items-center gap-2">
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: CASA_BRAND.colors.primary.amber }}
                    />
                    <span style={{ color: CASA_BRAND.colors.primary.white }}>
                      Textos superpuestos ({textOverlayState.overlays.length})
                    </span>
                  </li>
                )}
              </ul>
            </div>
          ) : (
            <div
              className="rounded-lg p-4 text-center"
              style={{
                backgroundColor: CASA_BRAND.colors.primary.black,
                border: `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
              }}
            >
              <p style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                No hay cambios para guardar
              </p>
            </div>
          )}

          {/* Error message */}
          {saveError && (
            <Alert variant="destructive">
              <AlertTriangle size={16} />
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}

          {/* Success message */}
          {saveSuccess && (
            <Alert
              className="border-green-500/50"
              style={{ backgroundColor: '#22c55e15' }}
            >
              <CheckCircle2 size={16} style={{ color: '#22c55e' }} />
              <AlertDescription style={{ color: '#22c55e' }}>
                Cambios guardados correctamente en la liturgia
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving || saveSuccess}
            style={{
              borderColor: CASA_BRAND.colors.secondary.grayDark,
              color: CASA_BRAND.colors.primary.white,
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!data || !hasChanges || isSaving || saveSuccess}
            style={{
              backgroundColor: CASA_BRAND.colors.primary.amber,
              color: CASA_BRAND.colors.primary.black,
            }}
          >
            {isSaving ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Guardando...
              </>
            ) : saveSuccess ? (
              <>
                <CheckCircle2 size={16} className="mr-2" />
                Guardado
              </>
            ) : (
              <>
                <Save size={16} className="mr-2" />
                Guardar en liturgia
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SaveToLiturgyDialog;
