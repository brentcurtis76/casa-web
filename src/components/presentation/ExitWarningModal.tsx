/**
 * ExitWarningModal - Shows when user tries to leave the presenter view
 * Used with React Router's useBlocker to intercept navigation
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CASA_BRAND } from '@/lib/brand-kit';
import { AlertTriangle, ArrowLeft, X } from 'lucide-react';

interface ExitWarningModalProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ExitWarningModal: React.FC<ExitWarningModalProps> = ({
  open,
  onConfirm,
  onCancel,
}) => {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        style={{
          backgroundColor: CASA_BRAND.colors.secondary.carbon,
          border: `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
        }}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          onCancel();
        }}
      >
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div
              className="p-2 rounded-lg"
              style={{
                backgroundColor: '#f59e0b20',
              }}
            >
              <AlertTriangle
                size={24}
                style={{ color: '#f59e0b' }}
              />
            </div>
            <DialogTitle
              style={{
                fontFamily: CASA_BRAND.fonts.heading,
                fontSize: '18px',
                color: CASA_BRAND.colors.primary.white,
              }}
            >
              ¿Salir de la Presentación?
            </DialogTitle>
          </div>
          <DialogDescription
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              color: CASA_BRAND.colors.secondary.grayLight,
            }}
          >
            Tienes una liturgia activa. Tu progreso se guardará automáticamente
            y podrás continuar donde quedaste la próxima vez.
          </DialogDescription>
        </DialogHeader>

        {/* Info box */}
        <div
          className="rounded-lg p-4 my-4"
          style={{
            backgroundColor: CASA_BRAND.colors.primary.black,
            border: `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
          }}
        >
          <p
            className="text-sm"
            style={{
              color: CASA_BRAND.colors.secondary.grayLight,
              fontFamily: CASA_BRAND.fonts.body,
            }}
          >
            Si la ventana de salida está abierta, también se desconectará.
          </p>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex-1 gap-2"
            style={{
              backgroundColor: CASA_BRAND.colors.secondary.grayDark,
              borderColor: CASA_BRAND.colors.secondary.grayMedium,
              color: CASA_BRAND.colors.primary.white,
            }}
          >
            <X size={16} />
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            className="flex-1 gap-2"
            style={{
              backgroundColor: '#ef4444',
              color: CASA_BRAND.colors.primary.white,
            }}
          >
            <ArrowLeft size={16} />
            Salir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExitWarningModal;
