/**
 * CustomElementPicker - Diálogo para seleccionar el subtipo de elemento personalizado
 */

import React from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import { ImageIcon, Type, MessageCircle, FileText, Square } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { CustomElementSubtype } from '@/types/shared/liturgy';

interface CustomElementPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (subtype: CustomElementSubtype) => void;
}

const SUBTYPE_OPTIONS: {
  subtype: CustomElementSubtype;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    subtype: 'image-slide',
    label: 'Slide de Imagen',
    description: 'Imagen de fondo con título y subtítulo superpuesto',
    icon: <ImageIcon size={24} />,
  },
  {
    subtype: 'title-slide',
    label: 'Slide de Título',
    description: 'Tarjeta de título con texto principal y subtítulo',
    icon: <Type size={24} />,
  },
  {
    subtype: 'call-response',
    label: 'Llamado y Respuesta',
    description: 'Intercambios entre líder y congregación',
    icon: <MessageCircle size={24} />,
  },
  {
    subtype: 'text-slide',
    label: 'Slide de Texto',
    description: 'Párrafo de texto para lecturas o anuncios',
    icon: <FileText size={24} />,
  },
  {
    subtype: 'blank-slide',
    label: 'Slide en Blanco',
    description: 'Transición con color de fondo personalizable',
    icon: <Square size={24} />,
  },
];

const CustomElementPicker: React.FC<CustomElementPickerProps> = ({
  open,
  onOpenChange,
  onSelect,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle
            style={{
              fontFamily: CASA_BRAND.fonts.heading,
              fontWeight: 400,
              color: CASA_BRAND.colors.primary.black,
            }}
          >
            Agregar Elemento Personalizado
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 mt-2">
          {SUBTYPE_OPTIONS.map((option) => (
            <button
              key={option.subtype}
              type="button"
              onClick={() => {
                onSelect(option.subtype);
                onOpenChange(false);
              }}
              className="w-full flex items-center gap-4 p-3 rounded-lg border transition-all hover:shadow-sm"
              style={{
                borderColor: CASA_BRAND.colors.secondary.grayLight,
                backgroundColor: CASA_BRAND.colors.primary.white,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = CASA_BRAND.colors.primary.amber;
                e.currentTarget.style.backgroundColor = `${CASA_BRAND.colors.amber.light}10`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = CASA_BRAND.colors.secondary.grayLight;
                e.currentTarget.style.backgroundColor = CASA_BRAND.colors.primary.white;
              }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: `${CASA_BRAND.colors.primary.amber}15`,
                  color: CASA_BRAND.colors.primary.amber,
                }}
              >
                {option.icon}
              </div>
              <div className="text-left">
                <p
                  style={{
                    fontFamily: CASA_BRAND.fonts.body,
                    fontSize: '14px',
                    fontWeight: 500,
                    color: CASA_BRAND.colors.primary.black,
                  }}
                >
                  {option.label}
                </p>
                <p
                  style={{
                    fontFamily: CASA_BRAND.fonts.body,
                    fontSize: '12px',
                    color: CASA_BRAND.colors.secondary.grayMedium,
                  }}
                >
                  {option.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CustomElementPicker;
