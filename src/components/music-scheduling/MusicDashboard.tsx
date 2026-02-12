/**
 * MusicDashboard — Summary dashboard for the "Panel" tab.
 *
 * Sections:
 *   1. Stats cards row (6 cards)
 *   2. Upcoming service dates (next 5)
 *   3. Upcoming rehearsals (next 5)
 *   4. Recent activity (last 5 practice sessions)
 *   5. Practice summary bar (conditional)
 *   6. Quick navigation links to other tabs
 */

import { usePermissions } from '@/hooks/usePermissions';
import {
  useSongs,
  useMusicians,
  useUpcomingServiceDates,
  useUpcomingRehearsals,
  useNotificationStats,
  usePracticeStats,
  useRecentPracticeActivity,
  useSetlists,
} from '@/hooks/useMusicLibrary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  ShieldAlert,
  Music,
  Users,
  CalendarDays,
  ListMusic,
  Bell,
  Headphones,
  ArrowRight,
  Trophy,
} from 'lucide-react';
import { CASA_BRAND } from '@/lib/brand-kit';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

/** Format seconds as "Xh Ym" or "Ym" */
const formatDuration = (seconds: number | null): string => {
  if (seconds == null || seconds === 0) return '—';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
};

interface MusicDashboardProps {
  /** Callback to switch active tab in the parent Tabs component */
  onNavigateTab?: (tabValue: string) => void;
}

