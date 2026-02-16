/**
 * VolunteerDetailSheet — Side sheet showing full volunteer details
 * Shows info, recurring availability, assigned sessions with edit/delete actions
 */

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
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
import { Loader2, Trash2, Edit2 } from 'lucide-react';
import {
  getVolunteer,
  deleteVolunteer,
  getRecurringAvailability,
} from '@/lib/children-ministry/volunteerService';
import AvailabilityEditor from './AvailabilityEditor';
import VolunteerEditDialog from './VolunteerEditDialog';
import type { ChildrenVolunteerRow } from '@/types/childrenMinistry';

interface VolunteerDetailSheetProps {
  volunteerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
  onUpdated?: () => void;
}

const VolunteerDetailSheet = ({
  volunteerId,
  open,
  onOpenChange,
  canManage,
  onUpdated,
}: VolunteerDetailSheetProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [volunteer, setVolunteer] = useState<ChildrenVolunteerRow | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Load volunteer data when sheet opens
  useEffect(() => {
    if (volunteerId && open) {
      const loadVolunteer = async () => {
        setLoading(true);
        try {
          const data = await getVolunteer(volunteerId);
          setVolunteer(data);
        } catch (error) {
          toast({
            title: 'Error',
            description: 'No se pudo cargar el voluntario',
            variant: 'destructive',
          });
        } finally {
          setLoading(false);
        }
      };

      loadVolunteer();
    }
  }, [volunteerId, open, toast]);

  const handleDelete = async () => {
    if (!volunteerId) return;

    setDeleting(true);
    try {
      await deleteVolunteer(volunteerId);
      toast({
        title: 'Éxito',
        description: 'Voluntario eliminado correctamente',
      });
      setShowDeleteDialog(false);
      onOpenChange(false);
      onUpdated?.();
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

  const handleEditSuccess = () => {
    setEditDialogOpen(false);
    if (volunteerId) {
      const loadVolunteer = async () => {
        try {
          const data = await getVolunteer(volunteerId);
          setVolunteer(data);
        } catch {
          // Silently fail on reload
        }
      };
      loadVolunteer();
    }
    onUpdated?.();
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalles del Voluntario</SheetTitle>
            <SheetDescription>
              {loading ? 'Cargando...' : volunteer?.display_name || ''}
            </SheetDescription>
          </SheetHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : volunteer ? (
            <div className="space-y-6 pt-6">
              {/* Status badge */}
              <div>
                <Badge
                  variant={volunteer.is_active ? 'default' : 'outline'}
                  className={volunteer.is_active ? 'bg-green-100 text-green-800' : ''}
                >
                  {volunteer.is_active ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>

              {/* Name */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Nombre</h3>
                <p className="text-gray-600">{volunteer.display_name}</p>
              </div>

              {/* Email */}
              {volunteer.email && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Email</h3>
                  <a href={`mailto:${volunteer.email}`} className="text-amber-600 hover:text-amber-700">
                    {volunteer.email}
                  </a>
                </div>
              )}

              {/* Phone */}
              {volunteer.phone && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Teléfono</h3>
                  <a href={`tel:${volunteer.phone}`} className="text-amber-600 hover:text-amber-700">
                    {volunteer.phone}
                  </a>
                </div>
              )}

              {/* Notes */}
              {volunteer.notes && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Notas</h3>
                  <p className="text-gray-600 whitespace-pre-wrap">{volunteer.notes}</p>
                </div>
              )}

              {/* Availability */}
              <div className="pt-4 border-t">
                <AvailabilityEditor volunteerId={volunteer.id} readOnly={!canManage} />
              </div>

              {/* Actions */}
              {canManage && (
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setEditDialogOpen(true)}
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
            <AlertDialogTitle>Eliminar Voluntario</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de que desea eliminar este voluntario? Esta acción no se puede deshacer.
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

      {/* Edit dialog */}
      <VolunteerEditDialog
        volunteerId={volunteerId}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={handleEditSuccess}
      />
    </>
  );
};

export default VolunteerDetailSheet;
