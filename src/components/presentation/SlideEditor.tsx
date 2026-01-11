/**
 * SlideEditor - Modal para editar contenido de slide temporalmente
 * Los cambios son solo de sesión y no se guardan en la base de datos
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CASA_BRAND } from '@/lib/brand-kit';
import { RotateCcw, Save, X } from 'lucide-react';
import type { Slide } from '@/types/shared/slide';
import type { TempSlideEdit } from '@/lib/presentation/types';

interface SlideEditorProps {
  open: boolean;
  onClose: () => void;
  slide: Slide | null;
  tempEdit?: TempSlideEdit;
  onSave: (content: TempSlideEdit['content']) => void;
  onClear: () => void;
}

export const SlideEditor: React.FC<SlideEditorProps> = ({
  open,
  onClose,
  slide,
  tempEdit,
  onSave,
  onClear,
}) => {
  const [primary, setPrimary] = useState('');
  const [secondary, setSecondary] = useState('');
  const [subtitle, setSubtitle] = useState('');

  // Cargar valores cuando cambia el slide
  useEffect(() => {
    if (slide) {
      setPrimary(tempEdit?.content?.primary ?? slide.content.primary ?? '');
      setSecondary(tempEdit?.content?.secondary ?? slide.content.secondary ?? '');
      setSubtitle(tempEdit?.content?.subtitle ?? slide.content.subtitle ?? '');
    }
  }, [slide, tempEdit, open]);

  if (!slide) return null;

  const hasChanges =
    primary !== (slide.content.primary ?? '') ||
    secondary !== (slide.content.secondary ?? '') ||
    subtitle !== (slide.content.subtitle ?? '');

  const hasEdit = !!tempEdit?.content;

  const handleSave = () => {
    const content: TempSlideEdit['content'] = {};

    // Solo guardar campos que cambiaron respecto al original
    if (primary !== (slide.content.primary ?? '')) {
      content.primary = primary;
    }
    if (secondary !== (slide.content.secondary ?? '')) {
      content.secondary = secondary;
    }
    if (subtitle !== (slide.content.subtitle ?? '')) {
      content.subtitle = subtitle;
    }

    if (Object.keys(content).length > 0) {
      onSave(content);
    } else {
      onClear();
    }
    onClose();
  };

  const handleReset = () => {
    setPrimary(slide.content.primary ?? '');
    setSecondary(slide.content.secondary ?? '');
    setSubtitle(slide.content.subtitle ?? '');
    onClear();
  };

  // Determinar qué campos mostrar según el tipo de slide
  const showSecondary = ['prayer-full', 'prayer-response'].includes(slide.type) || slide.content.secondary;
  const showSubtitle = ['title', 'song-title', 'reading'].includes(slide.type) || slide.content.subtitle;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-2xl"
        style={{
          backgroundColor: CASA_BRAND.colors.secondary.carbon,
          border: `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
        }}
      >
        <DialogHeader>
          <DialogTitle
            style={{
              fontFamily: CASA_BRAND.fonts.heading,
              color: CASA_BRAND.colors.primary.white,
            }}
          >
            Editar Slide
            {hasEdit && (
              <span
                className="ml-2 px-2 py-0.5 text-xs rounded"
                style={{
                  backgroundColor: CASA_BRAND.colors.primary.amber + '30',
                  color: CASA_BRAND.colors.primary.amber,
                }}
              >
                Editado
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Tipo de slide info */}
          <div
            className="text-xs px-2 py-1 rounded inline-block"
            style={{
              backgroundColor: CASA_BRAND.colors.primary.black,
              color: CASA_BRAND.colors.secondary.grayMedium,
            }}
          >
            Tipo: {slide.type}
          </div>

          {/* Texto principal */}
          <div className="space-y-2">
            <Label
              style={{
                color: CASA_BRAND.colors.primary.white,
                fontFamily: CASA_BRAND.fonts.body,
              }}
            >
              Texto Principal
            </Label>
            <Textarea
              value={primary}
              onChange={(e) => setPrimary(e.target.value)}
              rows={4}
              className="resize-none"
              style={{
                backgroundColor: CASA_BRAND.colors.primary.black,
                color: CASA_BRAND.colors.primary.white,
                borderColor: CASA_BRAND.colors.secondary.grayDark,
                fontFamily: CASA_BRAND.fonts.body,
              }}
            />
            {tempEdit?.content?.primary && (
              <p
                className="text-xs"
                style={{ color: CASA_BRAND.colors.primary.amber }}
              >
                Original: {slide.content.primary?.substring(0, 50)}...
              </p>
            )}
          </div>

          {/* Texto secundario */}
          {showSecondary && (
            <div className="space-y-2">
              <Label
                style={{
                  color: CASA_BRAND.colors.primary.white,
                  fontFamily: CASA_BRAND.fonts.body,
                }}
              >
                Texto Secundario / Respuesta
              </Label>
              <Textarea
                value={secondary}
                onChange={(e) => setSecondary(e.target.value)}
                rows={3}
                className="resize-none"
                style={{
                  backgroundColor: CASA_BRAND.colors.primary.black,
                  color: CASA_BRAND.colors.primary.white,
                  borderColor: CASA_BRAND.colors.secondary.grayDark,
                  fontFamily: CASA_BRAND.fonts.body,
                }}
              />
            </div>
          )}

          {/* Subtítulo */}
          {showSubtitle && (
            <div className="space-y-2">
              <Label
                style={{
                  color: CASA_BRAND.colors.primary.white,
                  fontFamily: CASA_BRAND.fonts.body,
                }}
              >
                Subtítulo
              </Label>
              <Textarea
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                rows={2}
                className="resize-none"
                style={{
                  backgroundColor: CASA_BRAND.colors.primary.black,
                  color: CASA_BRAND.colors.primary.white,
                  borderColor: CASA_BRAND.colors.secondary.grayDark,
                  fontFamily: CASA_BRAND.fonts.body,
                }}
              />
            </div>
          )}

          {/* Aviso de cambios temporales */}
          <p
            className="text-xs italic"
            style={{
              color: CASA_BRAND.colors.secondary.grayMedium,
              fontFamily: CASA_BRAND.fonts.body,
            }}
          >
            Los cambios son temporales y no se guardarán en la liturgia original.
            Se perderán al recargar la página.
          </p>
        </div>

        <DialogFooter className="gap-2">
          {hasEdit && (
            <Button
              variant="outline"
              onClick={handleReset}
              className="gap-2 hover:bg-white/10"
              style={{
                borderColor: CASA_BRAND.colors.secondary.grayMedium,
                backgroundColor: CASA_BRAND.colors.secondary.grayDark,
                color: CASA_BRAND.colors.primary.white,
              }}
            >
              <RotateCcw size={16} />
              Restaurar Original
            </Button>
          )}
          <Button
            variant="outline"
            onClick={onClose}
            className="gap-2 hover:bg-white/10"
            style={{
              borderColor: CASA_BRAND.colors.secondary.grayMedium,
              backgroundColor: CASA_BRAND.colors.secondary.grayDark,
              color: CASA_BRAND.colors.primary.white,
            }}
          >
            <X size={16} />
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges && !hasEdit}
            className="gap-2"
            style={{
              backgroundColor: CASA_BRAND.colors.primary.amber,
              color: CASA_BRAND.colors.primary.black,
            }}
          >
            <Save size={16} />
            Guardar Cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SlideEditor;
