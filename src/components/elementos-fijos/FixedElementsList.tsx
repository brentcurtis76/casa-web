/**
 * FixedElementsList - Lista de todos los elementos fijos disponibles
 * Permite seleccionar elementos para agregar a la liturgia
 */

import React, { useState, useEffect } from 'react';
import { FixedElement, FixedElementsIndex } from '@/types/shared/fixed-elements';
import { CASA_BRAND } from '@/lib/brand-kit';
import { BookOpen, Heart, Cross, Gift, Hand, Star } from 'lucide-react';

// Importar datos de elementos fijos
import indexData from '@/data/elementos-fijos/index.json';
import laPazData from '@/data/elementos-fijos/la-paz.json';
import padreNuestroData from '@/data/elementos-fijos/padre-nuestro.json';
import santaCenaData from '@/data/elementos-fijos/santa-cena.json';
import accionDeGraciasData from '@/data/elementos-fijos/accion-de-gracias.json';
import ofrendaData from '@/data/elementos-fijos/ofrenda.json';
import bendicionFinalData from '@/data/elementos-fijos/bendicion-final.json';

interface FixedElementsListProps {
  onSelectElement: (element: FixedElement) => void;
  selectedElementId?: string;
}

// Mapa de elementos para carga
const elementsMap: Record<string, FixedElement> = {
  'la-paz': laPazData as FixedElement,
  'padre-nuestro': padreNuestroData as FixedElement,
  'santa-cena': santaCenaData as FixedElement,
  'accion-de-gracias': accionDeGraciasData as FixedElement,
  'ofrenda': ofrendaData as FixedElement,
  'bendicion-final': bendicionFinalData as FixedElement,
};

// Iconos para cada tipo de elemento
const getElementIcon = (type: string) => {
  const iconProps = { size: 24, strokeWidth: 1.5 };
  switch (type) {
    case 'paz':
      return <Hand {...iconProps} />;
    case 'oracion-comunitaria':
      return <BookOpen {...iconProps} />;
    case 'comunion':
      return <Cross {...iconProps} />;
    case 'eucaristia':
      return <Heart {...iconProps} />;
    case 'ofrenda':
      return <Gift {...iconProps} />;
    case 'bendicion':
      return <Star {...iconProps} />;
    default:
      return <BookOpen {...iconProps} />;
  }
};

// Descripción corta para cada elemento
const getElementDescription = (id: string): string => {
  const descriptions: Record<string, string> = {
    'la-paz': 'Momento para compartir la paz de Cristo',
    'padre-nuestro': 'Oración del Señor en comunidad',
    'santa-cena': 'Oración de humildad antes de la comunión',
    'accion-de-gracias': 'Liturgia eucarística antifonal',
    'ofrenda': 'Momento de ofrenda con cita bíblica',
    'bendicion-final': 'Bendición y envío final',
  };
  return descriptions[id] || '';
};

const FixedElementsList: React.FC<FixedElementsListProps> = ({
  onSelectElement,
  selectedElementId,
}) => {
  const [index] = useState<FixedElementsIndex>(indexData as FixedElementsIndex);

  const handleSelectElement = (elementId: string) => {
    const element = elementsMap[elementId];
    if (element) {
      onSelectElement(element);
    }
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-6">
        <h2
          style={{
            fontFamily: CASA_BRAND.fonts.heading,
            fontSize: '24px',
            fontWeight: 300,
            letterSpacing: '0.02em',
            color: CASA_BRAND.colors.primary.black,
          }}
        >
          Elementos Fijos
        </h2>
        <p
          className="mt-1"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
            color: CASA_BRAND.colors.secondary.grayMedium,
          }}
        >
          Textos litúrgicos que se repiten cada domingo
        </p>
      </div>

      {/* Lista de elementos */}
      <div className="grid gap-3">
        {index.elements.map((entry) => {
          const isSelected = selectedElementId === entry.id;

          return (
            <button
              key={entry.id}
              onClick={() => handleSelectElement(entry.id)}
              className={`w-full text-left p-4 rounded-lg border transition-all hover:shadow-md ${
                isSelected ? 'ring-2' : ''
              }`}
              style={{
                borderColor: isSelected
                  ? CASA_BRAND.colors.primary.amber
                  : CASA_BRAND.colors.secondary.grayLight,
                backgroundColor: CASA_BRAND.colors.primary.white,
                ringColor: CASA_BRAND.colors.primary.amber,
              }}
            >
              <div className="flex items-start gap-4">
                {/* Icono */}
                <div
                  className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: isSelected
                      ? CASA_BRAND.colors.primary.amber
                      : CASA_BRAND.colors.secondary.grayLight,
                    color: isSelected
                      ? CASA_BRAND.colors.primary.white
                      : CASA_BRAND.colors.secondary.grayDark,
                  }}
                >
                  {getElementIcon(entry.type)}
                </div>

                {/* Contenido */}
                <div className="flex-1 min-w-0">
                  <h3
                    style={{
                      fontFamily: CASA_BRAND.fonts.heading,
                      fontSize: '18px',
                      fontWeight: 400,
                      color: CASA_BRAND.colors.primary.black,
                    }}
                  >
                    {entry.title}
                  </h3>
                  <p
                    className="mt-1"
                    style={{
                      fontFamily: CASA_BRAND.fonts.body,
                      fontSize: '13px',
                      color: CASA_BRAND.colors.secondary.grayMedium,
                    }}
                  >
                    {getElementDescription(entry.id)}
                  </p>
                  <span
                    className="inline-block mt-2 px-2 py-1 rounded-full text-xs"
                    style={{
                      backgroundColor: CASA_BRAND.colors.secondary.grayLight,
                      color: CASA_BRAND.colors.secondary.grayDark,
                      fontFamily: CASA_BRAND.fonts.body,
                    }}
                  >
                    {entry.slideCount} slides
                  </span>
                </div>

                {/* Indicador de selección */}
                {isSelected && (
                  <div
                    className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: CASA_BRAND.colors.primary.amber }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer info */}
      <div
        className="mt-6 pt-4 border-t text-center"
        style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
      >
        <p
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '12px',
            color: CASA_BRAND.colors.secondary.grayMedium,
          }}
        >
          {index.total} elementos disponibles
        </p>
      </div>
    </div>
  );
};

export default FixedElementsList;