const MusicDashboard = ({ onNavigateTab }: MusicDashboardProps) => {
  const { canRead, loading: permLoading } = usePermissions('music_scheduling');

  // Data queries — all use existing hooks
  const { data: songs } = useSongs();
  const { data: musicians } = useMusicians();
  const { data: upcomingDates } = useUpcomingServiceDates(5);
  const { data: upcomingRehearsals } = useUpcomingRehearsals(5);
  const { data: notifStats } = useNotificationStats();
  const { data: practiceStats } = usePracticeStats();
  const { data: recentPractice } = useRecentPracticeActivity(5);
  const { data: setlists } = useSetlists();

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
          No tienes permisos para ver el panel de música. Contacta al administrador.
        </AlertDescription>
      </Alert>
    );
  }

  const handleNav = (tab: string) => {
    onNavigateTab?.(tab);
  };

  return (
    <div className="space-y-8">
      {/* ─── Stats Cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Songs */}
        <button
          type="button"
          onClick={() => handleNav('musicos')}
          aria-label="Ver canciones en la biblioteca"
          className="p-4 rounded-lg border text-left hover:bg-gray-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
          style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Music className="h-4 w-4" aria-hidden="true" style={{ color: CASA_BRAND.colors.primary.amber }} />
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
              Canciones
            </span>
          </div>
          <p className="text-2xl font-semibold" style={{ color: CASA_BRAND.colors.primary.black }}>
            {songs?.length ?? '—'}
          </p>
        </button>

        {/* Musicians */}
        <button
          type="button"
          onClick={() => handleNav('musicos')}
          aria-label="Ver músicos registrados"
          className="p-4 rounded-lg border text-left hover:bg-gray-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
          style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4" aria-hidden="true" style={{ color: CASA_BRAND.colors.primary.amber }} />
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
              Músicos
            </span>
          </div>
          <p className="text-2xl font-semibold" style={{ color: CASA_BRAND.colors.primary.black }}>
            {musicians?.length ?? '—'}
          </p>
        </button>

        {/* Upcoming service dates */}
        <button
          type="button"
          onClick={() => handleNav('fechas')}
          aria-label="Ver próximas fechas de servicio"
          className="p-4 rounded-lg border text-left hover:bg-gray-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
          style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
        >
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="h-4 w-4" aria-hidden="true" style={{ color: CASA_BRAND.colors.primary.amber }} />
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
              Próx. fechas
            </span>
          </div>
          <p className="text-2xl font-semibold" style={{ color: CASA_BRAND.colors.primary.black }}>
            {upcomingDates?.length ?? '—'}
          </p>
        </button>

        {/* Setlists */}
        <button
          type="button"
          onClick={() => handleNav('setlists')}
          aria-label="Ver setlists"
          className="p-4 rounded-lg border text-left hover:bg-gray-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
          style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
        >
          <div className="flex items-center gap-2 mb-1">
            <ListMusic className="h-4 w-4" aria-hidden="true" style={{ color: CASA_BRAND.colors.primary.amber }} />
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
              Setlists
            </span>
          </div>
          <p className="text-2xl font-semibold" style={{ color: CASA_BRAND.colors.primary.black }}>
            {setlists?.length ?? '—'}
          </p>
        </button>

        {/* Notifications queued */}
        <button
          type="button"
          onClick={() => handleNav('notificaciones')}
          aria-label="Ver notificaciones"
          className="p-4 rounded-lg border text-left hover:bg-gray-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
          style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Bell className="h-4 w-4" aria-hidden="true" style={{ color: CASA_BRAND.colors.primary.amber }} />
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
              Notificaciones
            </span>
          </div>
          <p className="text-2xl font-semibold" style={{ color: CASA_BRAND.colors.primary.black }}>
            {notifStats?.total ?? '—'}
          </p>
        </button>

        {/* Practice sessions */}
        <button
          type="button"
          onClick={() => handleNav('practica')}
          aria-label="Ver sesiones de práctica"
          className="p-4 rounded-lg border text-left hover:bg-gray-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
          style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Headphones className="h-4 w-4" aria-hidden="true" style={{ color: CASA_BRAND.colors.primary.amber }} />
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
              Práctica
            </span>
          </div>
          <p className="text-2xl font-semibold" style={{ color: CASA_BRAND.colors.primary.black }}>
            {practiceStats?.totalSessions ?? '—'}
          </p>
        </button>
      </div>

      {/* ─── Two-column layout: Upcoming + Recent ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Upcoming Service Dates */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4
              className="text-sm font-semibold uppercase tracking-wider flex items-center gap-1.5"
              style={{ color: CASA_BRAND.colors.secondary.grayDark }}
            >
              <CalendarDays className="h-4 w-4" />
              Próximas fechas de servicio
            </h4>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1"
              onClick={() => handleNav('fechas')}
            >
              Ver todas <ArrowRight className="h-3 w-3" />
            </Button>
          </div>

          {!upcomingDates || upcomingDates.length === 0 ? (
            <div className="text-center py-8" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
              No hay fechas de servicio próximas.
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingDates.map((sd) => (
                <div
                  key={sd.id}
                  className="p-3 rounded-lg border flex items-center justify-between"
                  style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
                >
                  <div>
                    <p className="text-sm font-medium truncate" style={{ color: CASA_BRAND.colors.primary.black }}>
                      {sd.title || sd.service_type}
                    </p>
                    <p className="text-xs" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                      {format(parseISO(sd.date), "EEEE d 'de' MMMM yyyy", { locale: es })}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs capitalize">
                    {sd.service_type}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Upcoming Rehearsals */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4
              className="text-sm font-semibold uppercase tracking-wider flex items-center gap-1.5"
              style={{ color: CASA_BRAND.colors.secondary.grayDark }}
            >
              <Music className="h-4 w-4" />
              Próximos ensayos
            </h4>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1"
              onClick={() => handleNav('ensayos')}
            >
              Ver todos <ArrowRight className="h-3 w-3" />
            </Button>
          </div>

          {!upcomingRehearsals || upcomingRehearsals.length === 0 ? (
            <div className="text-center py-8" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
              No hay ensayos próximos.
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingRehearsals.map((r) => {
                // Format date with optional time
                const dateStr = format(parseISO(r.date), "EEEE d 'de' MMMM", { locale: es });
                const dateTimeStr = r.start_time ? `${dateStr}, ${r.start_time}` : dateStr;

                return (
                  <div
                    key={r.id}
                    className="p-3 rounded-lg border flex items-center justify-between"
                    style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
                  >
                    <div>
                      <p className="text-sm font-medium truncate" style={{ color: CASA_BRAND.colors.primary.black }}>
                        {r.location || 'Ensayo'}
                      </p>
                      <p className="text-xs" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                        {dateTimeStr}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs capitalize">
                      {r.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── Recent Practice Activity ──────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4
            className="text-sm font-semibold uppercase tracking-wider flex items-center gap-1.5"
            style={{ color: CASA_BRAND.colors.secondary.grayDark }}
          >
            <Trophy className="h-4 w-4" />
            Actividad de práctica reciente
          </h4>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs gap-1"
            onClick={() => handleNav('practica')}
          >
            Ver todo <ArrowRight className="h-3 w-3" />
          </Button>
        </div>

        {!recentPractice || recentPractice.length === 0 ? (
          <div className="text-center py-8" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
            No hay actividad de práctica reciente.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentPractice.map((session) => (
              <div
                key={session.id}
                className="p-3 rounded-lg border"
                style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
              >
                <p className="text-sm font-medium truncate" style={{ color: CASA_BRAND.colors.primary.black }}>
                  {session.music_songs.title}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                    {format(parseISO(session.started_at), "d MMM, HH:mm", { locale: es })}
                  </span>
                  {session.duration_seconds != null && (
                    <Badge variant="secondary" className="text-xs">
                      {formatDuration(session.duration_seconds)}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Practice summary bar ──────────────────────────────────────── */}
      {practiceStats && practiceStats.totalSessions > 0 && (
        <div
          className="p-4 rounded-lg border flex flex-wrap items-center justify-between gap-4"
          style={{
            borderColor: CASA_BRAND.colors.amber.light,
            backgroundColor: `${CASA_BRAND.colors.primary.amber}08`,
          }}
        >
          <div className="flex items-center gap-3">
            <Headphones className="h-5 w-5" style={{ color: CASA_BRAND.colors.primary.amber }} />
            <span className="text-sm font-medium" style={{ color: CASA_BRAND.colors.primary.black }}>
              Resumen de práctica
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm" style={{ color: CASA_BRAND.colors.secondary.grayDark }}>
            <span>{practiceStats.totalSessions} sesiones</span>
            <span>{formatDuration(practiceStats.totalDurationSeconds)} total</span>
            <span>{practiceStats.uniqueSongs} canciones</span>
            <span>{practiceStats.uniqueUsers} músicos</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MusicDashboard;
