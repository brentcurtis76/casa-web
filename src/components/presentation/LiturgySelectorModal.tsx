/**
 * LiturgySelectorModal - Modal para seleccionar una liturgia
 */

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CASA_BRAND } from '@/lib/brand-kit';
import { listLiturgiesForPresentation, type LiturgySummary } from '@/lib/presentation/presentationService';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Check, Loader2 } from 'lucide-react';

interface LiturgySelectorModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (liturgyId: string) => void;
  currentLiturgyId?: string;
}

export const LiturgySelectorModal: React.FC<LiturgySelectorModalProps> = ({
  open,
  onClose,
  onSelect,
  currentLiturgyId,
}) => {
  const [liturgies, setLiturgies] = useState<LiturgySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadLiturgies();
      setSelectedId(currentLiturgyId || null);
    }
  }, [open, currentLiturgyId]);

  const loadLiturgies = async () => {
    setLoading(true);
    try {
      const data = await listLiturgiesForPresentation();
      setLiturgies(data);
    } catch (err) {
      console.error('Error loading liturgies:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = () => {
    if (selectedId) {
      onSelect(selectedId);
      onClose();
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = parseISO(dateStr);
      return format(date, "EEEE d 'de' MMMM, yyyy", { locale: es });
    } catch {
      return dateStr;
    }
  };

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case 'listo':
        return '#22c55e';
      case 'en-progreso':
        return CASA_BRAND.colors.primary.amber;
      default:
        return CASA_BRAND.colors.secondary.grayMedium;
    }
  };

  const getStatusLabel = (estado: string) => {
    switch (estado) {
      case 'listo':
        return 'Lista';
      case 'en-progreso':
        return 'En progreso';
      case 'borrador':
        return 'Borrador';
      default:
        return estado;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="max-w-2xl"
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
            Seleccionar Liturgia
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2
              className="animate-spin"
              size={32}
              style={{ color: CASA_BRAND.colors.primary.amber }}
            />
          </div>
        ) : liturgies.length === 0 ? (
          <div className="text-center py-12">
            <Calendar
              size={48}
              className="mx-auto mb-4"
              style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
            />
            <p
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                color: CASA_BRAND.colors.secondary.grayMedium,
              }}
            >
              No hay liturgias disponibles.
              <br />
              Crea una en el Constructor de Liturgias.
            </p>
          </div>
        ) : (
          <>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {liturgies.map((liturgy) => {
                  const isSelected = selectedId === liturgy.id;

                  return (
                    <button
                      key={liturgy.id}
                      onClick={() => setSelectedId(liturgy.id)}
                      className="w-full text-left p-4 rounded-lg transition-all"
                      style={{
                        backgroundColor: isSelected
                          ? CASA_BRAND.colors.primary.amber + '20'
                          : CASA_BRAND.colors.primary.black,
                        border: isSelected
                          ? `2px solid ${CASA_BRAND.colors.primary.amber}`
                          : '2px solid transparent',
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3
                            style={{
                              fontFamily: CASA_BRAND.fonts.heading,
                              fontSize: '16px',
                              fontWeight: 600,
                              color: CASA_BRAND.colors.primary.white,
                              marginBottom: '4px',
                            }}
                          >
                            {liturgy.titulo}
                          </h3>
                          <p
                            style={{
                              fontFamily: CASA_BRAND.fonts.body,
                              fontSize: '14px',
                              color: CASA_BRAND.colors.secondary.grayLight,
                            }}
                          >
                            {formatDate(liturgy.fecha)}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span
                            className="px-2 py-1 rounded text-xs"
                            style={{
                              backgroundColor: getStatusColor(liturgy.estado) + '20',
                              color: getStatusColor(liturgy.estado),
                              fontFamily: CASA_BRAND.fonts.body,
                              fontWeight: 600,
                            }}
                          >
                            {getStatusLabel(liturgy.estado)}
                          </span>

                          {isSelected && (
                            <Check
                              size={20}
                              style={{ color: CASA_BRAND.colors.primary.amber }}
                            />
                          )}
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-3">
                        <div
                          className="h-1 rounded-full overflow-hidden"
                          style={{
                            backgroundColor: CASA_BRAND.colors.secondary.grayDark,
                          }}
                        >
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${liturgy.porcentaje}%`,
                              backgroundColor: getStatusColor(liturgy.estado),
                            }}
                          />
                        </div>
                        <p
                          className="mt-1 text-right"
                          style={{
                            fontFamily: CASA_BRAND.fonts.body,
                            fontSize: '11px',
                            color: CASA_BRAND.colors.secondary.grayMedium,
                          }}
                        >
                          {liturgy.porcentaje}% completado
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
              <Button variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleSelect}
                disabled={!selectedId}
                style={{
                  backgroundColor: CASA_BRAND.colors.primary.amber,
                  color: CASA_BRAND.colors.primary.black,
                }}
              >
                Seleccionar
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default LiturgySelectorModal;
