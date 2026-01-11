/**
 * PresenterNotes - Area de notas del presentador
 * Soporta notas por slide (prioridad) o por elemento (fallback)
 * Soporta modo compact para uso dentro de CollapsiblePanel
 */

import React from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import { FileText } from 'lucide-react';
import type { FlattenedElement } from '@/lib/presentation/types';
import type { Slide } from '@/types/shared/slide';

interface PresenterNotesProps {
  currentElement: FlattenedElement | null;
  /** Current slide - its notes take priority over element notes */
  currentSlide?: Slide | null;
  /** When true, renders without header (for use inside CollapsiblePanel) */
  compact?: boolean;
}

export const PresenterNotes: React.FC<PresenterNotesProps> = ({
  currentElement,
  currentSlide,
  compact = false,
}) => {
  // Priorizar notas del slide, luego del elemento
  const notes = currentSlide?.notes || currentElement?.notes;

  const content = (
    <div
      className="rounded-md p-3"
      style={{
        backgroundColor: CASA_BRAND.colors.primary.black,
        minHeight: '80px',
      }}
    >
      {notes ? (
        <p
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '13px',
            color: CASA_BRAND.colors.primary.white,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
          }}
        >
          {notes}
        </p>
      ) : (
        <p
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '13px',
            color: CASA_BRAND.colors.secondary.grayMedium,
            fontStyle: 'italic',
          }}
        >
          {currentElement || currentSlide
            ? 'Sin notas para este slide'
            : 'Selecciona una liturgia para ver las notas'}
        </p>
      )}
    </div>
  );

  // Compact mode: just render content without wrapper
  if (compact) {
    return content;
  }

  // Full mode: render with header and wrapper
  return (
    <div
      className="p-4"
      style={{
        backgroundColor: CASA_BRAND.colors.secondary.carbon,
        borderTop: `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <FileText
          size={14}
          style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
        />
        <h3
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '11px',
            fontWeight: 600,
            color: CASA_BRAND.colors.secondary.grayMedium,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          Notas del Presentador
        </h3>
      </div>
      {content}
    </div>
  );
};

export default PresenterNotes;
