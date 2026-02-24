/**
 * MeetingTypeManager — Admin: create/edit/delete meeting types
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Edit2, Trash2, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  getMeetingTypes,
  createMeetingType,
  updateMeetingType,
  deleteMeetingType,
} from '@/lib/leadership/meetingTypeService';
import MeetingTypeMemberEditor from './MeetingTypeMemberEditor';
import type { MeetingTypeRow, MeetingTypeInsert, MeetingRecurrence } from '@/types/leadershipModule';

const RECURRENCE_LABELS: Record<MeetingRecurrence, string> = {
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
  quarterly: 'Trimestral',
  annual: 'Anual',
  on_demand: 'A Demanda',
};

interface FormData {
  display_name: string;
  name: string;
  description: string;
  recurrence: MeetingRecurrence;
  color: string;
}

const defaultForm: FormData = {
  display_name: '',
  name: '',
  description: '',
  recurrence: 'monthly',
  color: '#D4A853',
};

const MeetingTypeManager = () => {
  const { toast } = useToast();
  const [meetingTypes, setMeetingTypes] = useState<MeetingTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MeetingTypeRow | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [memberEditorTypeId, setMemberEditorTypeId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMeetingTypes();
      setMeetingTypes(data);
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los tipos de reunión',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (type: MeetingTypeRow) => {
    setEditing(type);
    setForm({
      display_name: type.display_name,
      name: type.name,
      description: type.description ?? '',
      recurrence: type.recurrence,
      color: type.color ?? '#D4A853',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.display_name.trim()) return;

    setSaving(true);
    try {
      if (editing) {
        await updateMeetingType(editing.id, {
          display_name: form.display_name,
          description: form.description || null,
          recurrence: form.recurrence,
          color: form.color || null,
        });
        toast({ title: 'Éxito', description: 'Tipo de reunión actualizado' });
      } else {
        const slug = form.display_name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        const payload: MeetingTypeInsert = {
          name: slug,
          display_name: form.display_name,
          description: form.description || null,
          recurrence: form.recurrence,
          color: form.color || null,
          is_system: false,
          is_active: true,
          created_by: null,
        };
        await createMeetingType(payload);
        toast({ title: 'Éxito', description: 'Tipo de reunión creado' });
      }
      setDialogOpen(false);
      await load();
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar el tipo de reunión',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (type: MeetingTypeRow) => {
    if (type.is_system) {
      toast({
        title: 'No permitido',
        description: 'Los tipos de sistema no se pueden eliminar',
        variant: 'destructive',
      });
      return;
    }
    if (!window.confirm(`¿Eliminar el tipo "${type.display_name}"?`)) return;

    try {
      await deleteMeetingType(type.id);
      await load();
      toast({ title: 'Éxito', description: 'Tipo de reunión eliminado' });
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el tipo de reunión',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Tipos de Reunión</h2>
        <Button onClick={openCreate} className="gap-2 bg-amber-600 hover:bg-amber-700 text-stone-900">
          <Plus className="h-4 w-4" />
          Nuevo Tipo
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {meetingTypes.map((type) => (
          <Card key={type.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {type.color && (
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: type.color }}
                    />
                  )}
                  <CardTitle className="text-sm">{type.display_name}</CardTitle>
                </div>
                <div className="flex items-center gap-1">
                  {type.is_system && (
                    <Badge variant="secondary" className="text-xs">
                      Sistema
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setMemberEditorTypeId(
                        memberEditorTypeId === type.id ? null : type.id,
                      )
                    }
                    className="h-7 w-7 p-0"
                    aria-label={`Gestionar miembros de ${type.display_name}`}
                  >
                    <Users className="h-3.5 w-3.5" />
                  </Button>
                  {!type.is_system && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEdit(type)}
                        className="h-7 w-7 p-0"
                        aria-label={`Editar tipo ${type.display_name}`}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(type)}
                        className="h-7 w-7 p-0"
                        aria-label={`Eliminar tipo ${type.display_name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pb-3">
              {type.description && (
                <p className="text-xs text-muted-foreground mb-2">{type.description}</p>
              )}
              <Badge variant="outline" className="text-xs">
                {RECURRENCE_LABELS[type.recurrence]}
              </Badge>
            </CardContent>
            {memberEditorTypeId === type.id && (
              <CardContent className="pt-0 pb-4 border-t">
                <MeetingTypeMemberEditor meetingTypeId={type.id} />
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Editar Tipo de Reunión' : 'Nuevo Tipo de Reunión'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="display_name">Nombre</Label>
              <Input
                id="display_name"
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                placeholder="Ej: Concilio Parroquial"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Descripción (opcional)</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Descripción del tipo de reunión..."
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Recurrencia</Label>
              <Select
                value={form.recurrence}
                onValueChange={(v) => setForm((f) => ({ ...f, recurrence: v as MeetingRecurrence }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(RECURRENCE_LABELS) as MeetingRecurrence[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {RECURRENCE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="color">Color</Label>
              <div className="flex items-center gap-2">
                <input
                  id="color"
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="h-9 w-14 rounded border cursor-pointer"
                />
                <Input
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  placeholder="#D4A853"
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.display_name.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-stone-900"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MeetingTypeManager;
