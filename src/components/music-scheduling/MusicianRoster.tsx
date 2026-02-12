/**
 * MusicianRoster — Main orchestrator for the Músicos tab.
 *
 * Manages selected musician state, permission gating, delete confirmation,
 * and renders MusicianListTable + MusicianDetailSheet + MusicianEditDialog.
 */

import { useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useDeleteMusician } from '@/hooks/useMusicLibrary';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, ShieldAlert } from 'lucide-react';
import MusicianListTable from './MusicianListTable';
import MusicianDetailSheet from './MusicianDetailSheet';
import MusicianEditDialog from './MusicianEditDialog';

const MusicianRoster = () => {
  const { canRead, canWrite, canManage, loading: permLoading } = usePermissions('music_scheduling');
  const deleteMusician = useDeleteMusician();

  // UI state
  const [selectedMusicianId, setSelectedMusicianId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingMusicianId, setEditingMusicianId] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingMusicianId, setDeletingMusicianId] = useState<string | null>(null);
  const [deletingMusicianName, setDeletingMusicianName] = useState('');

  if (permLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!canRead) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Acceso denegado</AlertTitle>
        <AlertDescription>
          No tienes permisos para ver la programación musical. Contacta al administrador.
        </AlertDescription>
      </Alert>
    );
  }

  const handleMusicianClick = (musicianId: string) => {
    setSelectedMusicianId(musicianId);
    setDetailOpen(true);
  };

  const handleEditClick = (musicianId: string | null) => {
    setEditingMusicianId(musicianId);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (musicianId: string, name: string) => {
    setDeletingMusicianId(musicianId);
    setDeletingMusicianName(name);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (deletingMusicianId) {
      deleteMusician.mutate(deletingMusicianId, {
        onSettled: () => {
          setDeleteConfirmOpen(false);
          setDeletingMusicianId(null);
          setDeletingMusicianName('');
          if (selectedMusicianId === deletingMusicianId) {
            setDetailOpen(false);
            setSelectedMusicianId(null);
          }
        },
      });
    }
  };

  return (
    <div className="space-y-6">
      {canWrite && (
        <div className="flex justify-end">
          <Button onClick={() => handleEditClick(null)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo músico
          </Button>
        </div>
      )}

      <MusicianListTable
        onMusicianClick={handleMusicianClick}
        onEditClick={handleEditClick}
        onDeleteClick={handleDeleteClick}
        canWrite={canWrite}
        canManage={canManage}
      />

      <MusicianDetailSheet
        musicianId={selectedMusicianId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        canWrite={canWrite}
        canManage={canManage}
        onEditClick={() => {
          if (selectedMusicianId) {
            handleEditClick(selectedMusicianId);
          }
        }}
        onDeleteClick={(id: string, name: string) => {
          handleDeleteClick(id, name);
        }}
      />

      <MusicianEditDialog
        musicianId={editingMusicianId}
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setEditingMusicianId(null);
        }}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar músico</AlertDialogTitle>
            <AlertDialogDescription>
              {`¿Estás seguro de que quieres eliminar al músico "${deletingMusicianName}"? Se eliminarán también sus instrumentos, disponibilidad y asignaciones.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMusician.isPending ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MusicianRoster;
