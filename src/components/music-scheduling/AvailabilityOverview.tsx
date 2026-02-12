/**
 * AvailabilityOverview — Matrix/grid view showing musician availability
 * across upcoming service dates.
 *
 * Rows: Active musicians
 * Columns: Upcoming service dates
 * Cells: Availability status (computed from overrides + recurring patterns)
 */

import { useState, useMemo } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import {
  useMusiciansFullData,
  useUpcomingServiceDates,
  useAllOverridesForDates,
  useUpsertOverride,
} from '@/hooks/useMusicLibrary';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ShieldAlert, Check, X, HelpCircle, Minus } from 'lucide-react';
import { OVERRIDE_STATUS_LABELS, SERVICE_TYPE_LABELS } from '@/lib/music-planning/musicianLabels';
import { computeAvailabilityStatus } from '@/lib/music-planning/availabilityHelpers';
import { CASA_BRAND } from '@/lib/brand-kit';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type {
  MusicianFull,
  MusicServiceDateRow,
  AvailabilityOverrideStatus,
} from '@/types/musicPlanning';

type AvailabilityStatus = 'available' | 'unavailable' | 'maybe' | 'unknown';

const STATUS_ICONS: Record<AvailabilityStatus, React.ReactNode> = {
  available: <Check className="h-4 w-4" />,
  unavailable: <X className="h-4 w-4" />,
  maybe: <HelpCircle className="h-4 w-4" />,
  unknown: <Minus className="h-4 w-4" />,
};

const STATUS_COLORS: Record<AvailabilityStatus, string> = {
  available: '#22c55e',
  unavailable: '#ef4444',
  maybe: CASA_BRAND.colors.primary.amber,
  unknown: '#9ca3af',
};

