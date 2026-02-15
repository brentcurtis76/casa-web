/**
 * AvailabilityEditor — 7-day grid for setting volunteer availability
 * Shows switches for each day of the week
 */

import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  getRecurringAvailability,
  setRecurringAvailability,
} from '@/lib/children-ministry/volunteerService';
import type { ChildrenRecurringAvailabilityRow } from '@/types/childrenMinistry';

interface AvailabilityEditorProps {
  volunteerId: string;
  readOnly?: boolean;
}

const AvailabilityEditor = ({ volunteerId, readOnly = false }: AvailabilityEditorProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [availability, setAvailability] = useState<Map<number, ChildrenRecurringAvailabilityRow>>(
    new Map()
  );

  const dayNames = [
    'Domingo',
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
  ];

  // Load availability on mount
  useEffect(() => {
    const loadAvailability = async () => {
      setLoading(true);
      try {
        const records = await getRecurringAvailability(volunteerId);
        const map = new Map<number, ChildrenRecurringAvailabilityRow>();
        records.forEach((record) => {
          map.set(record.day_of_week, record);
        });
        setAvailability(map);
      } catch (error) {
        toast({
          title: 'Error',
          description: 'No se pudo cargar la disponibilidad',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadAvailability();
  }, [volunteerId, toast]);

  const handleToggle = async (dayOfWeek: number) => {
    if (readOnly) return;

    const currentRecord = availability.get(dayOfWeek);
    const newIsAvailable = !currentRecord?.is_available;

    try {
      if (currentRecord) {
        // For existing records, delete then insert to avoid unique constraint
        await supabase
          .from('church_children_recurring_availability')
          .delete()
          .eq('id', currentRecord.id);

        const today = new Date().toISOString().split('T')[0];
        const created = await setRecurringAvailability({
          volunteer_id: volunteerId,
          day_of_week: dayOfWeek,
          is_available: newIsAvailable,
          effective_from: today,
          effective_until: null,
        });
        setAvailability((prev) => new Map(prev).set(dayOfWeek, created));
      } else {
        // Insert new record
        const today = new Date().toISOString().split('T')[0];
        const created = await setRecurringAvailability({
          volunteer_id: volunteerId,
          day_of_week: dayOfWeek,
          is_available: newIsAvailable,
          effective_from: today,
          effective_until: null,
        });
        setAvailability((prev) => new Map(prev).set(dayOfWeek, created));
      }

      toast({
        title: 'Éxito',
        description: 'Disponibilidad actualizada',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: `Error al actualizar: ${error instanceof Error ? error.message : 'desconocido'}`,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900">Disponibilidad Semanal</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {dayNames.map((dayName, dayOfWeek) => {
          const record = availability.get(dayOfWeek);
          const isAvailable = record?.is_available ?? false;

          return (
            <div
              key={dayOfWeek}
              className="flex items-center justify-between p-3 bg-gray-50 rounded border"
            >
              <Label htmlFor={`day-${dayOfWeek}`} className="font-medium cursor-pointer">
                {dayName}
              </Label>
              <Switch
                id={`day-${dayOfWeek}`}
                checked={isAvailable}
                onCheckedChange={() => handleToggle(dayOfWeek)}
                disabled={readOnly}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AvailabilityEditor;
