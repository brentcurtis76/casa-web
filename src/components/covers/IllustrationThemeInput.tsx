/**
 * IllustrationThemeInput — shared text input used by Portadas.tsx and
 * CoverArtGenerator.tsx to collect an optional illustration-theme override
 * that flows into Gemini's cover prompt as the illustration subject.
 *
 * Extracted from the pixel-identical blocks previously duplicated across
 * both components. Keeps Spanish copy consistent.
 */

import React from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';

interface IllustrationThemeInputProps {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  /** Helper caption below the input. Defaults to the generic liturgy-flavoured copy. */
  helpText?: string;
}

const DEFAULT_HELP_TEXT =
  'Describe en español lo que quieres ver. Deja vacío para usar el tema litúrgico de la temporada.';

export function IllustrationThemeInput({
  value,
  onChange,
  disabled,
  helpText = DEFAULT_HELP_TEXT,
}: IllustrationThemeInputProps) {
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
        ¿Qué ilustración quieres?
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ej: pescadores en un bote, manos orando, paloma volando..."
        maxLength={200}
        disabled={disabled}
        className="w-full p-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-amber-500"
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
