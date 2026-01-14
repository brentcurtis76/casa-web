/**
 * ServiceNavigator - Navegador de elementos de la liturgia
 * Muestra todos los elementos y permite saltar a cada uno
 */

import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CASA_BRAND } from '@/lib/brand-kit';
import type { FlattenedElement } from '@/lib/presentation/types';
import { Music, BookOpen, Hand, Church, Gift, Megaphone, Heart, Image } from 'lucide-react';

interface ServiceNavigatorProps {
  elements: FlattenedElement[];
  currentElementIndex: number;
  onElementClick: (index: number) => void;
}

// Icono por tipo de elemento
const getElementIcon = (type: string) => {
  if (type.includes('cancion')) return Music;
  if (type.includes('oracion') || type.includes('padre-nuestro')) return Hand;
  if (type.includes('lectura')) return BookOpen;
  if (type.includes('santa-cena') || type.includes('paz')) return Church;
  if (type.includes('ofrenda')) return Gift;
  if (type.includes('anuncios')) return Megaphone;
  if (type.includes('bendicion')) return Heart;
  if (type.includes('portada')) return Image;
  return BookOpen;
};

export const ServiceNavigator: React.FC<ServiceNavigatorProps> = ({
  elements,
  currentElementIndex,
  onElementClick,
}) => {
  return (
    <div
      className="h-full flex flex-col"
      style={{
        backgroundColor: CASA_BRAND.colors.secondary.carbon,
        borderRight: `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
      }}
    >
      <div
        className="px-4 py-3"
        style={{
          borderBottom: `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
        }}
      >
        <h2
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '12px',
            fontWeight: 600,
            color: CASA_BRAND.colors.secondary.grayMedium,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          Orden del Servicio
        </h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {elements.map((element, index) => {
            const isActive = index === currentElementIndex;
            const Icon = getElementIcon(element.type);

            return (
              <button
                key={element.id}
                onClick={() => onElementClick(index)}
                className="w-full text-left px-3 py-2 rounded-md transition-colors flex items-center gap-3"
                style={{
                  backgroundColor: isActive
                    ? CASA_BRAND.colors.primary.amber + '20'
                    : 'transparent',
                  borderLeft: isActive
                    ? `3px solid ${CASA_BRAND.colors.primary.amber}`
                    : '3px solid transparent',
                }}
              >
                <Icon
                  size={16}
                  style={{
                    color: isActive
                      ? CASA_BRAND.colors.primary.amber
                      : CASA_BRAND.colors.secondary.grayMedium,
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className="truncate"
                    style={{
                      fontFamily: CASA_BRAND.fonts.body,
                      fontSize: '13px',
                      fontWeight: isActive ? 600 : 400,
                      color: isActive
                        ? CASA_BRAND.colors.primary.white
                        : CASA_BRAND.colors.secondary.grayLight,
                    }}
                  >
                    {element.title}
                  </p>
                  <p
                    style={{
                      fontFamily: CASA_BRAND.fonts.body,
                      fontSize: '11px',
                      color: CASA_BRAND.colors.secondary.grayMedium,
                    }}
                  >
                    {element.slideCount} {element.slideCount === 1 ? 'slide' : 'slides'}
                  </p>
                </div>
              </button>
            );
          })}

          {elements.length === 0 && (
            <p
              className="px-3 py-4 text-center"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '13px',
                color: CASA_BRAND.colors.secondary.grayMedium,
              }}
            >
              No hay elementos en esta liturgia
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ServiceNavigator;
