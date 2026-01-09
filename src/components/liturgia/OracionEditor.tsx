/**
 * OracionEditor - Editor para una oración antifonal completa
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { TiempoEditor } from './TiempoEditor';
import { COLORS, LABELS } from './constants';
import type { Oracion, Tiempo, TipoOracion } from './types';

interface OracionEditorProps {
  tipo: TipoOracion;
  oracion: Oracion;
  isApproved: boolean;
  onUpdate: (oracion: Oracion) => void;
  onApprove: () => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
}

// Iconos y colores por tipo de oración
const ORACION_CONFIG: Record<TipoOracion, { icon: string; bgColor: string; borderColor: string }> = {
  invocacion: {
    icon: '🙏',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  arrepentimiento: {
    icon: '💔',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
  gratitud: {
    icon: '✨',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
};

export const OracionEditor = ({
  tipo,
  oracion,
  isApproved,
  onUpdate,
  onApprove,
  onRegenerate,
  isRegenerating,
}: OracionEditorProps) => {
  const [editingTiempoIndex, setEditingTiempoIndex] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  const config = ORACION_CONFIG[tipo];

  const handleUpdateTiempo = (index: number, tiempo: Tiempo) => {
    const newTiempos = [...oracion.tiempos];
    newTiempos[index] = tiempo;
    onUpdate({
      ...oracion,
      tiempos: newTiempos,
    });
  };

  return (
    <Card className={`border-2 ${isApproved ? 'border-green-300 bg-green-50/30' : config.borderColor}`}>
      <CardHeader className={`${config.bgColor} border-b ${config.borderColor} py-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{config.icon}</span>
            <div>
              <CardTitle className="text-lg font-light" style={{ color: COLORS.primary.black }}>
                {LABELS.oraciones[tipo]}
              </CardTitle>
              <p className="text-xs text-gray-500 mt-0.5">
                {oracion.tiempos.length} tiempos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isApproved ? (
              <Badge className="bg-green-600 text-white">
                <Check className="h-3 w-3 mr-1" />
                {LABELS.status.approved}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-gray-500">
                {LABELS.status.pending}
              </Badge>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0"
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="p-4 space-y-4">
          {/* Tiempos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {oracion.tiempos.map((tiempo, index) => (
              <TiempoEditor
                key={index}
                tiempo={tiempo}
                tiempoNumero={index + 1}
                onUpdate={(t) => handleUpdateTiempo(index, t)}
                isEditing={editingTiempoIndex === index}
                onEditStart={() => setEditingTiempoIndex(index)}
                onEditEnd={() => setEditingTiempoIndex(null)}
              />
            ))}
          </div>

          {/* Acciones */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <Button
              variant="outline"
              size="sm"
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="text-gray-600"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRegenerating ? 'animate-spin' : ''}`} />
              {isRegenerating ? 'Regenerando...' : LABELS.buttons.regenerate}
            </Button>

            {!isApproved && (
              <Button
                size="sm"
                onClick={onApprove}
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="h-4 w-4 mr-2" />
                {LABELS.buttons.approve}
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default OracionEditor;
