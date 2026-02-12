/**
 * RehearsalManager — Main orchestrator for the Ensayos tab.
 *
 * Two-panel layout:
 *   Left: List of rehearsals (cards)
 *   Right: Selected rehearsal detail (Info, Canciones, Asistentes)
 */

import React, { useState, useMemo } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import {
  useRehearsals,
  useRehearsalById,
  useUpdateRehearsal,
  useDeleteRehearsal,
  useRemoveRehearsalSong,
  useReorderRehearsalSongs,
  useUpdateRehearsalSong,
  useRemoveRehearsalAttendee,
  useUpdateRehearsalAttendee,
  useBatchAddAttendees,
  useMusicians,
} from '@/hooks/useMusicLibrary';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
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
  Plus,
  ShieldAlert,
  ArrowLeft,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  MapPin,
  Clock,
  Link2,
  Music,
  Users,
} from 'lucide-react';
import { REHEARSAL_STATUS_LABELS, RSVP_STATUS_LABELS } from '@/lib/music-planning/rehearsalLabels';
import { CASA_BRAND } from '@/lib/brand-kit';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { RehearsalStatus, RsvpStatus, MusicRehearsalSongRow, MusicSongRow } from '@/types/musicPlanning';
import RehearsalEditDialog from './RehearsalEditDialog';
import RehearsalSongPicker from './RehearsalSongPicker';
import RehearsalAttendeePicker from './RehearsalAttendeePicker';

const getRehearsalStatusVariant = (status: RehearsalStatus) => {
  switch (status) {
    case 'confirmed': return 'default' as const;
    case 'completed': return 'secondary' as const;
    case 'cancelled': return 'destructive' as const;
    default: return 'outline' as const;
  }
};

const getRsvpVariant = (status: RsvpStatus) => {
  switch (status) {
    case 'accepted': return 'default' as const;
    case 'declined': return 'destructive' as const;
    default: return 'secondary' as const;
  }
};

