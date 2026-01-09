/**
 * StyleSelector - Selector de estilo de ilustración para cuentos
 */

import React from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import type { IllustrationStyle } from '@/types/shared/story';
import stylesData from '@/data/cuentacuentos/illustration-styles.json';

interface StyleSelectorProps {
  selectedStyleId: string | null;
  onSelectStyle: (styleId: string) => void;
}

const StyleSelector: React.FC<StyleSelectorProps> = ({
  selectedStyleId,
  onSelectStyle,
}) => {
  const styles = stylesData.styles as IllustrationStyle[];

  return (
    <div className="space-y-4">
      <label
        className="block"
        style={{
          fontFamily: CASA_BRAND.fonts.body,
          fontSize: '14px',
          fontWeight: 600,
          color: CASA_BRAND.colors.primary.black,
        }}
      >
        Estilo de Ilustración
      </label>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {styles.map((style) => {
          const isSelected = selectedStyleId === style.id;

          return (
            <button
              key={style.id}
              type="button"
              onClick={() => onSelectStyle(style.id)}
              className={`p-4 rounded-lg border-2 text-left transition-all hover:shadow-md ${
                isSelected ? 'ring-2 ring-offset-2' : ''
              }`}
              style={{
                borderColor: isSelected
                  ? CASA_BRAND.colors.primary.amber
                  : CASA_BRAND.colors.secondary.grayLight,
                backgroundColor: isSelected
                  ? `${CASA_BRAND.colors.amber.light}20`
                  : CASA_BRAND.colors.primary.white,
                ringColor: CASA_BRAND.colors.primary.amber,
              }}
            >
              <h4
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '14px',
                  fontWeight: 600,
                  color: CASA_BRAND.colors.primary.black,
                }}
              >
                {style.name}
              </h4>
              <p
                className="mt-1"
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '12px',
                  color: CASA_BRAND.colors.secondary.grayMedium,
                  lineHeight: 1.4,
                }}
              >
                {style.description}
              </p>
            </button>
          );
        })}
      </div>

      {selectedStyleId && (
        <p
          className="text-sm"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            color: CASA_BRAND.colors.secondary.grayMedium,
          }}
        >
          Estilo seleccionado:{' '}
          <span style={{ color: CASA_BRAND.colors.primary.amber, fontWeight: 600 }}>
            {styles.find((s) => s.id === selectedStyleId)?.name}
          </span>
        </p>
      )}
    </div>
  );
};

export default StyleSelector;
