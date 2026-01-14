/**
 * ElementSelectorModal - Modal para seleccionar múltiples elementos
 * Usado por ApplyScopeDropdown para aplicar overlays a elementos específicos
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check } from 'lucide-react';
import { CASA_BRAND } from '@/lib/brand-kit';
import type { FlattenedElement } from '@/lib/presentation/types';
import { Music, BookOpen, Hand, Church, Gift, Megaphone, Heart, Image } from 'lucide-react';

interface ElementSelectorModalProps {
  /** Si el modal está abierto */
  open: boolean;
  /** Callback para cerrar el modal */
  onClose: () => void;
  /** Lista de elementos disponibles */
  elements: FlattenedElement[];
  /** Callback cuando se seleccionan elementos */
  onSelect: (elementIds: string[]) => void;
  /** IDs pre-seleccionados */
  initialSelected?: string[];
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

export const ElementSelectorModal: React.FC<ElementSelectorModalProps> = ({
  open,
  onClose,
  elements,
  onSelect,
  initialSelected = [],
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelected);
  const [wasOpen, setWasOpen] = useState(false);

  // Reset selection only when modal first opens (not on every render)
  React.useEffect(() => {
    if (open && !wasOpen) {
      // Modal just opened - use current initialSelected
      setSelectedIds(initialSelected);
    }
    setWasOpen(open);
  }, [open, initialSelected]);

  // Toggle selection
  const toggleElement = (elementId: string) => {
    setSelectedIds((prev) =>
      prev.includes(elementId)
        ? prev.filter((id) => id !== elementId)
        : [...prev, elementId]
    );
  };

  // Select all
  const selectAll = () => {
    setSelectedIds(elements.map((e) => e.id));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedIds([]);
  };

  // Handle apply
  const handleApply = () => {
    onSelect(selectedIds);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        className="max-w-md"
        style={{
          backgroundColor: CASA_BRAND.colors.secondary.carbon,
          border: `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
        }}
      >
        <DialogHeader>
          <DialogTitle
            style={{
              fontFamily: CASA_BRAND.fonts.heading,
              color: CASA_BRAND.colors.primary.white,
            }}
          >
            Seleccionar Elementos
          </DialogTitle>
          <DialogDescription
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              color: CASA_BRAND.colors.secondary.grayMedium,
            }}
          >
            Selecciona los elementos donde quieres aplicar el overlay
          </DialogDescription>
        </DialogHeader>

        {/* Quick actions */}
        <div className="flex gap-2 mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={selectAll}
            className="hover:bg-gray-700 hover:text-white"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '12px',
              color: CASA_BRAND.colors.primary.white,
            }}
          >
            Seleccionar todos
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearSelection}
            disabled={selectedIds.length === 0}
            className="hover:bg-gray-700 hover:text-white disabled:opacity-50"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '12px',
              color: CASA_BRAND.colors.primary.white,
            }}
          >
            Limpiar
          </Button>
        </div>

        {/* Elements list */}
        <ScrollArea className="max-h-72">
          <div className="space-y-1 pr-4">
            {elements.map((element) => {
              const Icon = getElementIcon(element.type);
              const isSelected = selectedIds.includes(element.id);

              return (
                <div
                  key={element.id}
                  onClick={() => toggleElement(element.id)}
                  className="flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors hover:bg-white/5"
                  style={{
                    backgroundColor: isSelected
                      ? CASA_BRAND.colors.primary.amber + '15'
                      : 'transparent',
                  }}
                >
                  {/* Custom checkbox */}
                  <div
                    className="h-4 w-4 shrink-0 rounded-sm border flex items-center justify-center"
                    style={{
                      borderColor: isSelected ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.secondary.grayMedium,
                      backgroundColor: isSelected ? CASA_BRAND.colors.primary.amber : 'transparent',
                    }}
                  >
                    {isSelected && <Check size={12} style={{ color: CASA_BRAND.colors.primary.black }} />}
                  </div>
                  <Icon
                    size={16}
                    style={{
                      color: isSelected
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
                        color: isSelected
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
                </div>
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
                No hay elementos disponibles
              </p>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button
            variant="ghost"
            onClick={onClose}
            style={{ fontFamily: CASA_BRAND.fonts.body }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleApply}
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              backgroundColor: CASA_BRAND.colors.primary.amber,
              color: CASA_BRAND.colors.primary.black,
            }}
          >
            {selectedIds.length === 0
              ? 'Aplicar a ninguno'
              : `Aplicar a ${selectedIds.length} elemento${selectedIds.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ElementSelectorModal;
