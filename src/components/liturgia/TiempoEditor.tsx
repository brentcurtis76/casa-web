/**
 * TiempoEditor - Editor para un tiempo individual de una oración
 */

import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Pencil, Check, X } from 'lucide-react';
import { COLORS, LABELS } from './constants';
import type { Tiempo } from './types';

interface TiempoEditorProps {
  tiempo: Tiempo;
  tiempoNumero: number;
  onUpdate: (tiempo: Tiempo) => void;
  isEditing: boolean;
  onEditStart: () => void;
  onEditEnd: () => void;
}

export const TiempoEditor = ({
  tiempo,
  tiempoNumero,
  onUpdate,
  isEditing,
  onEditStart,
  onEditEnd,
}: TiempoEditorProps) => {
  const [editedLider, setEditedLider] = useState(tiempo.lider);
  const [editedCongregacion, setEditedCongregacion] = useState(tiempo.congregacion);

  const handleStartEdit = () => {
    setEditedLider(tiempo.lider);
    setEditedCongregacion(tiempo.congregacion);
    onEditStart();
  };

  const handleSave = () => {
    onUpdate({
      lider: editedLider.trim(),
      congregacion: editedCongregacion.trim(),
    });
    onEditEnd();
  };

  const handleCancel = () => {
    setEditedLider(tiempo.lider);
    setEditedCongregacion(tiempo.congregacion);
    onEditEnd();
  };

  if (isEditing) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            Tiempo {tiempoNumero}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={handleCancel}>
              <X className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} className="bg-green-600 hover:bg-green-700">
              <Check className="h-4 w-4 mr-1" />
              Guardar
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">
              {LABELS.roles.lider}
            </Label>
            <Textarea
              value={editedLider}
              onChange={(e) => setEditedLider(e.target.value)}
              rows={3}
              className="resize-none"
              style={{ color: COLORS.primary.black }}
            />
          </div>

          <div>
            <Label className="text-xs text-gray-600 mb-1 block">
              {LABELS.roles.congregacion}
            </Label>
            <Textarea
              value={editedCongregacion}
              onChange={(e) => setEditedCongregacion(e.target.value)}
              rows={2}
              className="resize-none"
              style={{ color: COLORS.primary.amber }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded-lg border border-gray-100 hover:border-gray-200 transition-colors group">
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-gray-400 mb-2 block">
          Tiempo {tiempoNumero}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleStartEdit}
          className="opacity-0 group-hover:opacity-100 transition-opacity h-7 px-2"
        >
          <Pencil className="h-3 w-3 mr-1" />
          Editar
        </Button>
      </div>

      <div className="space-y-3">
        {/* Texto del líder */}
        <div>
          <p className="text-xs text-gray-500 mb-1">{LABELS.roles.lider}:</p>
          <p
            className="text-sm leading-relaxed"
            style={{ color: COLORS.primary.black }}
          >
            {tiempo.lider}
          </p>
        </div>

        {/* Separador visual */}
        <div className="flex items-center justify-center py-1">
          <div
            className="w-12 h-px"
            style={{ backgroundColor: COLORS.secondary.lightGray }}
          />
          <div
            className="w-2 h-2 rounded-full mx-2"
            style={{ backgroundColor: COLORS.primary.amber }}
          />
          <div
            className="w-12 h-px"
            style={{ backgroundColor: COLORS.secondary.lightGray }}
          />
        </div>

        {/* Texto de la congregación */}
        <div>
          <p className="text-xs text-gray-500 mb-1">{LABELS.roles.congregacion}:</p>
          <p
            className="text-sm font-semibold"
            style={{ color: COLORS.primary.amber }}
          >
            {tiempo.congregacion}
          </p>
        </div>
      </div>
    </div>
  );
};

export default TiempoEditor;
