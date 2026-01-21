/**
 * SaveSessionDialog - Dialog para guardar una sesión de presentación
 *
 * Permite a los usuarios guardar el estado actual de la presentación
 * para cargarla después en otro dispositivo.
 *
 * Phase 1.6: Presentation Persistence
 */

import React, { useState, useMemo, useEffect } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Save, AlertTriangle, Loader2 } from 'lucide-react';
import { CASA_BRAND } from '@/lib/brand-kit';
import type { PresentationData, StyleState, LogoState, TextOverlayState, ImageOverlayState, TempSlideEdit } from '@/lib/presentation/types';
import { saveSession, createSessionState } from '@/lib/presentation/sessionService';

interface SaveSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: PresentationData | null;
  slides: import('@/types/shared/slide').Slide[];
  tempEdits: Record<string, TempSlideEdit>;
  styleState: StyleState;
  logoState: LogoState;
  textOverlayState: TextOverlayState;
  imageOverlayState: ImageOverlayState;
  previewSlideIndex: number;
  liveSlideIndex: number;
  onSaved?: (sessionId: string) => void;
}

export const SaveSessionDialog: React.FC<SaveSessionDialogProps> = ({
  open,
  onOpenChange,
  data,
  slides,
  tempEdits,
  styleState,
  logoState,
  textOverlayState,
  imageOverlayState,
  previewSlideIndex,
  liveSlideIndex,
  onSaved,
}) => {
  const [sessionName, setSessionName] = useState('');
  const [sessionDescription, setSessionDescription] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Calculate stats
  const stats = useMemo(() => {
    if (!slides) return { tempSlidesCount: 0, totalSlides: 0 };
    const tempSlides = slides.filter(
      (s) => s.id.startsWith('temp-') || s.id.startsWith('imported-')
    );
    return {
      tempSlidesCount: tempSlides.length,
      totalSlides: slides.length,
    };
  }, [slides]);

  // Generate default session name
  const defaultName = useMemo(() => {
    if (!data) return 'Sesión de presentación';
    const date = data.liturgyDate.toLocaleDateString('es-CL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    // Capitalize first letter
    return date.charAt(0).toUpperCase() + date.slice(1);
  }, [data]);

  // Set default service date from liturgy
  useEffect(() => {
    if (open && data?.liturgyDate) {
      const dateStr = data.liturgyDate.toISOString().slice(0, 10);
      setSessionDate(dateStr);
    }
  }, [open, data?.liturgyDate]);

  const handleSave = async () => {
    if (!data || !sessionName.trim()) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const state = createSessionState(
        slides,
        styleState,
        logoState,
        textOverlayState,
        imageOverlayState,
        tempEdits,
        previewSlideIndex,
        liveSlideIndex
      );

      const session = await saveSession({
        liturgyId: data.liturgyId,
        name: sessionName.trim(),
        description: sessionDescription.trim() || undefined,
        serviceDate: sessionDate || undefined,
        state,
      });

      onSaved?.(session.id);
      onOpenChange(false);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : 'Error al guardar la sesión'
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSessionName(defaultName);
      setSessionDescription('');
      setSaveError(null);
    }
  }, [open, defaultName]);

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
            <Save size={20} style={{ color: CASA_BRAND.colors.primary.amber }} />
            Guardar sesión de presentación
          </DialogTitle>
          <DialogDescription style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
            Guarda tu presentación preparada para cargarla en otro dispositivo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Session name input */}
          <div className="space-y-2">
            <Label
              htmlFor="session-name"
              style={{ color: CASA_BRAND.colors.primary.white }}
            >
              Nombre de la sesión *
            </Label>
            <Input
              id="session-name"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="Domingo 26 Enero - Culto Principal"
              style={{
                backgroundColor: CASA_BRAND.colors.primary.black,
                borderColor: CASA_BRAND.colors.secondary.grayDark,
                color: CASA_BRAND.colors.primary.white,
              }}
            />
          </div>

          {/* Service date input */}
          <div className="space-y-2">
            <Label
              htmlFor="session-date"
              style={{ color: CASA_BRAND.colors.primary.white }}
            >
              Fecha del servicio
            </Label>
            <Input
              id="session-date"
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              style={{
                backgroundColor: CASA_BRAND.colors.primary.black,
                borderColor: CASA_BRAND.colors.secondary.grayDark,
                color: CASA_BRAND.colors.primary.white,
              }}
            />
          </div>

          {/* Description input */}
          <div className="space-y-2">
            <Label
              htmlFor="session-desc"
              style={{ color: CASA_BRAND.colors.primary.white }}
            >
              Notas (opcional)
            </Label>
            <Textarea
              id="session-desc"
              value={sessionDescription}
              onChange={(e) => setSessionDescription(e.target.value)}
              placeholder="Notas para el operador..."
              className="resize-none"
              rows={3}
              style={{
                backgroundColor: CASA_BRAND.colors.primary.black,
                borderColor: CASA_BRAND.colors.secondary.grayDark,
                color: CASA_BRAND.colors.primary.white,
              }}
            />
          </div>

          {/* Save summary */}
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
              Se guardará:
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
                Posición actual de la presentación
              </li>
            </ul>
          </div>

          {saveError && (
            <Alert variant="destructive">
              <AlertTriangle size={16} />
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            style={{
              borderColor: CASA_BRAND.colors.secondary.grayDark,
              color: CASA_BRAND.colors.primary.white,
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!data || !sessionName.trim() || isSaving}
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
            ) : (
              <>
                <Save size={16} className="mr-2" />
                Guardar sesión
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SaveSessionDialog;
