/**
 * PracticeTracker — Main orchestrator for the "Práctica" tab.
 *
 * Layout:
 *   Top: Stats cards (4 cards in a row)
 *   Middle: Filter bar (song dropdown, date range)
 *   Bottom: Session table + leaderboard
 */

import { useState, useMemo } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import {
  usePracticeSessions,
  usePracticeStats,
  usePracticeSongLeaderboard,
  useDeletePracticeSession,
  useSongs,
} from '@/hooks/useMusicLibrary';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Trash2,
  Pencil,
  Headphones,
  Clock,
  Music,
  Users,
  Trophy,
  AlertCircle,
} from 'lucide-react';
import { CASA_BRAND } from '@/lib/brand-kit';
import { STEM_TYPE_LABELS } from '@/lib/music-planning/practiceLabels';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { PracticeSessionFilters } from '@/lib/music-planning/practiceService';
import type { StemType } from '@/types/musicPlanning';
import PracticeLogDialog from './PracticeLogDialog';

const ALL_SONGS = '__all__';

/** Format seconds as "Xh Ym" or "Ym" */
const formatDuration = (seconds: number | null): string => {
  if (seconds == null || seconds === 0) return '—';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
};

const PracticeTracker = () => {
  const { canRead, canWrite, canManage, loading: permLoading } = usePermissions('music_scheduling');

  // Filters
  const [filterSongId, setFilterSongId] = useState<string>(ALL_SONGS);
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  // Dialog state
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);

  // Delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  // Build filters object
  const filters: PracticeSessionFilters | undefined = useMemo(() => {
    const f: PracticeSessionFilters = {};
    if (filterSongId !== ALL_SONGS) f.songId = filterSongId;
    if (filterFrom) f.from = filterFrom;
    if (filterTo) f.to = filterTo;
    return Object.keys(f).length > 0 ? f : undefined;
  }, [filterSongId, filterFrom, filterTo]);

  // Data
  const { data: sessions, isLoading: sessionsLoading, isError } = usePracticeSessions(filters);
  const { data: stats } = usePracticeStats();
  const { data: leaderboard } = usePracticeSongLeaderboard(5);
  const { data: songs } = useSongs();

  // Mutations
  const deleteSession = useDeletePracticeSession();

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
          No tienes permisos para ver las sesiones de práctica. Contacta al administrador.
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
          Error al cargar las sesiones de práctica. Intenta nuevamente.
        </AlertDescription>
      </Alert>
    );
  }

  const handleDelete = () => {
    if (!deletingSessionId) return;
    deleteSession.mutate(deletingSessionId, {
      onSettled: () => {
        setDeleteConfirmOpen(false);
        setDeletingSessionId(null);
      },
    });
  };

  const handleEdit = (sessionId: string) => {
    setEditingSessionId(sessionId);
    setLogDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingSessionId(null);
    setLogDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div
            className="p-4 rounded-lg border"
            style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Headphones className="h-4 w-4" style={{ color: CASA_BRAND.colors.primary.amber }} />
              <span className="text-xs font-medium uppercase tracking-wider" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                Sesiones totales
              </span>
            </div>
            <p className="text-2xl font-semibold" style={{ color: CASA_BRAND.colors.primary.black }}>
              {stats.totalSessions}
            </p>
          </div>

          <div
            className="p-4 rounded-lg border"
            style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4" style={{ color: CASA_BRAND.colors.primary.amber }} />
              <span className="text-xs font-medium uppercase tracking-wider" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                Tiempo total
              </span>
            </div>
            <p className="text-2xl font-semibold" style={{ color: CASA_BRAND.colors.primary.black }}>
              {formatDuration(stats.totalDurationSeconds)}
            </p>
          </div>

          <div
            className="p-4 rounded-lg border"
            style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Music className="h-4 w-4" style={{ color: CASA_BRAND.colors.primary.amber }} />
              <span className="text-xs font-medium uppercase tracking-wider" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                Canciones únicas
              </span>
            </div>
            <p className="text-2xl font-semibold" style={{ color: CASA_BRAND.colors.primary.black }}>
              {stats.uniqueSongs}
            </p>
          </div>

          <div
            className="p-4 rounded-lg border"
            style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4" style={{ color: CASA_BRAND.colors.primary.amber }} />
              <span className="text-xs font-medium uppercase tracking-wider" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                Usuarios activos
              </span>
            </div>
            <p className="text-2xl font-semibold" style={{ color: CASA_BRAND.colors.primary.black }}>
              {stats.uniqueUsers}
            </p>
          </div>
        </div>
      )}

      {/* Filter bar + action button */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label className="text-xs" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>Canción</Label>
          <Select value={filterSongId} onValueChange={setFilterSongId}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_SONGS}>Todas las canciones</SelectItem>
              {songs?.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>Desde</Label>
          <Input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="w-40"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>Hasta</Label>
          <Input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="w-40"
          />
        </div>

        <div className="ml-auto">
          {canWrite && (
            <Button onClick={handleCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Registrar sesión
            </Button>
          )}
        </div>
      </div>

      {/* Main content: sessions table + leaderboard sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sessions table */}
        <div className="lg:col-span-2">
          <h4
            className="text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5"
            style={{ color: CASA_BRAND.colors.secondary.grayDark }}
          >
            <Headphones className="h-4 w-4" />
            Sesiones de práctica
          </h4>

          {sessionsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !sessions || sessions.length === 0 ? (
            <div className="text-center py-12" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
              No hay sesiones de práctica registradas.
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="p-4 rounded-lg border hover:bg-gray-50 transition-colors"
                  style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm" style={{ color: CASA_BRAND.colors.primary.black }}>
                        {session.music_songs.title}
                        {session.music_songs.artist && (
                          <span className="font-normal" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                            {' '}— {session.music_songs.artist}
                          </span>
                        )}
                      </p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-xs" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                          {format(parseISO(session.started_at), "d MMM yyyy, HH:mm", { locale: es })}
                        </span>
                        {session.duration_seconds != null && (
                          <Badge variant="secondary" className="text-xs">
                            {formatDuration(session.duration_seconds)}
                          </Badge>
                        )}
                        {session.tempo_factor !== 1.0 && (
                          <Badge variant="outline" className="text-xs">
                            Tempo: {session.tempo_factor}x
                          </Badge>
                        )}
                        {session.stem_volumes && Object.keys(session.stem_volumes).length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {Object.keys(session.stem_volumes).length} stems
                          </Badge>
                        )}
                        {(session.loop_start != null || session.loop_end != null) && (
                          <Badge variant="outline" className="text-xs">
                            Loop: {session.loop_start ?? 0}s–{session.loop_end ?? '∞'}s
                          </Badge>
                        )}
                      </div>
                      {/* Stem volumes detail */}
                      {session.stem_volumes && Object.keys(session.stem_volumes).length > 0 && (
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {Object.entries(session.stem_volumes).map(([key, vol]) => (
                            <span
                              key={key}
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{
                                backgroundColor: CASA_BRAND.colors.secondary.grayLight,
                                color: CASA_BRAND.colors.secondary.grayDark,
                              }}
                            >
                              {STEM_TYPE_LABELS[key as StemType] ?? key}: {Math.round((vol as number) * 100)}%
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {canWrite && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleEdit(session.id)}
                          aria-label="Editar sesión"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                          onClick={() => {
                            setDeletingSessionId(session.id);
                            setDeleteConfirmOpen(true);
                          }}
                          aria-label="Eliminar sesión"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Leaderboard sidebar */}
        <div className="lg:col-span-1">
          <h4
            className="text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5"
            style={{ color: CASA_BRAND.colors.secondary.grayDark }}
          >
            <Trophy className="h-4 w-4" />
            Más practicadas
          </h4>

          {!leaderboard || leaderboard.length === 0 ? (
            <div className="text-center py-8" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
              Sin datos de práctica aún.
            </div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry, idx) => (
                <div
                  key={entry.songId}
                  className="p-3 rounded-lg border"
                  style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="text-sm font-bold w-6 text-center"
                      style={{ color: CASA_BRAND.colors.primary.amber }}
                    >
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: CASA_BRAND.colors.primary.black }}>
                        {entry.songTitle}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                          {entry.sessionCount} {entry.sessionCount === 1 ? 'sesión' : 'sesiones'}
                        </span>
                        <span className="text-xs" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                          •
                        </span>
                        <span className="text-xs" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                          {formatDuration(entry.totalDurationSeconds)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Log Dialog */}
      <PracticeLogDialog
        open={logDialogOpen}
        onOpenChange={(open) => {
          setLogDialogOpen(open);
          if (!open) setEditingSessionId(null);
        }}
        sessionId={editingSessionId}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar sesión de práctica</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres eliminar esta sesión de práctica? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteSession.isPending ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PracticeTracker;
