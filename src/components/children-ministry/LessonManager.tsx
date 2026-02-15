/**
 * LessonManager — Orchestrates the Lessons tab
 * Handles search, filtering, lesson list, and dialog state
 */

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus } from 'lucide-react';
import { getLessons } from '@/lib/children-ministry/lessonService';
import { getAgeGroups } from '@/lib/children-ministry/ageGroupService';
import LessonCard from './LessonCard';
import LessonDetailSheet from './LessonDetailSheet';
import LessonEditDialog from './LessonEditDialog';
import type { ChildrenLessonRow, ChildrenAgeGroupRow, LessonStatus } from '@/types/childrenMinistry';

interface LessonManagerProps {
  canWrite: boolean;
}

const LessonManager = ({ canWrite }: LessonManagerProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [lessons, setLessons] = useState<ChildrenLessonRow[]>([]);
  const [ageGroups, setAgeGroups] = useState<ChildrenAgeGroupRow[]>([]);

  // Filters
  const [searchText, setSearchText] = useState('');
  const [selectedAgeGroup, setSelectedAgeGroup] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Detail and edit dialogs
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);

  // Load age groups and lessons on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const groups = await getAgeGroups();
        setAgeGroups(groups);
        await loadLessons();
      } catch (error) {
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los datos',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [toast]);

  // Load lessons with current filters
  const loadLessons = async () => {
    try {
      const data = await getLessons({
        search: searchText || undefined,
        age_group_id: selectedAgeGroup || undefined,
        status: (selectedStatus as LessonStatus) || undefined,
      });
      setLessons(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las lecciones',
        variant: 'destructive',
      });
    }
  };

  // Reload lessons when filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      loadLessons();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchText, selectedAgeGroup, selectedStatus, toast]);

  const handleDetailOpen = (id: string) => {
    setSelectedLessonId(id);
    setDetailOpen(true);
  };

  const handleEdit = () => {
    if (selectedLessonId) {
      setEditingLessonId(selectedLessonId);
      setEditDialogOpen(true);
      setDetailOpen(false);
    }
  };

  const handleCreateNew = () => {
    setEditingLessonId(null);
    setEditDialogOpen(true);
  };

  const handleSuccess = () => {
    loadLessons();
  };

  // Find age group by ID for display
  const getAgeGroup = (id: string | null) => {
    if (!id) return undefined;
    return ageGroups.find((ag) => ag.id === id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="flex-1">
          <label className="text-sm font-medium text-gray-700 mb-1 block">Buscar</label>
          <Input
            placeholder="Buscar lecciones..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>

        <div className="w-full md:w-48">
          <label className="text-sm font-medium text-gray-700 mb-1 block">Grupo de Edad</label>
          <Select value={selectedAgeGroup} onValueChange={setSelectedAgeGroup}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              {ageGroups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-full md:w-48">
          <label className="text-sm font-medium text-gray-700 mb-1 block">Estado</label>
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              <SelectItem value="draft">Borrador</SelectItem>
              <SelectItem value="ready">Lista</SelectItem>
              <SelectItem value="archived">Archivada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {canWrite && (
          <Button onClick={handleCreateNew} className="w-full md:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Nueva Lección
          </Button>
        )}
      </div>

      {/* Lessons grid */}
      {lessons.length === 0 ? (
        <Card className="p-8 text-center">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No hay lecciones creadas</h3>
          <p className="text-gray-500 mb-4">
            {searchText || selectedAgeGroup || selectedStatus
              ? 'No se encontraron lecciones con los filtros aplicados'
              : 'Comienza creando tu primera lección'}
          </p>
          {canWrite && !searchText && !selectedAgeGroup && !selectedStatus && (
            <Button onClick={handleCreateNew}>Crear primera lección</Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {lessons.map((lesson) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              ageGroup={getAgeGroup(lesson.age_group_id)}
              onClick={() => handleDetailOpen(lesson.id)}
            />
          ))}
        </div>
      )}

      {/* Detail sheet */}
      <LessonDetailSheet
        lessonId={selectedLessonId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        canWrite={canWrite}
        onEdit={handleEdit}
        onDeleted={handleSuccess}
      />

      {/* Edit dialog */}
      <LessonEditDialog
        lessonId={editingLessonId}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={handleSuccess}
      />
    </div>
  );
};

export default LessonManager;
