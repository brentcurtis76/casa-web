import React, { useId, useState } from 'react';
import { AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { CASA_BRAND } from '@/lib/brand-kit';

const MAX_FEEDBACK_LENGTH = 500;

interface ImageRefineBoxProps {
  /** Called with the trimmed feedback string when the user submits. */
  onRefine: (feedback: string) => Promise<void>;
  /** True while a refinement request is in flight. Disables inputs and surfaces a status. */
  isRefining: boolean;
  /** Error string from the most recent refinement attempt, if any. The parent
   *  is responsible for clearing this when appropriate; the component
   *  visually suppresses it during a fresh attempt. */
  refineError?: string | null;
}

/**
 * Surface-agnostic refinement input: textarea + submit button used to send a
 * selected image back to the model with free-text feedback. The component
 * owns no image state — the parent handles the source image and just
 * receives the feedback string via `onRefine`.
 */
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
  const showError = !!refineError && !isRefining;

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
        Pide un cambio a la imagen
      </label>
      <textarea
        id={fieldId}
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isRefining}
        rows={3}
        maxLength={MAX_FEEDBACK_LENGTH}
        placeholder="Por ejemplo: cambia el fondo a un paisaje montañoso al amanecer"
        aria-describedby={showError ? errorId : undefined}
        className="w-full resize-y rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A853] disabled:opacity-60 disabled:cursor-not-allowed"
        style={{
          fontFamily: CASA_BRAND.fonts.body,
          borderColor: CASA_BRAND.colors.secondary.grayLight,
          color: CASA_BRAND.colors.primary.black,
          backgroundColor: CASA_BRAND.colors.primary.white,
        }}
      />

      {/* Persistent hint + character counter (NOT in a live region — these are
          static helper text that should not be announced on every state change). */}
      <div
        className="flex items-center justify-between text-xs"
        style={{
          fontFamily: CASA_BRAND.fonts.body,
          color: CASA_BRAND.colors.secondary.grayMedium,
        }}
      >
        <span>Pulsa Ctrl/Cmd + Enter para enviar</span>
        {feedback.length > 0 && (
          <span aria-hidden="true">
            {feedback.length}/{MAX_FEEDBACK_LENGTH}
          </span>
        )}
      </div>

      {/* Status row (polite live region) + error row (assertive alert) +
          submit button. Status and error never display together: when
          isRefining is true, refineError is suppressed visually so the user
          isn't shown a stale error during a retry. */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-h-[1rem]">
          <p
            aria-live="polite"
            role="status"
            className="text-xs"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              color: CASA_BRAND.colors.secondary.grayMedium,
            }}
          >
            {isRefining ? 'Refinando imagen...' : ''}
          </p>
          {showError && (
            <p
              id={errorId}
              role="alert"
              className="text-xs text-red-600 flex items-center gap-1"
              style={{ fontFamily: CASA_BRAND.fonts.body }}
            >
              <AlertCircle size={12} aria-hidden="true" />
              {refineError}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          aria-busy={isRefining}
          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              Enviando...
            </>
          ) : (
            <>
              <Sparkles size={14} aria-hidden="true" />
              Enviar cambio
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ImageRefineBox;
