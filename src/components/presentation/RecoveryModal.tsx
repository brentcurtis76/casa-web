/**
 * RecoveryModal - Shows when a previous session can be recovered
 * Allows user to continue where they left off or start fresh
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
import { RotateCcw, PlayCircle, Trash2 } from 'lucide-react';
import type { SavedPresentationState } from '@/hooks/presentation/useAutoSave';
import { formatTimeSinceSave } from '@/hooks/presentation/useAutoSave';

interface RecoveryModalProps {
  open: boolean;
  savedState: SavedPresentationState;
  onRecover: () => void;
  onStartFresh: () => void;
}

export const RecoveryModal: React.FC<RecoveryModalProps> = ({
  open,
  savedState,
  onRecover,
  onStartFresh,
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
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div
              className="p-2 rounded-lg"
              style={{
                backgroundColor: CASA_BRAND.colors.primary.amber + '20',
              }}
            >
              <RotateCcw
                size={24}
                style={{ color: CASA_BRAND.colors.primary.amber }}
              />
            </div>
            <DialogTitle
              style={{
                fontFamily: CASA_BRAND.fonts.heading,
                fontSize: '18px',
                color: CASA_BRAND.colors.primary.white,
              }}
            >
              Sesión Anterior Encontrada
            </DialogTitle>
          </div>
          <DialogDescription
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              color: CASA_BRAND.colors.secondary.grayLight,
            }}
          >
            Se encontró una sesión de presentación guardada. ¿Deseas continuar
            donde quedaste?
          </DialogDescription>
        </DialogHeader>

        {/* Session details */}
        <div
          className="rounded-lg p-4 my-4"
          style={{
            backgroundColor: CASA_BRAND.colors.primary.black,
            border: `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
          }}
        >
          <div className="space-y-3">
            {/* Liturgy name */}
            <div>
              <p
                className="text-xs uppercase mb-1"
                style={{
                  color: CASA_BRAND.colors.secondary.grayMedium,
                  fontFamily: CASA_BRAND.fonts.body,
                  letterSpacing: '0.5px',
                }}
              >
                Liturgia
              </p>
              <p
                style={{
                  color: CASA_BRAND.colors.primary.white,
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                {savedState.liturgyTitle}
              </p>
            </div>

            {/* Slide number */}
            <div className="flex items-center gap-4">
              <div>
                <p
                  className="text-xs uppercase mb-1"
                  style={{
                    color: CASA_BRAND.colors.secondary.grayMedium,
                    fontFamily: CASA_BRAND.fonts.body,
                    letterSpacing: '0.5px',
                  }}
                >
                  Slide
                </p>
                <p
                  style={{
                    color: CASA_BRAND.colors.primary.amber,
                    fontFamily: CASA_BRAND.fonts.body,
                    fontSize: '14px',
                    fontWeight: 600,
                  }}
                >
                  #{(savedState.previewSlideIndex ?? savedState.currentSlideIndex ?? 0) + 1}
                </p>
              </div>

              {/* Status indicators */}
              <div>
                <p
                  className="text-xs uppercase mb-1"
                  style={{
                    color: CASA_BRAND.colors.secondary.grayMedium,
                    fontFamily: CASA_BRAND.fonts.body,
                    letterSpacing: '0.5px',
                  }}
                >
                  Estado
                </p>
                <div className="flex items-center gap-2">
                  {savedState.isLive && (
                    <span
                      className="px-2 py-0.5 rounded text-xs"
                      style={{
                        backgroundColor: '#22c55e30',
                        color: '#22c55e',
                        fontFamily: CASA_BRAND.fonts.body,
                      }}
                    >
                      LIVE
                    </span>
                  )}
                  {savedState.isBlack && (
                    <span
                      className="px-2 py-0.5 rounded text-xs"
                      style={{
                        backgroundColor: CASA_BRAND.colors.secondary.grayDark,
                        color: CASA_BRAND.colors.secondary.grayLight,
                        fontFamily: CASA_BRAND.fonts.body,
                      }}
                    >
                      BLACK
                    </span>
                  )}
                  {!savedState.isLive && !savedState.isBlack && (
                    <span
                      className="text-xs"
                      style={{
                        color: CASA_BRAND.colors.secondary.grayMedium,
                        fontFamily: CASA_BRAND.fonts.body,
                      }}
                    >
                      Pausado
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Time saved */}
            <div>
              <p
                className="text-xs uppercase mb-1"
                style={{
                  color: CASA_BRAND.colors.secondary.grayMedium,
                  fontFamily: CASA_BRAND.fonts.body,
                  letterSpacing: '0.5px',
                }}
              >
                Guardado
              </p>
              <p
                style={{
                  color: CASA_BRAND.colors.secondary.grayLight,
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '13px',
                }}
              >
                {formatTimeSinceSave(savedState.savedAt)}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={onStartFresh}
            className="flex-1 gap-2 hover:bg-white/10"
            style={{
              borderColor: CASA_BRAND.colors.secondary.grayMedium,
              backgroundColor: CASA_BRAND.colors.secondary.grayDark,
              color: CASA_BRAND.colors.primary.white,
            }}
          >
            <Trash2 size={16} />
            Empezar de Nuevo
          </Button>
          <Button
            onClick={onRecover}
            className="flex-1 gap-2"
            style={{
              backgroundColor: CASA_BRAND.colors.primary.amber,
              color: CASA_BRAND.colors.primary.black,
            }}
          >
            <PlayCircle size={16} />
            Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RecoveryModal;
