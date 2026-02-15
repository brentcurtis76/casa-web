/**
 * LessonEditDialog — Form for creating/editing lessons
 * Handles all 11 form fields with validation
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { getAgeGroups } from '@/lib/children-ministry/ageGroupService';
import { createLesson, updateLesson, getLesson } from '@/lib/children-ministry/lessonService';
import { supabase } from '@/integrations/supabase/client';
import type { ChildrenAgeGroupRow, ChildrenLessonFull, LessonStatus } from '@/types/childrenMinistry';

interface LessonEditDialogProps {
  lessonId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const LessonEditDialog = ({
  lessonId,
  open,
  onOpenChange,
  onSuccess,
}: LessonEditDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ageGroups, setAgeGroups] = useState<ChildrenAgeGroupRow[]>([]);
  const [liturgies, setLitururgies] = useState<{ id: string; title: string }[]>([]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    age_group_id: '',
    bible_reference: '',
    objectives: '',
    content: '',
    materials_needed: '',
    duration_minutes: 30,
    liturgy_id: '',
    tags: '',
    status: 'draft' as LessonStatus,
  });

  // Load age groups and liturgies on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const groups = await getAgeGroups();
        setAgeGroups(groups);

        const { data: liturgyData } = await supabase
          .from('liturgies')
          .select('id, title')
          .order('title', { ascending: true });
        setLitururgies((liturgyData ?? []) as { id: string; title: string }[]);
      } catch {
        // Toast handles user-facing errors; silently fail on dropdown load
      }
    };

    loadData();
  }, []);

  // Load lesson data if editing
  useEffect(() => {
    if (lessonId && open) {
      const loadLesson = async () => {
        setLoading(true);
        try {
          const lesson = await getLesson(lessonId);
          setFormData({
            title: lesson.title,
            description: lesson.description || '',
            age_group_id: lesson.age_group_id || '',
            bible_reference: lesson.bible_reference || '',
            objectives: lesson.objectives || '',
            content: lesson.content || '',
            materials_needed: lesson.materials_needed || '',
            duration_minutes: lesson.duration_minutes || 30,
            liturgy_id: lesson.liturgy_id || '',
            tags: lesson.tags?.join(', ') || '',
            status: lesson.status,
          });
        } catch (error) {
          toast({
            title: 'Error',
            description: 'No se pudo cargar la lección',
            variant: 'destructive',
          });
        } finally {
          setLoading(false);
        }
      };

      loadLesson();
    } else if (open && !lessonId) {
      setFormData({
        title: '',
        description: '',
        age_group_id: '',
        bible_reference: '',
        objectives: '',
        content: '',
        materials_needed: '',
        duration_minutes: 30,
        liturgy_id: '',
        tags: '',
        status: 'draft',
      });
    }
  }, [lessonId, open, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast({
        title: 'Error',
        description: 'El título es requerido',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const tags = formData.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag);

      const lessonData = {
        title: formData.title,
        description: formData.description || null,
        age_group_id: formData.age_group_id || null,
        bible_reference: formData.bible_reference || null,
        objectives: formData.objectives || null,
        content: formData.content || null,
        materials_needed: formData.materials_needed || null,
        duration_minutes: formData.duration_minutes || 30,
        liturgy_id: formData.liturgy_id || null,
        tags,
        status: formData.status,
      };

      if (lessonId) {
        await updateLesson(lessonId, lessonData);
        toast({
          title: 'Éxito',
          description: 'Lección actualizada correctamente',
        });
      } else {
        await createLesson(lessonData);
        toast({
          title: 'Éxito',
          description: 'Lección creada correctamente',
        });
      }

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast({
        title: 'Error',
        description: `Error al guardar la lección: ${error instanceof Error ? error.message : 'desconocido'}`,
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
          <DialogTitle>{lessonId ? 'Editar Lección' : 'Nueva Lección'}</DialogTitle>
          <DialogDescription>
            {lessonId
              ? 'Actualiza los detalles de la lección'
              : 'Crea una nueva lección para el ministerio infantil'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Título de la lección"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descripción breve de la lección"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="age_group">Grupo de Edad</Label>
                <Select value={formData.age_group_id} onValueChange={(value) =>
                  setFormData({ ...formData, age_group_id: value })
                }>
                  <SelectTrigger id="age_group">
                    <SelectValue placeholder="Seleccionar grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    {ageGroups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bible_ref">Referencia Bíblica</Label>
                <Input
                  id="bible_ref"
                  value={formData.bible_reference}
                  onChange={(e) => setFormData({ ...formData, bible_reference: e.target.value })}
                  placeholder="Mateo 5:1-12"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="objectives">Objetivos</Label>
              <Textarea
                id="objectives"
                value={formData.objectives}
                onChange={(e) => setFormData({ ...formData, objectives: e.target.value })}
                placeholder="Objetivos educativos de la lección"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Contenido</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Contenido detallado de la lección"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="materials">Materiales Necesarios</Label>
              <Textarea
                id="materials"
                value={formData.materials_needed}
                onChange={(e) => setFormData({ ...formData, materials_needed: e.target.value })}
                placeholder="Lista de materiales necesarios"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="duration">Duración (minutos)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  value={formData.duration_minutes}
                  onChange={(e) =>
                    setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 30 })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Estado</Label>
                <Select value={formData.status} onValueChange={(value) =>
                  setFormData({ ...formData, status: value as LessonStatus })
                }>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Borrador</SelectItem>
                    <SelectItem value="ready">Lista</SelectItem>
                    <SelectItem value="archived">Archivada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="liturgy">Liturgia (Opcional)</Label>
              <Select value={formData.liturgy_id} onValueChange={(value) =>
                setFormData({ ...formData, liturgy_id: value })
              }>
                <SelectTrigger id="liturgy">
                  <SelectValue placeholder="Seleccionar liturgia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin liturgia</SelectItem>
                  {liturgies.map((liturgy) => (
                    <SelectItem key={liturgy.id} value={liturgy.id}>
                      {liturgy.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Etiquetas</Label>
              <Input
                id="tags"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="Separadas por comas"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {lessonId ? 'Actualizar' : 'Crear'} Lección
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default LessonEditDialog;
