/**
 * SongLibraryAdmin — Main orchestrator component for the Song Library admin UI.
 *
 * Manages selected song state, permission gating, delete confirmation,
 * and renders SongListTable + SongDetailSheet + SongEditDialog.
 */

import { useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useDeleteSong } from '@/hooks/useMusicLibrary';
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
import SongListTable from './SongListTable';
import SongDetailSheet from './SongDetailSheet';
import SongEditDialog from './SongEditDialog';

const SongLibraryAdmin = () => {
  const { canRead, canWrite, canManage, loading: permLoading } = usePermissions('canciones');
  const deleteSong = useDeleteSong();

  // UI state
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSongId, setEditingSongId] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingSongId, setDeletingSongId] = useState<string | null>(null);
  const [deletingSongTitle, setDeletingSongTitle] = useState('');

  // Permission loading state
  if (permLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // No read permission
  if (!canRead) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Acceso denegado</AlertTitle>
        <AlertDescription>
          No tienes permisos para ver la biblioteca musical. Contacta al administrador.
        </AlertDescription>
      </Alert>
    );
  }

  const handleSongClick = (songId: string) => {
    setSelectedSongId(songId);
    setDetailOpen(true);
  };

  const handleEditClick = (songId: string | null) => {
    setEditingSongId(songId);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (songId: string, title: string) => {
    setDeletingSongId(songId);
    setDeletingSongTitle(title);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (deletingSongId) {
      deleteSong.mutate(deletingSongId, {
        onSettled: () => {
          setDeleteConfirmOpen(false);
          setDeletingSongId(null);
          setDeletingSongTitle('');
          // Close detail sheet if the deleted song was selected
          if (selectedSongId === deletingSongId) {
            setDetailOpen(false);
            setSelectedSongId(null);
          }
        },
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Action bar */}
      {canWrite && (
        <div className="flex justify-end">
          <Button
            onClick={() => handleEditClick(null)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Nueva canción
          </Button>
        </div>
      )}

      {/* Song list */}
      <SongListTable
        onSongClick={handleSongClick}
        onEditClick={handleEditClick}
        onDeleteClick={handleDeleteClick}
        canWrite={canWrite}
        canManage={canManage}
      />

      {/* Detail sheet */}
      <SongDetailSheet
        songId={selectedSongId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        canWrite={canWrite}
        canManage={canManage}
        onEditClick={() => {
          if (selectedSongId) {
            handleEditClick(selectedSongId);
          }
        }}
        onDeleteClick={(songId: string, title: string) => {
          handleDeleteClick(songId, title);
        }}
      />

      {/* Edit / Create dialog */}
      <SongEditDialog
        songId={editingSongId}
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setEditingSongId(null);
        }}
      />

      {/* Delete confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar canción</AlertDialogTitle>
            <AlertDialogDescription>
              {`¿Estás seguro de que quieres eliminar "${deletingSongTitle}"? Esta acción eliminará también todos los arreglos, stems, partituras y referencias de audio asociados. Esta acción no se puede deshacer.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteSong.isPending ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SongLibraryAdmin;
