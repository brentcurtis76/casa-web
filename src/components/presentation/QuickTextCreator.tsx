/**
 * QuickTextCreator - Form for creating quick text slides
 * Supports title + body text with optional title
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CASA_BRAND } from '@/lib/brand-kit';
import { FileText } from 'lucide-react';
import type { Slide } from '@/types/shared/slide';

interface QuickTextCreatorProps {
  onCancel: () => void;
  onCreateSlide: (slide: Slide, insertPosition: 'after' | 'end') => void;
  currentSlideIndex: number;
  totalSlides: number;
}

export const QuickTextCreator: React.FC<QuickTextCreatorProps> = ({
  onCancel,
  onCreateSlide,
  currentSlideIndex,
  totalSlides,
}) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [insertPosition, setInsertPosition] = useState<'after' | 'end'>('after');

  const handleCreate = () => {
    if (!body.trim() && !title.trim()) return;

    const slide: Slide = {
      id: `temp-text-${Date.now()}`,
      type: 'announcement',
      content: {
        primary: body.trim(),
        secondary: title.trim() || undefined,
      },
      style: {
        primaryColor: CASA_BRAND.colors.primary.black,
        secondaryColor: CASA_BRAND.colors.primary.amber,
        backgroundColor: CASA_BRAND.colors.primary.white,
        primaryFont: CASA_BRAND.fonts.body,
        secondaryFont: CASA_BRAND.fonts.heading,
      },
      metadata: {
        sourceComponent: 'quick-add-text',
        sourceId: `temp-${Date.now()}`,
        order: 0,
        groupTotal: 1,
      },
    };

    onCreateSlide(slide, insertPosition);
  };

  const isValid = body.trim().length > 0 || title.trim().length > 0;
  const isLongText = body.length > 300;

  return (
    <div className="space-y-4 p-4">
      {/* Title input (optional) */}
      <div className="space-y-2">
        <Label
          htmlFor="title"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            color: CASA_BRAND.colors.primary.white,
          }}
        >
          Título (opcional)
        </Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ej: Anuncio Importante"
          style={{
            backgroundColor: CASA_BRAND.colors.primary.black,
            borderColor: CASA_BRAND.colors.secondary.grayDark,
            color: CASA_BRAND.colors.primary.white,
          }}
        />
      </div>

      {/* Body textarea */}
      <div className="space-y-2">
        <Label
          htmlFor="body"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            color: CASA_BRAND.colors.primary.white,
          }}
        >
          Contenido
        </Label>
        <Textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escribe el mensaje..."
          rows={4}
          style={{
            backgroundColor: CASA_BRAND.colors.primary.black,
            borderColor: CASA_BRAND.colors.secondary.grayDark,
            color: CASA_BRAND.colors.primary.white,
            resize: 'none',
          }}
        />
        {isLongText && (
          <p
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '12px',
              color: CASA_BRAND.colors.primary.amber,
            }}
          >
            ⚠️ Texto largo - puede no caber bien en la diapositiva
          </p>
        )}
      </div>

      {/* Preview */}
      {isValid && (
        <div
          className="p-4 rounded-lg"
          style={{
            backgroundColor: CASA_BRAND.colors.primary.white,
            border: `1px solid ${CASA_BRAND.colors.secondary.grayLight}`,
          }}
        >
          {title && (
            <h3
              style={{
                fontFamily: CASA_BRAND.fonts.heading,
                color: CASA_BRAND.colors.primary.amber,
                fontSize: '16px',
                fontWeight: 600,
                marginBottom: '8px',
              }}
            >
              {title}
            </h3>
          )}
          <p
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              color: CASA_BRAND.colors.primary.black,
              fontSize: '14px',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
            }}
          >
            {body.length > 200 ? `${body.slice(0, 200)}...` : body || '(sin contenido)'}
          </p>
        </div>
      )}

      {/* Insert position */}
      <div className="space-y-2">
        <Label
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            color: CASA_BRAND.colors.primary.white,
          }}
        >
          Insertar
        </Label>
        <RadioGroup
          value={insertPosition}
          onValueChange={(v) => setInsertPosition(v as 'after' | 'end')}
          className="flex gap-4"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="after" id="after-text" />
            <Label
              htmlFor="after-text"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                color: CASA_BRAND.colors.secondary.grayLight,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Después de slide {currentSlideIndex + 1}
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="end" id="end-text" />
            <Label
              htmlFor="end-text"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                color: CASA_BRAND.colors.secondary.grayLight,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Al final ({totalSlides})
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          onClick={handleCreate}
          disabled={!isValid}
          className="gap-2"
          style={{
            backgroundColor: CASA_BRAND.colors.primary.amber,
            color: CASA_BRAND.colors.primary.black,
          }}
          aria-label="Agregar texto"
        >
          <FileText size={16} />
          Agregar
        </Button>
      </div>
    </div>
  );
};

export default QuickTextCreator;