const RehearsalManager = () => {
  const { canRead, canWrite, canManage, loading: permLoading } = usePermissions('music_scheduling');

  const [selectedRehearsalId, setSelectedRehearsalId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRehearsalId, setEditingRehearsalId] = useState<string | null>(null);
  const [songPickerOpen, setSongPickerOpen] = useState(false);
  const [attendeePickerOpen, setAttendeePickerOpen] = useState(false);

  // Delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteSongConfirmOpen, setDeleteSongConfirmOpen] = useState(false);
  const [deletingSongId, setDeletingSongId] = useState<string | null>(null);
  const [deleteAttendeeConfirmOpen, setDeleteAttendeeConfirmOpen] = useState(false);
  const [deletingAttendeeId, setDeletingAttendeeId] = useState<string | null>(null);
  const [batchInviteConfirmOpen, setBatchInviteConfirmOpen] = useState(false);

  // Song notes editing
  const [editingNotesSongId, setEditingNotesSongId] = useState<string | null>(null);
  const [editingNotesValue, setEditingNotesValue] = useState('');

  // Data
  const { data: rehearsals, isLoading } = useRehearsals();
  const { data: selectedRehearsal } = useRehearsalById(selectedRehearsalId);
  const { data: activeMusicians } = useMusicians({ isActive: true });

  // Mutations
  const updateRehearsal = useUpdateRehearsal();
  const deleteRehearsal = useDeleteRehearsal();
  const removeSong = useRemoveRehearsalSong();
  const reorderSongs = useReorderRehearsalSongs();
  const updateSong = useUpdateRehearsalSong();
  const removeAttendee = useRemoveRehearsalAttendee();
  const updateAttendee = useUpdateRehearsalAttendee();
  const batchAddAttendees = useBatchAddAttendees();

  // Sorted rehearsals (most recent first)
  const sortedRehearsals = useMemo(() => {
    if (!rehearsals) return [];
    return [...rehearsals].sort((a, b) => b.date.localeCompare(a.date));
  }, [rehearsals]);

  // Batch invite calculations
  const existingMusicianIds = useMemo(() => {
    if (!selectedRehearsal) return [];
    return selectedRehearsal.music_rehearsal_attendees.map((a) => a.musician_id);
  }, [selectedRehearsal]);

  const uninvitedMusicians = useMemo(() => {
    if (!activeMusicians) return [];
    const invited = new Set(existingMusicianIds);
    return activeMusicians.filter((m) => !invited.has(m.id));
  }, [activeMusicians, existingMusicianIds]);

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
          No tienes permisos para ver los ensayos. Contacta al administrador.
        </AlertDescription>
      </Alert>
    );
  }

  // Handlers
  const handleDeleteRehearsal = () => {
    if (!selectedRehearsalId) return;
    deleteRehearsal.mutate(selectedRehearsalId, {
      onSettled: () => {
        setDeleteConfirmOpen(false);
        setSelectedRehearsalId(null);
      },
    });
  };

  const handleDeleteSong = () => {
    if (!deletingSongId) return;
    removeSong.mutate(deletingSongId, {
      onSettled: () => {
        setDeleteSongConfirmOpen(false);
        setDeletingSongId(null);
      },
    });
  };

  const handleDeleteAttendee = () => {
    if (!deletingAttendeeId) return;
    removeAttendee.mutate(deletingAttendeeId, {
      onSettled: () => {
        setDeleteAttendeeConfirmOpen(false);
        setDeletingAttendeeId(null);
      },
    });
  };

  const handleMoveSort = (songs: (MusicRehearsalSongRow & { music_songs: MusicSongRow })[], index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= songs.length) return;

    reorderSongs.mutate([
      { id: songs[index].id, sort_order: songs[target].sort_order },
      { id: songs[target].id, sort_order: songs[index].sort_order },
    ]);
  };

  const handleSaveNotes = (songId: string) => {
    updateSong.mutate({
      id: songId,
      updates: { notes: editingNotesValue.trim() || null },
    });
    setEditingNotesSongId(null);
  };

  const handleBatchInvite = () => {
    if (!selectedRehearsalId || uninvitedMusicians.length === 0) return;
    batchAddAttendees.mutate(
      {
        rehearsalId: selectedRehearsalId,
        musicianIds: uninvitedMusicians.map((m) => m.id),
      },
      {
        onSettled: () => setBatchInviteConfirmOpen(false),
      }
    );
  };

  const existingSongIds = selectedRehearsal?.music_rehearsal_songs.map((s) => s.song_id) ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left panel: Rehearsal list */}
        <div className="lg:col-span-1 space-y-3">
          {canWrite && (
            <Button
              onClick={() => {
                setEditingRehearsalId(null);
                setEditDialogOpen(true);
              }}
              className="w-full gap-2"
            >
              <Plus className="h-4 w-4" />
              Nuevo ensayo
            </Button>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : sortedRehearsals.length === 0 ? (
            <div className="text-center py-12" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
              No hay ensayos programados.
            </div>
          ) : (
            sortedRehearsals.map((r) => (
              <div
                key={r.id}
                className={`p-4 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedRehearsalId === r.id ? 'ring-2' : ''
                }`}
                style={{
                  borderColor: CASA_BRAND.colors.secondary.grayLight,
                  ...(selectedRehearsalId === r.id
                    ? { ['--tw-ring-color' as string]: CASA_BRAND.colors.primary.amber }
                    : {}),
                } as React.CSSProperties}
                onClick={() => setSelectedRehearsalId(r.id)}
              >
                <p className="font-medium" style={{ color: CASA_BRAND.colors.primary.black }}>
                  {format(parseISO(r.date), "EEE d MMM yyyy", { locale: es })}
                </p>
                {(r.start_time || r.end_time) && (
                  <p className="text-sm mt-0.5 flex items-center gap-1" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                    <Clock className="h-3 w-3" />
                    {r.start_time ?? ''}
                    {r.start_time && r.end_time ? ' – ' : ''}
                    {r.end_time ?? ''}
                  </p>
                )}
                {r.location && (
                  <p className="text-sm mt-0.5 flex items-center gap-1" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                    <MapPin className="h-3 w-3" />
                    {r.location}
                  </p>
                )}
                <div className="mt-2 flex gap-2 flex-wrap">
                  <Badge variant={getRehearsalStatusVariant(r.status)}>
                    {REHEARSAL_STATUS_LABELS[r.status]}
                  </Badge>
                  {r.service_date_id && (
                    <Badge variant="outline" className="gap-1">
                      <Link2 className="h-3 w-3" />
                      Vinculado a servicio
                    </Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right panel: Detail */}
        <div className="lg:col-span-2">
          {selectedRehearsalId && selectedRehearsal ? (
            <div className="space-y-6">
              {/* Info header */}
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedRehearsalId(null)}
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
                      {format(parseISO(selectedRehearsal.date), "EEEE d 'de' MMMM yyyy", { locale: es })}
                    </h3>
                    {(selectedRehearsal.start_time || selectedRehearsal.end_time) && (
                      <p className="mt-1 flex items-center gap-1" style={{ color: CASA_BRAND.colors.secondary.grayDark }}>
                        <Clock className="h-4 w-4" />
                        {selectedRehearsal.start_time ?? ''}
                        {selectedRehearsal.start_time && selectedRehearsal.end_time ? ' – ' : ''}
                        {selectedRehearsal.end_time ?? ''}
                      </p>
                    )}
                    {selectedRehearsal.location && (
                      <p className="mt-1 flex items-center gap-1" style={{ color: CASA_BRAND.colors.secondary.grayDark }}>
                        <MapPin className="h-4 w-4" />
                        {selectedRehearsal.location}
                      </p>
                    )}
                    <div className="mt-2 flex gap-2 flex-wrap">
                      <Badge variant={getRehearsalStatusVariant(selectedRehearsal.status)}>
                        {REHEARSAL_STATUS_LABELS[selectedRehearsal.status]}
                      </Badge>
                      {selectedRehearsal.service_date_id && (
                        <Badge variant="outline" className="gap-1">
                          <Link2 className="h-3 w-3" />
                          Vinculado a servicio
                        </Badge>
                      )}
                    </div>
                    {selectedRehearsal.notes && (
                      <p className="mt-3 text-sm" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                        {selectedRehearsal.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {canWrite && (
                      <>
                        <Select
                          value={selectedRehearsal.status}
                          onValueChange={(v) => {
                            updateRehearsal.mutate({
                              id: selectedRehearsal.id,
                              updates: { status: v as RehearsalStatus },
                            });
                          }}
                        >
                          <SelectTrigger className="w-36 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.entries(REHEARSAL_STATUS_LABELS) as [RehearsalStatus, string][]).map(([value, label]) => (
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
                            setEditingRehearsalId(selectedRehearsalId);
                            setEditDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    {canManage && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-500 hover:text-red-600 border-red-200"
                        onClick={() => setDeleteConfirmOpen(true)}
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

                {selectedRehearsal.music_rehearsal_songs.length === 0 ? (
                  <p className="text-sm" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                    No hay canciones en este ensayo.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedRehearsal.music_rehearsal_songs.map((rs, index) => (
                      <div
                        key={rs.id}
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
                              onClick={() => handleMoveSort(selectedRehearsal.music_rehearsal_songs, index, -1)}
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              disabled={index === selectedRehearsal.music_rehearsal_songs.length - 1}
                              onClick={() => handleMoveSort(selectedRehearsal.music_rehearsal_songs, index, 1)}
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{rs.music_songs.title}</span>
                            {rs.music_songs.artist && (
                              <span className="text-xs" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                                — {rs.music_songs.artist}
                              </span>
                            )}
                          </div>
                          {/* Song notes */}
                          {editingNotesSongId === rs.id ? (
                            <Textarea
                              value={editingNotesValue}
                              onChange={(e) => setEditingNotesValue(e.target.value)}
                              onBlur={() => handleSaveNotes(rs.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSaveNotes(rs.id);
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
                                  setEditingNotesSongId(rs.id);
                                  setEditingNotesValue(rs.notes ?? '');
                                }
                              }}
                            >
                              {rs.notes || (canWrite ? 'Agregar nota...' : '')}
                            </p>
                          )}
                        </div>
                        {canWrite && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-600 shrink-0"
                            onClick={() => {
                              setDeletingSongId(rs.id);
                              setDeleteSongConfirmOpen(true);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Asistentes section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4
                    className="text-sm font-semibold uppercase tracking-wider flex items-center gap-1.5"
                    style={{ color: CASA_BRAND.colors.secondary.grayDark }}
                  >
                    <Users className="h-4 w-4" />
                    Asistentes
                  </h4>
                  <div className="flex gap-2">
                    {canWrite && (
                      <>
                        {uninvitedMusicians.length > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setBatchInviteConfirmOpen(true)}
                            className="gap-1"
                          >
                            Invitar todos los activos
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAttendeePickerOpen(true)}
                          className="gap-1"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Invitar músicos
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {selectedRehearsal.music_rehearsal_attendees.length === 0 ? (
                  <p className="text-sm" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                    No hay asistentes invitados a este ensayo.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedRehearsal.music_rehearsal_attendees.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                        style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium">
                            {att.music_musicians.display_name}
                          </span>
                          <Badge variant={getRsvpVariant(att.rsvp_status)}>
                            {RSVP_STATUS_LABELS[att.rsvp_status]}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {selectedRehearsal.status === 'completed' && canWrite && (
                            <div className="flex items-center gap-1.5">
                              <Checkbox
                                checked={att.attended ?? false}
                                onCheckedChange={(checked) => {
                                  updateAttendee.mutate({
                                    id: att.id,
                                    updates: { attended: checked === true },
                                  });
                                }}
                              />
                              <span className="text-xs" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                                Asistió
                              </span>
                            </div>
                          )}
                          {canManage && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-600"
                              onClick={() => {
                                setDeletingAttendeeId(att.id);
                                setDeleteAttendeeConfirmOpen(true);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
              Selecciona un ensayo para ver los detalles.
            </div>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <RehearsalEditDialog
        rehearsalId={editingRehearsalId}
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setEditingRehearsalId(null);
        }}
      />

      {/* Song Picker */}
      {selectedRehearsalId && (
        <RehearsalSongPicker
          rehearsalId={selectedRehearsalId}
          open={songPickerOpen}
          onOpenChange={setSongPickerOpen}
          existingSongIds={existingSongIds}
        />
      )}

      {/* Attendee Picker */}
      {selectedRehearsalId && (
        <RehearsalAttendeePicker
          rehearsalId={selectedRehearsalId}
          open={attendeePickerOpen}
          onOpenChange={setAttendeePickerOpen}
          existingMusicianIds={existingMusicianIds}
        />
      )}

      {/* Delete Rehearsal Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar ensayo</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres eliminar este ensayo? Se eliminarán también todas las canciones y asistentes asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRehearsal}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteRehearsal.isPending ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Song Confirmation */}
      <AlertDialog open={deleteSongConfirmOpen} onOpenChange={setDeleteSongConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quitar canción</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Quitar esta canción del ensayo?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSong}
              className="bg-red-600 hover:bg-red-700"
            >
              {removeSong.isPending ? 'Quitando...' : 'Quitar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Attendee Confirmation */}
      <AlertDialog open={deleteAttendeeConfirmOpen} onOpenChange={setDeleteAttendeeConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quitar músico</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Quitar este músico del ensayo?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAttendee}
              className="bg-red-600 hover:bg-red-700"
            >
              {removeAttendee.isPending ? 'Quitando...' : 'Quitar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Invite Confirmation */}
      <AlertDialog open={batchInviteConfirmOpen} onOpenChange={setBatchInviteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Invitar a todos los músicos activos</AlertDialogTitle>
            <AlertDialogDescription>
              {`¿Invitar a todos los músicos activos? Se enviarán ${uninvitedMusicians.length} invitaciones.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchInvite}>
              {batchAddAttendees.isPending ? 'Invitando...' : 'Invitar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RehearsalManager;
