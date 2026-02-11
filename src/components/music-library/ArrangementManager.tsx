/**
 * ArrangementManager — Collapsible cards for each arrangement.
 *
 * Allows inline add/edit via dialog, delete with AlertDialog.
 * Each arrangement card contains StemUploadGrid + ChordChartUpload.
 */

import { useState } from 'react';
import {
  useCreateArrangement,
  useUpdateArrangement,
  useDeleteArrangement,
} from '@/hooks/useMusicLibrary';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, Plus, Pencil, Trash2, Music } from 'lucide-react';
import { CASA_BRAND } from '@/lib/brand-kit';
import type {
  MusicArrangementRow,
  MusicStemRow,
  MusicChordChartRow,
} from '@/types/musicPlanning';
import StemUploadGrid from './StemUploadGrid';
import ChordChartUpload from './ChordChartUpload';

interface ArrangementManagerProps {
  songId: string;
  arrangements: (MusicArrangementRow & {
    music_stems: MusicStemRow[];
    music_chord_charts: MusicChordChartRow[];
  })[];
  canWrite: boolean;
  canManage: boolean;
}

interface ArrangementFormState {
  name: string;
  arrangementKey: string;
  description: string;
}

const EMPTY_FORM: ArrangementFormState = {
  name: '',
  arrangementKey: '',
  description: '',
};

const ArrangementManager = ({ songId, arrangements, canWrite, canManage }: ArrangementManagerProps) => {
  const createArrangement = useCreateArrangement();
  const updateArrangement = useUpdateArrangement();
  const deleteArrangement = useDeleteArrangement();

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<ArrangementFormState>(EMPTY_FORM);

  // Delete state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState('');

  // Expand state
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const openCreateDialog = () => {
    setEditingId(null);
    setFormState(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEditDialog = (arr: MusicArrangementRow) => {
    setEditingId(arr.id);
    setFormState({
      name: arr.name,
      arrangementKey: arr.arrangement_key ?? '',
      description: arr.description ?? '',
    });
    setDialogOpen(true);
  };

  const handleSaveArrangement = () => {
    if (editingId) {
      updateArrangement.mutate(
        {
          id: editingId,
          updates: {
            name: formState.name.trim(),
            arrangement_key: formState.arrangementKey.trim() || null,
            description: formState.description.trim() || null,
          },
        },
        { onSuccess: () => setDialogOpen(false) }
      );
    } else {
      createArrangement.mutate(
        {
          song_id: songId,
          name: formState.name.trim(),
          arrangement_key: formState.arrangementKey.trim() || null,
          description: formState.description.trim() || null,
          sort_order: arrangements.length,
        },
        { onSuccess: () => setDialogOpen(false) }
      );
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeletingId(id);
    setDeletingName(name);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (deletingId) {
      deleteArrangement.mutate(deletingId, {
        onSettled: () => {
          setDeleteConfirmOpen(false);
          setDeletingId(null);
          setDeletingName('');
        },
      });
    }
  };

  const isSaving = createArrangement.isPending || updateArrangement.isPending;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3
          className="text-sm font-semibold uppercase tracking-wider"
          style={{ color: CASA_BRAND.colors.secondary.grayDark }}
        >
          Arreglos ({arrangements.length})
        </h3>
        {canWrite && (
          <Button variant="outline" size="sm" onClick={openCreateDialog} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Agregar
          </Button>
        )}
      </div>

      {/* Arrangement cards */}
      {arrangements.length === 0 ? (
        <p className="text-center py-8 text-sm" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
          No hay arreglos. {canWrite ? 'Agrega el primero.' : ''}
        </p>
      ) : (
        <div className="space-y-3">
          {arrangements.map((arr) => (
            <Collapsible
              key={arr.id}
              open={expandedIds.has(arr.id)}
              onOpenChange={() => toggleExpanded(arr.id)}
            >
              <div className="border rounded-lg" style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}>
                {/* Arrangement header */}
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50">
                    <div className="flex items-center gap-3 min-w-0">
                      <Music className="h-4 w-4 flex-shrink-0" style={{ color: CASA_BRAND.colors.primary.amber }} />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate" style={{ color: CASA_BRAND.colors.primary.black }}>
                          {arr.name}
                        </p>
                        {arr.description && (
                          <p className="text-xs truncate" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                            {arr.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {arr.arrangement_key && (
                        <Badge variant="outline" className="text-xs">
                          {arr.arrangement_key}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {arr.music_stems.length} stems
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {arr.music_chord_charts.length} partituras
                      </Badge>
                      {canWrite && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditDialog(arr);
                          }}
                          title="Editar arreglo"
                          aria-label="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(arr.id, arr.name);
                          }}
                          title="Eliminar arreglo"
                          aria-label="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${expandedIds.has(arr.id) ? 'rotate-180' : ''}`}
                        style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                      />
                    </div>
                  </div>
                </CollapsibleTrigger>

                {/* Expanded content */}
                <CollapsibleContent>
                  <div
                    className="px-4 pb-4 space-y-6 border-t"
                    style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
                  >
                    {/* Stems */}
                    <div className="mt-4">
                      <StemUploadGrid
                        arrangementId={arr.id}
                        stems={arr.music_stems}
                        canWrite={canWrite}
                        canManage={canManage}
                      />
                    </div>

                    {/* Chord charts */}
                    <ChordChartUpload
                      arrangementId={arr.id}
                      charts={arr.music_chord_charts}
                      canWrite={canWrite}
                      canManage={canManage}
                    />
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: CASA_BRAND.fonts.heading, fontWeight: 300 }}>
              {editingId ? 'Editar arreglo' : 'Nuevo arreglo'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="arr-name">Nombre *</Label>
              <Input
                id="arr-name"
                value={formState.name}
                onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Ej: Original, Acústico, En vivo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="arr-key">Tonalidad</Label>
              <Input
                id="arr-key"
                value={formState.arrangementKey}
                onChange={(e) => setFormState((prev) => ({ ...prev, arrangementKey: e.target.value }))}
                placeholder="Ej: G, Am, Bb"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="arr-desc">Descripción</Label>
              <Input
                id="arr-desc"
                value={formState.description}
                onChange={(e) => setFormState((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Notas sobre este arreglo"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveArrangement}
              disabled={!formState.name.trim() || isSaving}
            >
              {isSaving ? 'Guardando...' : editingId ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar arreglo</AlertDialogTitle>
            <AlertDialogDescription>
              {`¿Estás seguro de que quieres eliminar el arreglo "${deletingName}"? Se eliminarán también todos los stems y partituras asociados.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteArrangement.isPending ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ArrangementManager;
