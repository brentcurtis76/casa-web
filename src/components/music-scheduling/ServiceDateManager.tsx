/**
 * ServiceDateManager — Manages upcoming service dates (the "Fechas de servicio" tab).
 *
 * Two-panel layout: Calendar on left, service date list/detail on right.
 */

import { useState, useMemo } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import {
  useServiceDates,
  useServiceDateById,
  useCreateServiceDate,
  useUpdateServiceDate,
  useDeleteServiceDate,
  useOverridesForDate,
  useAssignmentsForDate,
} from '@/hooks/useMusicLibrary';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Plus, ShieldAlert, Pencil, Trash2, ArrowLeft, AlertCircle } from 'lucide-react';
import {
  SERVICE_TYPE_LABELS,
  SERVICE_STATUS_LABELS,
  OVERRIDE_STATUS_LABELS,
  INSTRUMENT_LABELS,
} from '@/lib/music-planning/musicianLabels';
import { CASA_BRAND } from '@/lib/brand-kit';
import { format, startOfMonth, endOfMonth, isSameDay, parseISO, isSameMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ServiceType, ServiceDateStatus, MusicServiceDateRow } from '@/types/musicPlanning';

const ServiceDateManager = () => {
  const { canRead, canWrite, canManage, loading: permLoading } = usePermissions('music_scheduling');

  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedDateId, setSelectedDateId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingDateId, setDeletingDateId] = useState<string | null>(null);

  // Create form state
  const [newDate, setNewDate] = useState('');
  const [newServiceType, setNewServiceType] = useState<ServiceType>('domingo_principal');
  const [newTitle, setNewTitle] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Date range for current month view
  const fromDate = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
  const toDate = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');

  const { data: serviceDates, isLoading, isError } = useServiceDates(fromDate, toDate);
  const { data: selectedServiceDate } = useServiceDateById(selectedDateId);
  const { data: overridesForSelected } = useOverridesForDate(selectedDateId);
  const { data: assignmentsForSelected } = useAssignmentsForDate(selectedDateId);

  const createServiceDate = useCreateServiceDate();
  const updateServiceDate = useUpdateServiceDate();
  const deleteServiceDate = useDeleteServiceDate();

  // Dates that have service dates for calendar highlighting
  const serviceDateDays = useMemo(() => {
    if (!serviceDates) return [];
    return serviceDates.map((sd) => parseISO(sd.date));
  }, [serviceDates]);

  // Filter service dates for the selected month
  const monthDates = useMemo(() => {
    if (!serviceDates) return [];
    return serviceDates.filter((sd) => isSameMonth(parseISO(sd.date), selectedMonth));
  }, [serviceDates, selectedMonth]);

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
          No tienes permisos para ver las fechas de servicio.
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
          Error al cargar las fechas de servicio. Intenta nuevamente.
        </AlertDescription>
      </Alert>
    );
  }

  const handleDayClick = (day: Date) => {
    // Check if there's a service date on this day
    const match = serviceDates?.find((sd) => isSameDay(parseISO(sd.date), day));
    if (match) {
      setSelectedDateId(match.id);
    }
  };

  const handleCreateSubmit = () => {
    if (!newDate) return;
    createServiceDate.mutate(
      {
        date: newDate,
        service_type: newServiceType,
        title: newTitle.trim() || null,
        notes: newNotes.trim() || null,
      },
      {
        onSuccess: () => {
          setCreateDialogOpen(false);
          setNewDate('');
          setNewServiceType('domingo_principal');
          setNewTitle('');
          setNewNotes('');
        },
      }
    );
  };

  const handleDeleteConfirm = () => {
    if (!deletingDateId) return;
    deleteServiceDate.mutate(deletingDateId, {
      onSettled: () => {
        setDeleteConfirmOpen(false);
        setDeletingDateId(null);
        if (selectedDateId === deletingDateId) {
          setSelectedDateId(null);
        }
      },
    });
  };

  const getStatusVariant = (status: ServiceDateStatus) => {
    switch (status) {
      case 'confirmed': return 'default' as const;
      case 'completed': return 'secondary' as const;
      default: return 'outline' as const;
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Calendar */}
        <div className="lg:col-span-1">
          <div className="border rounded-lg p-4" style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}>
            <Calendar
              mode="single"
              month={selectedMonth}
              onMonthChange={setSelectedMonth}
              onSelect={(day) => day && handleDayClick(day)}
              modifiers={{ serviceDate: serviceDateDays }}
              modifiersStyles={{
                serviceDate: {
                  backgroundColor: `${CASA_BRAND.colors.primary.amber}30`,
                  fontWeight: 600,
                  borderRadius: '50%',
                },
              }}
            />
            {canWrite && (
              <div className="mt-4 pt-4 border-t" style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}>
                <Button
                  onClick={() => setCreateDialogOpen(true)}
                  className="w-full gap-2"
                  variant="outline"
                >
                  <Plus className="h-4 w-4" />
                  Nueva fecha
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Right: List or Detail */}
        <div className="lg:col-span-2">
          {selectedDateId && selectedServiceDate ? (
            // Detail view
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedDateId(null)}
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
                      {format(parseISO(selectedServiceDate.date), "EEEE d 'de' MMMM yyyy", { locale: es })}
                    </h3>
                    {selectedServiceDate.title && (
                      <p className="mt-1" style={{ color: CASA_BRAND.colors.secondary.grayDark }}>
                        {selectedServiceDate.title}
                      </p>
                    )}
                    <div className="mt-2 flex gap-2">
                      <Badge variant="secondary">
                        {SERVICE_TYPE_LABELS[selectedServiceDate.service_type]}
                      </Badge>
                      <Badge variant={getStatusVariant(selectedServiceDate.status)}>
                        {SERVICE_STATUS_LABELS[selectedServiceDate.status]}
                      </Badge>
                    </div>
                    {selectedServiceDate.notes && (
                      <p className="mt-3 text-sm" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                        {selectedServiceDate.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {canWrite && (
                      <Select
                        value={selectedServiceDate.status}
                        onValueChange={(v) => {
                          updateServiceDate.mutate({
                            id: selectedServiceDate.id,
                            updates: { status: v as ServiceDateStatus },
                          });
                        }}
                      >
                        <SelectTrigger className="w-36 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.entries(SERVICE_STATUS_LABELS) as [ServiceDateStatus, string][]).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {canManage && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-500 hover:text-red-600 border-red-200"
                        onClick={() => {
                          setDeletingDateId(selectedServiceDate.id);
                          setDeleteConfirmOpen(true);
                        }}
                        aria-label="Eliminar fecha de servicio"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Availability section */}
              <div>
                <h4
                  className="text-sm font-semibold uppercase tracking-wider mb-3"
                  style={{ color: CASA_BRAND.colors.secondary.grayDark }}
                >
                  Disponibilidad
                </h4>
                {!overridesForSelected || overridesForSelected.length === 0 ? (
                  <p className="text-sm" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                    No hay respuestas de disponibilidad para esta fecha.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {overridesForSelected.map((override) => (
                      <div
                        key={override.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                        style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
                      >
                        <span className="text-sm font-medium">
                          {override.music_musicians.display_name}
                        </span>
                        <Badge
                          variant={
                            override.status === 'available'
                              ? 'default'
                              : override.status === 'unavailable'
                                ? 'destructive'
                                : 'secondary'
                          }
                        >
                          {OVERRIDE_STATUS_LABELS[override.status]}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assignments section */}
              <div>
                <h4
                  className="text-sm font-semibold uppercase tracking-wider mb-3"
                  style={{ color: CASA_BRAND.colors.secondary.grayDark }}
                >
                  Asignaciones
                </h4>
                {!assignmentsForSelected || assignmentsForSelected.length === 0 ? (
                  <p className="text-sm" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                    No hay asignaciones para esta fecha.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {assignmentsForSelected.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                        style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
                      >
                        <span className="text-sm font-medium">
                          {assignment.music_musicians.display_name}
                        </span>
                        <Badge variant="outline">
                          {INSTRUMENT_LABELS[assignment.assigned_instrument as keyof typeof INSTRUMENT_LABELS] ?? assignment.assigned_instrument}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            // List view
            <div className="space-y-3">
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : monthDates.length === 0 ? (
                <div className="text-center py-12" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                  No hay fechas de servicio para este mes.
                </div>
              ) : (
                monthDates.map((sd) => (
                  <div
                    key={sd.id}
                    className="flex items-center justify-between p-4 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors"
                    style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
                    onClick={() => setSelectedDateId(sd.id)}
                  >
                    <div>
                      <p className="font-medium" style={{ color: CASA_BRAND.colors.primary.black }}>
                        {format(parseISO(sd.date), "EEE d MMM yyyy", { locale: es })}
                      </p>
                      {sd.title && (
                        <p className="text-sm mt-0.5" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                          {sd.title}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="secondary">
                        {SERVICE_TYPE_LABELS[sd.service_type]}
                      </Badge>
                      <Badge variant={getStatusVariant(sd.status)}>
                        {SERVICE_STATUS_LABELS[sd.status]}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Service Date Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: CASA_BRAND.fonts.heading, fontWeight: 300 }}>
              Nueva fecha de servicio
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Fecha *</Label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de servicio</Label>
              <Select value={newServiceType} onValueChange={(v) => setNewServiceType(v as ServiceType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(SERVICE_TYPE_LABELS) as [ServiceType, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Título (opcional)</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ej: Domingo de Pentecostés"
              />
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Notas opcionales..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateSubmit} disabled={!newDate || createServiceDate.isPending}>
              {createServiceDate.isPending ? 'Creando...' : 'Crear fecha'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar fecha de servicio</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres eliminar esta fecha de servicio? Se eliminarán también todas las asignaciones y respuestas de disponibilidad asociadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteServiceDate.isPending ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ServiceDateManager;
