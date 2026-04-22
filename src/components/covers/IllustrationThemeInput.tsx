/**
 * IllustrationThemeInput — shared text input used by Portadas.tsx and
 * CoverArtGenerator.tsx to collect an optional illustration-theme override
 * that flows into Gemini's cover prompt as the illustration subject.
 *
 * The two consumers historically rendered this block with different
 * treatments — Portadas used a bordered card with inline CASA_BRAND tokens,
 * CoverArtGenerator used a borderless stack with shadcn tokens. Both are
 * preserved here via the `variant` prop so the extraction does not
 * regress either screen's visual design.
 */

import React from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';

type Variant = 'card' | 'plain';

interface IllustrationThemeInputProps {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  /** Helper caption below the input. Defaults to the generic liturgy-flavoured copy. */
  helpText?: string;
  /**
   * 'card'  — bordered card with CASA_BRAND inline styles (Portadas look, default).
   * 'plain' — borderless stack with shadcn tokens (sermon-editor look, preserved
   *           so extraction does not alter the CoverArtGenerator UI).
   */
  variant?: Variant;
}

const DEFAULT_HELP_TEXT =
  'Describe en español lo que quieres ver. Deja vacío para usar el tema litúrgico de la temporada.';

const PLACEHOLDER = 'Ej: pescadores en un bote, manos orando, paloma volando...';
const LABEL = '¿Qué ilustración quieres?';
const MAX_LENGTH = 200;

export function IllustrationThemeInput({
  value,
  onChange,
  disabled,
  helpText = DEFAULT_HELP_TEXT,
  variant = 'card',
}: IllustrationThemeInputProps) {
  if (variant === 'plain') {
    // Preserves the original CoverArtGenerator styling: shadcn tokens
    // (text-sm, text-foreground, border-input, bg-background, text-muted-foreground),
    // no outer card, no CASA_BRAND inline overrides.
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">{LABEL}</label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={PLACEHOLDER}
          maxLength={MAX_LENGTH}
          disabled={disabled}
          // Keeps the original Tailwind amber-500 ring for this variant; the
          // sermon-editor chrome is built around Tailwind defaults so a CASA
          // brand hex would be a stylistic mismatch here.
          className="w-full p-3 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        <p className="text-xs text-muted-foreground">{helpText}</p>
      </div>
    );
  }

  // 'card' variant (Portadas): bordered card with CASA_BRAND inline styles.
  return (
    <div
      className="rounded-lg border p-4"
      style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
    >
      <label
        className="block mb-2"
        style={{
          fontFamily: CASA_BRAND.fonts.body,
          fontSize: '14px',
          fontWeight: 500,
          color: CASA_BRAND.colors.primary.black,
        }}
      >
        {LABEL}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={PLACEHOLDER}
        maxLength={MAX_LENGTH}
        disabled={disabled}
        // focus:ring-[#D4A853] uses CASA Ámbar (primary.amber) via Tailwind
        // arbitrary value — Tailwind's amber-500 (#F59E0B) is off-brand for
        // the Portadas chrome, which is CASA_BRAND-tokenized throughout.
        className="w-full p-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#D4A853]"
        style={{
          fontFamily: CASA_BRAND.fonts.body,
          fontSize: '14px',
          borderColor: CASA_BRAND.colors.secondary.grayLight,
          color: CASA_BRAND.colors.primary.black,
        }}
      />
      <p
        className="mt-2 text-xs"
        style={{
          fontFamily: CASA_BRAND.fonts.body,
          color: CASA_BRAND.colors.secondary.grayMedium,
        }}
      >
        {helpText}
      </p>
    </div>
  );
}
