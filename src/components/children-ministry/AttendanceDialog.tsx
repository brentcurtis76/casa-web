/**
 * AttendanceDialog — Dialog for recording class attendance
 * Dynamic list of children with present/absent checkboxes
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { getAttendance, markAttendance, updateAttendance, deleteAttendance } from '@/lib/children-ministry/attendanceService';
import type { ChildrenAttendanceRow, ChildrenAttendanceInsert } from '@/types/childrenMinistry';

interface AttendanceDialogProps {
  calendarId: string;
  ageGroupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface AttendanceEntry {
  id?: string;
  child_name: string;
  is_present: boolean;
  isNew?: boolean;
}

const AttendanceDialog = ({
  calendarId,
  ageGroupId,
  open,
  onOpenChange,
  onSuccess,
}: AttendanceDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);

  // Load existing attendance records
  useEffect(() => {
    if (calendarId && open) {
      const loadAttendance = async () => {
        setLoading(true);
        try {
          const records = await getAttendance(calendarId);
          setEntries(
            records.map((r) => ({
              id: r.id,
              child_name: r.child_name,
              is_present: r.is_present,
              isNew: false,
            }))
          );
        } catch (error) {
          toast({
            title: 'Error',
            description: 'No se pudo cargar la asistencia',
            variant: 'destructive',
          });
        } finally {
          setLoading(false);
        }
      };

      loadAttendance();
    }
  }, [calendarId, open, toast]);

  const handleAddChild = () => {
    setEntries([...entries, { child_name: '', is_present: true, isNew: true }]);
  };

  const handleUpdateEntry = (index: number, field: keyof AttendanceEntry, value: unknown) => {
    const newEntries = [...entries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    setEntries(newEntries);
  };

  const handleRemoveEntry = (index: number) => {
    const entry = entries[index];
    if (entry.id && !entry.isNew) {
      // Mark for deletion but keep in list for UI consistency
      const newEntries = [...entries];
      newEntries.splice(index, 1);
      setEntries(newEntries);
    } else {
      // Just remove from list if it's a new entry
      setEntries(entries.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate that at least one child has a name
    const validEntries = entries.filter((e) => e.child_name.trim());
    if (validEntries.length === 0) {
      toast({
        title: 'Error',
        description: 'Ingresa al menos un niño/a',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      // Separate new entries from existing ones
      const newEntries = validEntries.filter((e) => e.isNew);
      const existingEntries = validEntries.filter((e) => !e.isNew);

      // Insert new attendance records
      if (newEntries.length > 0) {
        const attendanceInserts: ChildrenAttendanceInsert[] = newEntries.map((entry) => ({
          calendar_id: calendarId,
          child_name: entry.child_name.trim(),
          age_group_id: ageGroupId || null,
          is_present: entry.is_present,
        }));
        await markAttendance(attendanceInserts);
      }

      // Update existing attendance records
      for (const entry of existingEntries) {
        if (entry.id) {
          await updateAttendance(entry.id, { is_present: entry.is_present });
        }
      }

      toast({
        title: 'Éxito',
        description: 'Asistencia registrada correctamente',
      });

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast({
        title: 'Error',
        description: `Error al guardar: ${error instanceof Error ? error.message : 'desconocido'}`,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Asistencia</DialogTitle>
          <DialogDescription>
            Marca a los niños/as presentes en esta clase
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Attendance entries list */}
            <div className="space-y-2">
              {entries.length === 0 ? (
                <p className="text-sm text-gray-500">Sin registros aún</p>
              ) : (
                entries.map((entry, index) => (
                  <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                    <Checkbox
                      id={`present-${index}`}
                      checked={entry.is_present}
                      onCheckedChange={(checked) =>
                        handleUpdateEntry(index, 'is_present', checked)
                      }
                    />
                    <Input
                      type="text"
                      placeholder="Nombre del niño/a"
                      value={entry.child_name}
                      onChange={(e) => handleUpdateEntry(index, 'child_name', e.target.value)}
                      className="flex-1 text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveEntry(index)}
                    >
                      <Trash2 className="h-4 w-4 text-gray-400" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            {/* Add child button */}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleAddChild}
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar Niño/a
            </Button>

            {/* Submit actions */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Asistencia
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AttendanceDialog;
