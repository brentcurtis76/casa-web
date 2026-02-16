/**
 * SetlistBuilder — Main orchestrator for the Setlists tab.
 *
 * Two-panel layout:
 *   Left: List of setlists (cards)
 *   Right: Selected setlist detail (Info, Canciones with reorder, key, moment, notes)
 */

import React, { useState, useMemo, useEffect } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import {
  useSetlists,
  useSetlistById,
  useUpdateSetlist,
  useDeleteSetlist,
  useRemoveSetlistItem,
  useReorderSetlistItems,
  useUpdateSetlistItem,
  useDuplicateSetlist,
  useUpcomingServiceDates,
} from '@/hooks/useMusicLibrary';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Plus,
  ShieldAlert,
  ArrowLeft,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  Music,
  Copy,
  AlertCircle,
} from 'lucide-react';
import { SETLIST_STATUS_LABELS, LITURGICAL_MOMENT_LABELS } from '@/lib/music-planning/setlistLabels';
import { CASA_BRAND } from '@/lib/brand-kit';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { SetlistStatus, MusicSetlistItemRow, MusicSongRow, MusicPublicationStateRow } from '@/types/musicPlanning';
import { supabase } from '@/integrations/supabase/client';
import SetlistEditDialog from './SetlistEditDialog';
import SetlistItemPicker from './SetlistItemPicker';

const NO_MOMENT = '__none__';

const getSetlistStatusVariant = (status: SetlistStatus) => {
  switch (status) {
    case 'finalized': return 'default' as const;
    case 'presented': return 'secondary' as const;
    default: return 'outline' as const;
  }
};