const AvailabilityOverview = () => {
  const { canRead, canWrite, loading: permLoading } = usePermissions('music_scheduling');

  const { data: upcomingDates, isLoading: datesLoading } = useUpcomingServiceDates(8);
  const { data: fullMusicians, isLoading: musiciansLoading } = useMusiciansFullData();

  const serviceDateIds = useMemo(
    () => upcomingDates?.map((d) => d.id) ?? [],
    [upcomingDates]
  );
  const { data: allOverrides } = useAllOverridesForDates(serviceDateIds);

  const upsertOverride = useUpsertOverride();

  // Popover state
  const [activeCell, setActiveCell] = useState<{ musicianId: string; serviceDateId: string } | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<AvailabilityOverrideStatus>('available');

  if (permLoading || datesLoading || musiciansLoading) {
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
          No tienes permisos para ver la disponibilidad.
        </AlertDescription>
      </Alert>
    );
  }

  if (!upcomingDates || upcomingDates.length === 0) {
    return (
      <div className="text-center py-12" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
        No hay fechas de servicio próximas.
      </div>
    );
  }

  if (!fullMusicians || fullMusicians.length === 0) {
    return (
      <div className="text-center py-12" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
        No hay músicos activos registrados.
      </div>
    );
  }

  const getStatus = (musician: MusicianFull, serviceDate: MusicServiceDateRow): AvailabilityStatus => {
    return computeAvailabilityStatus(musician, serviceDate, allOverrides ?? []);
  };

  const handleUpsert = (musicianId: string, serviceDateId: string) => {
    upsertOverride.mutate(
      {
        musician_id: musicianId,
        service_date_id: serviceDateId,
        status: overrideStatus,
      },
      {
        onSuccess: () => {
          setActiveCell(null);
        },
      }
    );
  };

  // Compute summary counts
  const getSummary = (serviceDate: MusicServiceDateRow) => {
    const counts = { available: 0, unavailable: 0, maybe: 0, unknown: 0 };
    for (const musician of fullMusicians) {
      const status = getStatus(musician, serviceDate);
      counts[status]++;
    }
    return counts;
  };

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        <table className="min-w-full border-collapse">
          <thead>
            <tr>
              <th
                className="sticky left-0 bg-white z-10 px-4 py-3 text-left text-sm font-semibold border-b"
                style={{ color: CASA_BRAND.colors.primary.black, borderColor: CASA_BRAND.colors.secondary.grayLight }}
              >
                Músico
              </th>
              {upcomingDates.map((sd) => (
                <th
                  key={sd.id}
                  className="px-3 py-3 text-center text-xs font-medium border-b min-w-[80px]"
                  style={{ color: CASA_BRAND.colors.secondary.grayDark, borderColor: CASA_BRAND.colors.secondary.grayLight }}
                >
                  <div>{format(parseISO(sd.date), 'd MMM', { locale: es })}</div>
                  <div className="mt-0.5">
                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                      {SERVICE_TYPE_LABELS[sd.service_type].slice(0, 3)}
                    </Badge>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fullMusicians.map((musician) => (
              <tr key={musician.id} className="hover:bg-gray-50">
                <td
                  className="sticky left-0 bg-white z-10 px-4 py-2 text-sm font-medium border-b"
                  style={{ color: CASA_BRAND.colors.primary.black, borderColor: CASA_BRAND.colors.secondary.grayLight }}
                >
                  {musician.display_name}
                </td>
                {upcomingDates.map((sd) => {
                  const status = getStatus(musician, sd);
                  const isActive = activeCell?.musicianId === musician.id && activeCell?.serviceDateId === sd.id;

                  return (
                    <td
                      key={sd.id}
                      className="px-3 py-2 text-center border-b"
                      style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
                    >
                      {canWrite ? (
                        <Popover
                          open={isActive}
                          onOpenChange={(open) => {
                            if (open) {
                              setActiveCell({ musicianId: musician.id, serviceDateId: sd.id });
                              setOverrideStatus('available');
                            } else {
                              setActiveCell(null);
                            }
                          }}
                        >
                          <PopoverTrigger asChild>
                            <button
                              className="w-8 h-8 rounded-full flex items-center justify-center mx-auto transition-colors hover:opacity-80"
                              style={{ color: STATUS_COLORS[status] }}
                              title={OVERRIDE_STATUS_LABELS[status as AvailabilityOverrideStatus] ?? 'Sin respuesta'}
                            >
                              {STATUS_ICONS[status]}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 p-3">
                            <div className="space-y-3">
                              <p className="text-sm font-medium">Actualizar disponibilidad</p>
                              <Select
                                value={overrideStatus}
                                onValueChange={(v) => setOverrideStatus(v as AvailabilityOverrideStatus)}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {(Object.entries(OVERRIDE_STATUS_LABELS) as [AvailabilityOverrideStatus, string][]).map(
                                    ([value, label]) => (
                                      <SelectItem key={value} value={value}>
                                        {label}
                                      </SelectItem>
                                    )
                                  )}
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                className="w-full"
                                onClick={() => handleUpsert(musician.id, sd.id)}
                                disabled={upsertOverride.isPending}
                              >
                                {upsertOverride.isPending ? 'Guardando...' : 'Guardar'}
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center mx-auto"
                          style={{ color: STATUS_COLORS[status] }}
                          title={OVERRIDE_STATUS_LABELS[status as AvailabilityOverrideStatus] ?? 'Sin respuesta'}
                        >
                          {STATUS_ICONS[status]}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Summary row */}
            <tr className="bg-gray-50 font-medium">
              <td
                className="sticky left-0 bg-gray-50 z-10 px-4 py-2 text-xs uppercase tracking-wider border-t"
                style={{ color: CASA_BRAND.colors.secondary.grayDark, borderColor: CASA_BRAND.colors.secondary.grayLight }}
              >
                Resumen
              </td>
              {upcomingDates.map((sd) => {
                const summary = getSummary(sd);
                return (
                  <td
                    key={sd.id}
                    className="px-3 py-2 text-center border-t"
                    style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
                  >
                    <div className="flex items-center justify-center gap-1 text-xs">
                      <span style={{ color: STATUS_COLORS.available }}>{summary.available}</span>
                      <span style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>/</span>
                      <span style={{ color: STATUS_COLORS.maybe }}>{summary.maybe}</span>
                      <span style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>/</span>
                      <span style={{ color: STATUS_COLORS.unavailable }}>{summary.unavailable}</span>
                    </div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs" style={{ color: CASA_BRAND.colors.secondary.grayDark }}>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ color: STATUS_COLORS.available }}>
            <Check className="h-3 w-3" />
          </div>
          Disponible
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ color: STATUS_COLORS.unavailable }}>
            <X className="h-3 w-3" />
          </div>
          No disponible
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ color: STATUS_COLORS.maybe }}>
            <HelpCircle className="h-3 w-3" />
          </div>
          Tal vez
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ color: STATUS_COLORS.unknown }}>
            <Minus className="h-3 w-3" />
          </div>
          Sin respuesta
        </div>
      </div>
    </div>
  );
};

export default AvailabilityOverview;
