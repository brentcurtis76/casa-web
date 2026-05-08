import React, { useId, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { CASA_BRAND } from '@/lib/brand-kit';

interface ImageRefineBoxProps {
  onRefine: (feedback: string) => Promise<void>;
  isRefining: boolean;
  refineError?: string | null;
}

const ImageRefineBox: React.FC<ImageRefineBoxProps> = ({
  onRefine,
  isRefining,
  refineError,
}) => {
  const [feedback, setFeedback] = useState('');
  const fieldId = useId();
  const errorId = `${fieldId}-error`;

  const trimmed = feedback.trim();
  const canSubmit = trimmed.length > 0 && !isRefining;

  const submit = async () => {
    if (!canSubmit) return;
    await onRefine(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className="space-y-2">
      <label
        htmlFor={fieldId}
        className="block"
        style={{
          fontFamily: CASA_BRAND.fonts.body,
          fontSize: '13px',
          fontWeight: 500,
          color: CASA_BRAND.colors.secondary.grayDark,
        }}
      >
        Ajusta la imagen con tus indicaciones
      </label>
      <textarea
        id={fieldId}
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isRefining}
        rows={3}
        placeholder="Por ejemplo: cambia el fondo a un paisaje montañoso al amanecer"
        aria-describedby={refineError ? errorId : undefined}
        className="w-full resize-y rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 disabled:opacity-60 disabled:cursor-not-allowed"
        style={{
          fontFamily: CASA_BRAND.fonts.body,
          borderColor: CASA_BRAND.colors.secondary.grayLight,
          color: CASA_BRAND.colors.primary.black,
          backgroundColor: CASA_BRAND.colors.primary.white,
        }}
      />
      <div className="flex items-center justify-between gap-3">
        <p
          id={errorId}
          aria-live="polite"
          className="text-xs"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            color: refineError
              ? CASA_BRAND.colors.amber.dark
              : CASA_BRAND.colors.secondary.grayMedium,
            minHeight: '1rem',
          }}
        >
          {refineError
            ? refineError
            : isRefining
              ? 'Refinando imagen...'
              : 'Pulsa Ctrl/Cmd + Enter para enviar'}
        </p>
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          aria-busy={isRefining}
          className="flex items-center gap-2 px-4 py-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: CASA_BRAND.colors.primary.black,
            color: CASA_BRAND.colors.primary.white,
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          {isRefining ? (
            <>
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              Refinando...
            </>
          ) : (
            <>
              <Sparkles size={14} aria-hidden="true" />
              Refinar
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ImageRefineBox;