const SetlistBuilder = () => {
  const { canRead, canWrite, canManage, loading: permLoading } = usePermissions('music_scheduling');

  const [selectedSetlistId, setSelectedSetlistId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSetlistId, setEditingSetlistId] = useState<string | null>(null);
  const [songPickerOpen, setSongPickerOpen] = useState(false);

  // Delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteItemConfirmOpen, setDeleteItemConfirmOpen] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  // Duplicate dialog
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateTargetServiceDateId, setDuplicateTargetServiceDateId] = useState<string>('');

  // Inline editing for notes
  const [editingField, setEditingField] = useState<{ itemId: string; field: 'notes' | 'transition_notes' } | null>(null);
  const [editingFieldValue, setEditingFieldValue] = useState('');

  // Inline editing for song_key
  const [editingKeyItemId, setEditingKeyItemId] = useState<string | null>(null);
  const [editingKeyValue, setEditingKeyValue] = useState('');

  // Publication state for selected setlist
  const [publicationState, setPublicationState] = useState<MusicPublicationStateRow | null>(null);

  useEffect(() => {
    if (!selectedSetlistId) {
      setPublicationState(null);
      return;
    }

    let cancelled = false;
    const fetchPublication = async () => {
      try {
        const { data, error } = await supabase
          .from('music_publication_state')
          .select('*')
          .eq('setlist_id', selectedSetlistId)
          .order('published_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!cancelled && !error) {
          setPublicationState(data as MusicPublicationStateRow | null);
        }
      } catch {
        // Silently ignore
      }
    };
    fetchPublication();
    return () => { cancelled = true; };
  }, [selectedSetlistId]);

  const publicationBadge = publicationState ? (
    <Badge
      variant="secondary"
      className="text-xs"
      style={{ backgroundColor: `${CASA_BRAND.colors.primary.amber}20`, color: CASA_BRAND.colors.primary.amber }}
    >
      Publicado desde Liturgia{publicationState.publish_version > 1 ? ` v${publicationState.publish_version}` : ''}
    </Badge>
  ) : null;

  // Data
  const { data: setlists, isLoading, isError } = useSetlists();
  const { data: selectedSetlist } = useSetlistById(selectedSetlistId);
  const { data: upcomingServiceDates } = useUpcomingServiceDates(20);

  // Mutations
  const updateSetlist = useUpdateSetlist();
  const deleteSetlist = useDeleteSetlist();
  const removeItem = useRemoveSetlistItem();
  const reorderItems = useReorderSetlistItems();
  const updateItem = useUpdateSetlistItem();
  const duplicateSetlist = useDuplicateSetlist();

  // Permission gate
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
          No tienes permisos para ver los setlists. Contacta al administrador.
        </AlertDescription>
      </Alert>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Error al cargar los setlists. Intenta nuevamente.
        </AlertDescription>
      </Alert>
    );
  }

  // Handlers
  const handleDeleteSetlist = () => {
    if (!selectedSetlistId) return;
    deleteSetlist.mutate(selectedSetlistId, {
      onSettled: () => {
        setDeleteConfirmOpen(false);
        setSelectedSetlistId(null);
      },
    });
  };

  const handleDeleteItem = () => {
    if (!deletingItemId) return;
    removeItem.mutate(deletingItemId, {
      onSettled: () => {
        setDeleteItemConfirmOpen(false);
        setDeletingItemId(null);
      },
    });
  };

  const handleMoveSort = (
    items: (MusicSetlistItemRow & { music_songs: MusicSongRow })[],
    index: number,
    direction: -1 | 1
  ) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;

    reorderItems.mutate([
      { id: items[index].id, sort_order: items[target].sort_order },
      { id: items[target].id, sort_order: items[index].sort_order },
    ]);
  };

  const handleSaveField = (itemId: string, field: 'notes' | 'transition_notes') => {
    updateItem.mutate({
      id: itemId,
      updates: { [field]: editingFieldValue.trim() || null },
    });
    setEditingField(null);
  };

  const handleSaveKey = (itemId: string) => {
    updateItem.mutate({
      id: itemId,
      updates: { song_key: editingKeyValue.trim() || null },
    });
    setEditingKeyItemId(null);
  };

  const handleMomentChange = (itemId: string, value: string) => {
    updateItem.mutate({
      id: itemId,
      updates: { liturgical_moment: value === NO_MOMENT ? null : value },
    });
  };

  const handleDuplicate = () => {
    if (!selectedSetlistId || !duplicateTargetServiceDateId) return;
    duplicateSetlist.mutate(
      { sourceSetlistId: selectedSetlistId, targetServiceDateId: duplicateTargetServiceDateId },
      {
        onSettled: () => {
          setDuplicateDialogOpen(false);
          setDuplicateTargetServiceDateId('');
        },
      }
    );
  };

  const existingSongIds = selectedSetlist?.music_setlist_items.map((s) => s.song_id) ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left panel: Setlist list */}
        <div className="lg:col-span-1 space-y-3">
          {canWrite && (
            <Button
              onClick={() => {
                setEditingSetlistId(null);
                setEditDialogOpen(true);
              }}
              className="w-full gap-2"
            >
              <Plus className="h-4 w-4" />
              Nueva setlist
            </Button>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : !setlists || setlists.length === 0 ? (
            <div className="text-center py-12" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
              No hay setlists creadas.
            </div>
          ) : (
            setlists.map((sl) => {
              const serviceDate = sl.music_service_dates;
              return (
                <div
                  key={sl.id}
                  className={`p-4 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedSetlistId === sl.id ? 'ring-2' : ''
                  }`}
                  style={{
                    borderColor: CASA_BRAND.colors.secondary.grayLight,
                    ...(selectedSetlistId === sl.id
                      ? { ['--tw-ring-color' as string]: CASA_BRAND.colors.primary.amber }
                      : {}),
                  } as React.CSSProperties}
                  onClick={() => setSelectedSetlistId(sl.id)}
                >
                  <p className="font-medium" style={{ color: CASA_BRAND.colors.primary.black }}>
                    {sl.title || 'Sin título'}
                  </p>
                  {serviceDate && (
                    <p className="text-sm mt-0.5" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                      {format(parseISO(serviceDate.date), "EEE d MMM yyyy", { locale: es })}
                      {serviceDate.title ? ` — ${serviceDate.title}` : ''}
                    </p>
                  )}
                  <div className="mt-2 flex gap-2 flex-wrap">
                    <Badge variant={getSetlistStatusVariant(sl.status)}>
                      {SETLIST_STATUS_LABELS[sl.status]}
                    </Badge>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right panel: Detail */}
        <div className="lg:col-span-2">
          {selectedSetlistId && selectedSetlist ? (
            <div className="space-y-6">
              {/* Info header */}
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedSetlistId(null)}
                  className="gap-1"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Volver
                </Button>
              </div>

              <div className="border rounded-lg p-6" style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3
                      className="text-lg"
                      style={{ fontFamily: CASA_BRAND.fonts.heading, fontWeight: 300 }}
                    >
                      {selectedSetlist.title || 'Sin título'}
                    </h3>
                    <div className="mt-2 flex gap-2 flex-wrap items-center">
                      <Badge variant={getSetlistStatusVariant(selectedSetlist.status)}>
                        {SETLIST_STATUS_LABELS[selectedSetlist.status]}
                      </Badge>
                      {publicationBadge}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {canWrite && (
                      <>
                        <Select
                          value={selectedSetlist.status}
                          onValueChange={(v) => {
                            updateSetlist.mutate({
                              id: selectedSetlist.id,
                              updates: { status: v as SetlistStatus },
                            });
                          }}
                        >
                          <SelectTrigger className="w-36 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.entries(SETLIST_STATUS_LABELS) as [SetlistStatus, string][]).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingSetlistId(selectedSetlistId);
                            setEditDialogOpen(true);
                          }}
                          aria-label="Editar setlist"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDuplicateDialogOpen(true)}
                          className="gap-1"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Duplicar
                        </Button>
                      </>
                    )}
                    {canManage && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-500 hover:text-red-600 border-red-200"
                        onClick={() => setDeleteConfirmOpen(true)}
                        aria-label="Eliminar setlist"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Canciones section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4
                    className="text-sm font-semibold uppercase tracking-wider flex items-center gap-1.5"
                    style={{ color: CASA_BRAND.colors.secondary.grayDark }}
                  >
                    <Music className="h-4 w-4" />
                    Canciones
                  </h4>
                  {canWrite && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSongPickerOpen(true)}
                      className="gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Agregar canción
                    </Button>
                  )}
                </div>

                {selectedSetlist.music_setlist_items.length === 0 ? (
                  <p className="text-sm" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                    No hay canciones en este setlist. Agrega canciones para comenzar.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedSetlist.music_setlist_items.map((si, index) => (
                      <div
                        key={si.id}
                        className="flex items-start gap-2 p-3 rounded-lg border"
                        style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
                      >
                        {canWrite && (
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              disabled={index === 0}
                              onClick={() => handleMoveSort(selectedSetlist.music_setlist_items, index, -1)}
                              aria-label="Mover arriba"
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              disabled={index === selectedSetlist.music_setlist_items.length - 1}
                              onClick={() => handleMoveSort(selectedSetlist.music_setlist_items, index, 1)}
                              aria-label="Mover abajo"
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{si.music_songs.title}</span>
                            {si.music_songs.artist && (
                              <span className="text-xs" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                                — {si.music_songs.artist}
                              </span>
                            )}
                          </div>

                          {/* Metadata row: moment badge, key */}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {canWrite ? (
                              <Select
                                value={si.liturgical_moment ?? NO_MOMENT}
                                onValueChange={(v) => handleMomentChange(si.id, v)}
                              >
                                <SelectTrigger className="h-7 w-auto min-w-[140px] text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={NO_MOMENT}>(Sin momento)</SelectItem>
                                  {Object.entries(LITURGICAL_MOMENT_LABELS).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                      {label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : si.liturgical_moment ? (
                              <Badge variant="outline" className="text-xs">
                                {LITURGICAL_MOMENT_LABELS[si.liturgical_moment] ?? si.liturgical_moment}
                              </Badge>
                            ) : null}

                            {/* Song key */}
                            {editingKeyItemId === si.id && canWrite ? (
                              <Input
                                value={editingKeyValue}
                                onChange={(e) => setEditingKeyValue(e.target.value)}
                                onBlur={() => handleSaveKey(si.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveKey(si.id);
                                  }
                                }}
                                className="h-7 w-16 text-xs"
                                autoFocus
                              />
                            ) : (
                              <Badge
                                variant="secondary"
                                className="text-xs cursor-pointer"
                                onClick={() => {
                                  if (canWrite) {
                                    setEditingKeyItemId(si.id);
                                    setEditingKeyValue(si.song_key ?? '');
                                  }
                                }}
                              >
                                {si.song_key ?? 'Sin tono'}
                              </Badge>
                            )}
                          </div>

                          {/* Notes */}
                          {editingField?.itemId === si.id && editingField.field === 'notes' ? (
                            <Textarea
                              value={editingFieldValue}
                              onChange={(e) => setEditingFieldValue(e.target.value)}
                              onBlur={() => handleSaveField(si.id, 'notes')}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSaveField(si.id, 'notes');
                                }
                              }}
                              className="mt-1 text-xs"
                              rows={2}
                              autoFocus
                            />
                          ) : (
                            <p
                              className="mt-0.5 text-xs cursor-pointer hover:underline"
                              style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                              onClick={() => {
                                if (canWrite) {
                                  setEditingField({ itemId: si.id, field: 'notes' });
                                  setEditingFieldValue(si.notes ?? '');
                                }
                              }}
                            >
                              {si.notes || (canWrite ? 'Agregar nota...' : '')}
                            </p>
                          )}

                          {/* Transition notes (only for non-last items) */}
                          {index < selectedSetlist.music_setlist_items.length - 1 && (
                            <>
                              {editingField?.itemId === si.id && editingField.field === 'transition_notes' ? (
                                <Textarea
                                  value={editingFieldValue}
                                  onChange={(e) => setEditingFieldValue(e.target.value)}
                                  onBlur={() => handleSaveField(si.id, 'transition_notes')}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      handleSaveField(si.id, 'transition_notes');
                                    }
                                  }}
                                  className="mt-1 text-xs italic"
                                  rows={2}
                                  autoFocus
                                />
                              ) : (
                                <p
                                  className="mt-0.5 text-xs italic cursor-pointer hover:underline"
                                  style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                                  onClick={() => {
                                    if (canWrite) {
                                      setEditingField({ itemId: si.id, field: 'transition_notes' });
                                      setEditingFieldValue(si.transition_notes ?? '');
                                    }
                                  }}
                                >
                                  {si.transition_notes || (canWrite ? 'Agregar transición...' : '')}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                        {canWrite && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-600 shrink-0"
                            onClick={() => {
                              setDeletingItemId(si.id);
                              setDeleteItemConfirmOpen(true);
                            }}
                            aria-label="Eliminar canción del setlist"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
              Selecciona una setlist para ver los detalles.
            </div>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <SetlistEditDialog
        setlistId={editingSetlistId}
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setEditingSetlistId(null);
        }}
      />

      {/* Song Picker */}
      {selectedSetlistId && (
        <SetlistItemPicker
          setlistId={selectedSetlistId}
          open={songPickerOpen}
          onOpenChange={setSongPickerOpen}
          existingSongIds={existingSongIds}
        />
      )}

      {/* Delete Setlist Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar setlist</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres eliminar esta setlist? Se eliminarán también todas las canciones asociadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSetlist}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteSetlist.isPending ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Item Confirmation */}
      <AlertDialog open={deleteItemConfirmOpen} onOpenChange={setDeleteItemConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quitar canción</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Quitar esta canción de la setlist?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteItem}
              className="bg-red-600 hover:bg-red-700"
            >
              {removeItem.isPending ? 'Quitando...' : 'Quitar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate Dialog */}
      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: CASA_BRAND.fonts.heading, fontWeight: 300 }}>
              Duplicar setlist
            </DialogTitle>
            <DialogDescription>
              Selecciona la fecha de servicio para la copia de la setlist.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Fecha de servicio destino</Label>
              <Select value={duplicateTargetServiceDateId} onValueChange={setDuplicateTargetServiceDateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar fecha..." />
                </SelectTrigger>
                <SelectContent>
                  {upcomingServiceDates?.map((sd) => (
                    <SelectItem key={sd.id} value={sd.id}>
                      {format(parseISO(sd.date), "EEE d MMM yyyy", { locale: es })}
                      {sd.title ? ` — ${sd.title}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleDuplicate}
              disabled={!duplicateTargetServiceDateId || duplicateSetlist.isPending}
            >
              {duplicateSetlist.isPending ? 'Duplicando...' : 'Duplicar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SetlistBuilder;
