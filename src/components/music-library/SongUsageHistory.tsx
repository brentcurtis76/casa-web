/**
 * SongUsageHistory — Stats display + history table for a song's usage.
 *
 * Uses useSongUsageStats and useSongUsage hooks to display aggregated
 * stats and a chronological history of when the song was used.
 */

import { useSongUsage, useSongUsageStats } from '@/hooks/useMusicLibrary';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, BarChart3, Clock, Hash } from 'lucide-react';
import { MOMENT_LABELS } from '@/lib/canciones/songTagsManager';
import { CASA_BRAND } from '@/lib/brand-kit';
import type { LiturgicalMoment } from '@/types/shared/song';

interface SongUsageHistoryProps {
  songId: string;
}

const SongUsageHistory = ({ songId }: SongUsageHistoryProps) => {
  const { data: stats, isLoading: statsLoading } = useSongUsageStats(songId);
  const { data: usageHistory, isLoading: historyLoading } = useSongUsage(songId);

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-CL', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Stats overview */}
      <div className="space-y-3">
        <h3
          className="text-sm font-semibold uppercase tracking-wider"
          style={{ color: CASA_BRAND.colors.secondary.grayDark }}
        >
          Estadísticas de uso
        </h3>

        {statsLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<Hash className="h-4 w-4" />}
              label="Usos totales"
              value={stats.totalUses.toString()}
            />
            <StatCard
              icon={<Calendar className="h-4 w-4" />}
              label="Último uso"
              value={stats.lastUsed ? formatDate(stats.lastUsed) : 'Nunca'}
            />
            <StatCard
              icon={<Clock className="h-4 w-4" />}
              label="Intervalo promedio"
              value={stats.avgGapDays > 0 ? `${Math.round(stats.avgGapDays)} días` : '--'}
            />
            <StatCard
              icon={<BarChart3 className="h-4 w-4" />}
              label="Momentos"
              value={stats.moments.length.toString()}
            />
          </div>
        ) : (
          <p className="text-sm" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
            No hay datos de uso disponibles.
          </p>
        )}

        {/* Moments used in */}
        {stats && stats.moments.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {stats.moments.map((moment) => (
              <Badge key={moment} variant="secondary" className="text-xs">
                {MOMENT_LABELS[moment as LiturgicalMoment] ?? moment}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Usage history table */}
      <div className="space-y-3">
        <h3
          className="text-sm font-semibold uppercase tracking-wider"
          style={{ color: CASA_BRAND.colors.secondary.grayDark }}
        >
          Historial de uso
        </h3>

        {historyLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !usageHistory || usageHistory.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
            Esta canción no ha sido usada en ningún servicio.
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Momento</TableHead>
                  <TableHead className="hidden sm:table-cell">Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usageHistory.map((usage) => (
                  <TableRow key={usage.id}>
                    <TableCell className="text-sm">
                      {formatDate(usage.service_date)}
                    </TableCell>
                    <TableCell>
                      {usage.liturgical_moment ? (
                        <Badge variant="secondary" className="text-xs">
                          {MOMENT_LABELS[usage.liturgical_moment as LiturgicalMoment] ?? usage.liturgical_moment}
                        </Badge>
                      ) : (
                        <span style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>--</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm" style={{ color: CASA_BRAND.colors.secondary.grayDark }}>
                      {usage.notes ?? '--'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Small stat card ─────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

const StatCard = ({ icon, label, value }: StatCardProps) => (
  <div
    className="border rounded-md p-3"
    style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
  >
    <div className="flex items-center gap-2 mb-1">
      <span style={{ color: CASA_BRAND.colors.primary.amber }}>{icon}</span>
      <span
        className="text-xs uppercase tracking-wider"
        style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
      >
        {label}
      </span>
    </div>
    <p
      className="text-lg"
      style={{
        fontFamily: CASA_BRAND.fonts.heading,
        color: CASA_BRAND.colors.primary.black,
        fontWeight: 300,
      }}
    >
      {value}
    </p>
  </div>
);

export default SongUsageHistory;
