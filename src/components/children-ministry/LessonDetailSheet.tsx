/**
 * LessonDetailSheet — Side sheet showing full lesson details
 * Shows all lesson fields and materials with edit/delete actions
 */

import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, Edit2, ExternalLink } from 'lucide-react';
import { getLesson, deleteLesson } from '@/lib/children-ministry/lessonService';
import AgeGroupBadge from './AgeGroupBadge';
import LessonStatusBadge from './LessonStatusBadge';
import type { ChildrenLessonFull } from '@/types/childrenMinistry';

interface LessonDetailSheetProps {
  lessonId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canWrite: boolean;
  onEdit?: () => void;
  onDeleted?: () => void;
}

const LessonDetailSheet = ({
  lessonId,
  open,
  onOpenChange,
  canWrite,
  onEdit,
  onDeleted,
}: LessonDetailSheetProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [lesson, setLesson] = useState<ChildrenLessonFull | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Load lesson when sheet opens
  useEffect(() => {
    if (lessonId && open) {
      const loadLesson = async () => {
        setLoading(true);
        try {
          const data = await getLesson(lessonId);
          setLesson(data);
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
    }
  }, [lessonId, open, toast]);

  const handleDelete = async () => {
    if (!lessonId) return;

    setDeleting(true);
    try {
      await deleteLesson(lessonId);
      toast({
        title: 'Éxito',
        description: 'Lección eliminada correctamente',
      });
      setShowDeleteDialog(false);
      onOpenChange(false);
      onDeleted?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: `Error al eliminar: ${error instanceof Error ? error.message : 'desconocido'}`,
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalles de Lección</SheetTitle>
            <SheetDescription>
              {loading ? 'Cargando...' : lesson?.title || ''}
            </SheetDescription>
          </SheetHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : lesson ? (
            <div className="space-y-6 pt-6">
              {/* Status and age group */}
              <div className="flex gap-2 flex-wrap">
                <LessonStatusBadge status={lesson.status} />
                {lesson.age_group && <AgeGroupBadge ageGroup={lesson.age_group} />}
              </div>

              {/* Title */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Título</h3>
                <p className="text-gray-600">{lesson.title}</p>
              </div>

              {/* Bible reference */}
              {lesson.bible_reference && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Referencia Bíblica</h3>
                  <p className="text-gray-600">{lesson.bible_reference}</p>
                </div>
              )}

              {/* Duration */}
              {lesson.duration_minutes && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Duración</h3>
                  <p className="text-gray-600">{lesson.duration_minutes} minutos</p>
                </div>
              )}

              {/* Description */}
              {lesson.description && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Descripción</h3>
                  <p className="text-gray-600 whitespace-pre-wrap">{lesson.description}</p>
                </div>
              )}

              {/* Objectives */}
              {lesson.objectives && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Objetivos</h3>
                  <p className="text-gray-600 whitespace-pre-wrap">{lesson.objectives}</p>
                </div>
              )}

              {/* Content */}
              {lesson.content && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Contenido</h3>
                  <p className="text-gray-600 whitespace-pre-wrap">{lesson.content}</p>
                </div>
              )}

              {/* Materials needed */}
              {lesson.materials_needed && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Materiales Necesarios</h3>
                  <p className="text-gray-600 whitespace-pre-wrap">{lesson.materials_needed}</p>
                </div>
              )}

              {/* Tags */}
              {lesson.tags && lesson.tags.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Etiquetas</h3>
                  <div className="flex gap-2 flex-wrap">
                    {lesson.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Materials */}
              {lesson.materials && lesson.materials.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Materiales Adjuntos</h3>
                  <ul className="space-y-2">
                    {lesson.materials.map((material) => (
                      <li
                        key={material.id}
                        className="flex items-start gap-2 p-2 bg-gray-50 rounded text-sm"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{material.name}</p>
                          <p className="text-gray-500 text-xs">{material.type}</p>
                        </div>
                        {material.url && (
                          <a
                            href={material.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-amber-600 hover:text-amber-700 mt-1"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions */}
              {canWrite && (
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      onOpenChange(false);
                      onEdit?.();
                    }}
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Lección</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de que desea eliminar esta lección? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default LessonDetailSheet;
