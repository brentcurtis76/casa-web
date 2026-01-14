/**
 * ApplyScopeDropdown - Dropdown para seleccionar el alcance de aplicación de overlays
 *
 * 4 opciones disponibles:
 * 1. Diapositiva Actual: scope { type: 'slide', slideIndex }
 * 2. Elemento Actual: scope { type: 'element', elementId }
 * 3. Seleccionar Elementos...: scope { type: 'elements', elementIds: [...] }
 * 4. Toda La Presentación: scope { type: 'all' }
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, CheckSquare, Globe, FileText, Layers } from 'lucide-react';
import { CASA_BRAND } from '@/lib/brand-kit';
import type { OverlayScope, FlattenedElement } from '@/lib/presentation/types';
import { ElementSelectorModal } from './ElementSelectorModal';

interface ApplyScopeDropdownProps {
  /** Lista de elementos de la presentación */
  elements: FlattenedElement[];
  /** Elemento actual (el que contiene el slide actual) */
  currentElement: FlattenedElement | null;
  /** Índice del slide actual */
  currentSlideIndex: number;
  /** Callback cuando se selecciona un scope */
  onApply: (scope: OverlayScope) => void;
  /** Scope activo actual (para pre-seleccionar elementos en el modal) */
  currentScope?: OverlayScope;
  /** Texto del botón (por defecto "Aplicar a...") */
  buttonText?: string;
  /** Si el botón está deshabilitado */
  disabled?: boolean;
  /** Variante del botón */
  variant?: 'default' | 'outline' | 'ghost';
  /** Si es compacto (para paneles estrechos) */
  compact?: boolean;
}

export const ApplyScopeDropdown: React.FC<ApplyScopeDropdownProps> = ({
  elements,
  currentElement,
  currentSlideIndex,
  onApply,
  currentScope,
  buttonText = 'Aplicar a...',
  disabled = false,
  variant = 'default',
  compact = false,
}) => {
  const [selectorOpen, setSelectorOpen] = useState(false);

  // Extraer los elementIds del scope actual para pre-seleccionar en el modal
  const getInitialSelectedIds = (): string[] => {
    if (!currentScope) return [];
    if (currentScope.type === 'elements') {
      return currentScope.elementIds;
    }
    if (currentScope.type === 'element' && currentScope.elementId) {
      return [currentScope.elementId];
    }
    // Para 'all', seleccionar todos los elementos
    if (currentScope.type === 'all') {
      return elements.map((e) => e.id);
    }
    return [];
  };

  // Manejar selección de elementos múltiples
  const handleElementsSelected = (elementIds: string[]) => {
    if (elementIds.length === elements.length) {
      // Si seleccionó todos, usar scope 'all'
      onApply({ type: 'all' });
    } else {
      // Elementos seleccionados (puede ser 0 o más)
      onApply({ type: 'elements', elementIds });
    }
    setSelectorOpen(false);
  };

  // Handler para "Diapositiva Actual"
  const handleCurrentSlide = () => {
    onApply({ type: 'slide', slideIndex: currentSlideIndex });
  };

  // Handler para "Elemento Actual"
  const handleCurrentElement = () => {
    if (currentElement) {
      onApply({ type: 'element', elementId: currentElement.id });
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={variant}
            disabled={disabled}
            className={compact ? 'h-8 px-3 text-sm w-full' : ''}
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              ...(variant === 'outline' && {
                borderColor: CASA_BRAND.colors.secondary.grayMedium,
                backgroundColor: CASA_BRAND.colors.secondary.grayDark,
                color: CASA_BRAND.colors.primary.white,
              }),
            }}
          >
            {buttonText}
            <ChevronDown size={16} className="ml-2" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-56"
          style={{
            backgroundColor: CASA_BRAND.colors.secondary.carbon,
            border: `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
          }}
        >
          {/* 1. Diapositiva Actual */}
          <DropdownMenuItem
            onClick={handleCurrentSlide}
            className="cursor-pointer focus:bg-gray-700 focus:text-white hover:bg-gray-700 hover:text-white"
            style={{ color: CASA_BRAND.colors.primary.white }}
          >
            <FileText size={16} className="mr-2" style={{ color: CASA_BRAND.colors.secondary.grayMedium }} />
            <span style={{ fontFamily: CASA_BRAND.fonts.body }}>
              Diapositiva actual
            </span>
          </DropdownMenuItem>

          {/* 2. Elemento Actual */}
          <DropdownMenuItem
            onClick={handleCurrentElement}
            disabled={!currentElement}
            className="cursor-pointer focus:bg-gray-700 focus:text-white hover:bg-gray-700 hover:text-white disabled:opacity-50"
            style={{ color: CASA_BRAND.colors.primary.white }}
          >
            <Layers size={16} className="mr-2" style={{ color: CASA_BRAND.colors.secondary.grayMedium }} />
            <span style={{ fontFamily: CASA_BRAND.fonts.body }}>
              Elemento actual
            </span>
          </DropdownMenuItem>

          <DropdownMenuSeparator style={{ backgroundColor: CASA_BRAND.colors.secondary.grayDark }} />

          {/* 3. Seleccionar elementos */}
          <DropdownMenuItem
            onClick={() => setSelectorOpen(true)}
            className="cursor-pointer focus:bg-gray-700 focus:text-white hover:bg-gray-700 hover:text-white"
            style={{ color: CASA_BRAND.colors.primary.white }}
          >
            <CheckSquare size={16} className="mr-2" style={{ color: CASA_BRAND.colors.secondary.grayMedium }} />
            <span style={{ fontFamily: CASA_BRAND.fonts.body }}>
              Seleccionar elementos...
            </span>
          </DropdownMenuItem>

          <DropdownMenuSeparator style={{ backgroundColor: CASA_BRAND.colors.secondary.grayDark }} />

          {/* 4. Toda la presentación */}
          <DropdownMenuItem
            onClick={() => onApply({ type: 'all' })}
            className="cursor-pointer focus:bg-gray-700 focus:text-white hover:bg-gray-700 hover:text-white"
            style={{ color: CASA_BRAND.colors.primary.white }}
          >
            <Globe size={16} className="mr-2" style={{ color: CASA_BRAND.colors.secondary.grayMedium }} />
            <span style={{ fontFamily: CASA_BRAND.fonts.body }}>
              Toda la presentación
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Modal de selección de elementos */}
      <ElementSelectorModal
        open={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        elements={elements}
        onSelect={handleElementsSelected}
        initialSelected={getInitialSelectedIds()}
      />
    </>
  );
};

export default ApplyScopeDropdown;
