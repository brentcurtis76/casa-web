/**
 * MusicianDetailSheet — Right-side sheet showing full musician details.
 *
 * Uses useMusicianById() for the full nested query (instruments + recurring availability).
 * Contains 3 tabs: Instrumentos, Disponibilidad, Excepciones.
 */

import { useState } from 'react';
import {
  useMusicianById,
  useAddInstrument,
  useRemoveInstrument,
  useUpdateInstrument,
  useCreateRecurringAvailability,
  useDeleteRecurringAvailability,
  useOverridesForMusician,
} from '@/hooks/useMusicLibrary';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Pencil, Trash2, Music, CalendarCheck, CalendarX2, Plus, MessageSquare, Phone, Mail } from 'lucide-react';
import {
  INSTRUMENT_LABELS,
  PROFICIENCY_LABELS,
  PATTERN_LABELS,
  OVERRIDE_STATUS_LABELS,
} from '@/lib/music-planning/musicianLabels';
import { CASA_BRAND } from '@/lib/brand-kit';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type {
  InstrumentType,
  ProficiencyLevel,
  AvailabilityPatternType,
  MusicMusicianInstrumentRow,
} from '@/types/musicPlanning';

interface MusicianDetailSheetProps {
  musicianId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canWrite: boolean;
  canManage: boolean;
  onEditClick: () => void;
  onDeleteClick: (id: string, name: string) => void;
}

const MusicianDetailSheet = ({
  musicianId,
  open,
  onOpenChange,
  canWrite,
  canManage,
  onEditClick,
  onDeleteClick,
}: MusicianDetailSheetProps) => {
  const { data: musician, isLoading } = useMusicianById(musicianId);
  const { data: overrides } = useOverridesForMusician(musicianId);

  // Instrument add form state
  const [addInstrumentOpen, setAddInstrumentOpen] = useState(false);
  const [newInstrument, setNewInstrument] = useState<InstrumentType>('vocals');
  const [newProficiency, setNewProficiency] = useState<ProficiencyLevel>('intermediate');
  const [newIsPrimary, setNewIsPrimary] = useState(false);

  // Delete instrument state
  const [deleteInstrumentOpen, setDeleteInstrumentOpen] = useState(false);
  const [deletingInstrument, setDeletingInstrument] = useState<MusicMusicianInstrumentRow | null>(null);

  // Delete pattern state
  const [deletePatternOpen, setDeletePatternOpen] = useState(false);
  const [deletingPatternId, setDeletingPatternId] = useState<string | null>(null);

  // Availability pattern form state
  const [addPatternOpen, setAddPatternOpen] = useState(false);
  const [newPatternType, setNewPatternType] = useState<AvailabilityPatternType>('every_week');
  const [newEffectiveFrom, setNewEffectiveFrom] = useState('');
  const [newEffectiveUntil, setNewEffectiveUntil] = useState('');
  const [newPatternNotes, setNewPatternNotes] = useState('');

  const addInstrument = useAddInstrument();
  const removeInstrument = useRemoveInstrument();
  const updateInstrument = useUpdateInstrument();
  const createAvailability = useCreateRecurringAvailability();
  const deleteAvailability = useDeleteRecurringAvailability();

  const handleAddInstrument = () => {
    if (!musicianId) return;
    addInstrument.mutate(
      {
        musician_id: musicianId,
        instrument: newInstrument,
        proficiency: newProficiency,
        is_primary: newIsPrimary,
      },
      {
        onSuccess: () => {
          setAddInstrumentOpen(false);
          setNewInstrument('vocals');
          setNewProficiency('intermediate');
          setNewIsPrimary(false);
        },
      }
    );
  };

  const handleDeleteInstrument = () => {
    if (!deletingInstrument) return;
    removeInstrument.mutate(deletingInstrument.id, {
      onSettled: () => {
        setDeleteInstrumentOpen(false);
        setDeletingInstrument(null);
      },
    });
  };

  const handleTogglePrimary = (instrument: MusicMusicianInstrumentRow) => {
    updateInstrument.mutate({
      id: instrument.id,
      updates: { is_primary: !instrument.is_primary },
    });
  };

  const handleDeletePattern = () => {
    if (!deletingPatternId) return;
    deleteAvailability.mutate(deletingPatternId, {
      onSettled: () => {
        setDeletePatternOpen(false);
        setDeletingPatternId(null);
      },
    });
  };

  const handleAddPattern = () => {
    if (!musicianId || !newEffectiveFrom) return;
    createAvailability.mutate(
      {
        musician_id: musicianId,
        pattern_type: newPatternType,
        effective_from: newEffectiveFrom,
        effective_until: newEffectiveUntil || null,
        notes: newPatternNotes || null,
      },
      {
        onSuccess: () => {
          setAddPatternOpen(false);
          setNewPatternType('every_week');
          setNewEffectiveFrom('');
          setNewEffectiveUntil('');
          setNewPatternNotes('');
        },
      }
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl p-0 flex flex-col">
        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : !musician ? (
          <div className="p-6">
            <SheetHeader>
              <SheetTitle>Músico no encontrado</SheetTitle>
              <SheetDescription>
                El músico solicitado no existe o fue eliminado.
              </SheetDescription>
            </SheetHeader>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-6 pb-4 border-b" style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}>
              <SheetHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <SheetTitle
                      className="text-xl"
                      style={{ fontFamily: CASA_BRAND.fonts.heading, fontWeight: 300 }}
                    >
                      {musician.display_name}
                    </SheetTitle>
                    <SheetDescription className="mt-1">
                      {musician.is_active ? 'Músico activo' : 'Músico inactivo'}
                    </SheetDescription>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {canWrite && (
                      <Button variant="outline" size="sm" onClick={onEditClick} className="gap-2">
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </Button>
                    )}
                    {canManage && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDeleteClick(musician.id, musician.display_name)}
                        className="gap-2 text-red-500 hover:text-red-600 border-red-200 hover:border-red-300"
                        aria-label="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Eliminar
                      </Button>
                    )}
                  </div>
                </div>
              </SheetHeader>

              {/* Contact info */}
              <div className="mt-4 flex flex-wrap gap-2 items-center">
                {musician.email && (
                  <Badge variant="outline" className="gap-1">
                    <Mail className="h-3 w-3" />
                    {musician.email}
                  </Badge>
                )}
                {musician.phone && (
                  <Badge variant="outline" className="gap-1">
                    <Phone className="h-3 w-3" />
                    {musician.phone}
                  </Badge>
                )}
                {musician.whatsapp_enabled && (
                  <Badge variant="secondary" className="gap-1">
                    <MessageSquare className="h-3 w-3" />
                    WhatsApp
                  </Badge>
                )}
                <Badge variant={musician.is_active ? 'default' : 'secondary'}>
                  {musician.is_active ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="instrumentos" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="mx-6 mt-4 w-auto">
                <TabsTrigger value="instrumentos" className="gap-1.5">
                  <Music className="h-3.5 w-3.5" />
                  Instrumentos
                </TabsTrigger>
                <TabsTrigger value="disponibilidad" className="gap-1.5">
                  <CalendarCheck className="h-3.5 w-3.5" />
                  Disponibilidad
                </TabsTrigger>
                <TabsTrigger value="excepciones" className="gap-1.5">
                  <CalendarX2 className="h-3.5 w-3.5" />
                  Excepciones
                </TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1">
                <div className="p-6">
                  {/* Instruments Tab */}
                  <TabsContent value="instrumentos" className="mt-0">
                    <div className="space-y-4">
                      {canWrite && (
                        <div className="flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAddInstrumentOpen(true)}
                            className="gap-1"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Agregar instrumento
                          </Button>
                        </div>
                      )}

                      {musician.music_musician_instruments.length === 0 ? (
                        <p className="text-center py-8" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                          No hay instrumentos registrados.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {musician.music_musician_instruments.map((inst) => (
                            <div
                              key={inst.id}
                              className="flex items-center justify-between p-3 rounded-lg border"
                              style={{
                                borderColor: inst.is_primary
                                  ? CASA_BRAND.colors.primary.amber
                                  : CASA_BRAND.colors.secondary.grayLight,
                              }}
                            >
                              <div className="flex items-center gap-3">
                                <Badge
                                  variant={inst.is_primary ? 'default' : 'outline'}
                                  style={inst.is_primary ? {
                                    backgroundColor: CASA_BRAND.colors.primary.amber,
                                    color: CASA_BRAND.colors.primary.black,
                                  } : undefined}
                                >
                                  {INSTRUMENT_LABELS[inst.instrument]}
                                </Badge>
                                {inst.proficiency && (
                                  <span className="text-xs" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                                    {PROFICIENCY_LABELS[inst.proficiency]}
                                  </span>
                                )}
                                {inst.is_primary && (
                                  <span className="text-xs font-medium" style={{ color: CASA_BRAND.colors.primary.amber }}>
                                    Principal
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                {canWrite && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleTogglePrimary(inst)}
                                    className="text-xs"
                                  >
                                    {inst.is_primary ? 'Quitar principal' : 'Marcar principal'}
                                  </Button>
                                )}
                                {canManage && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-red-500 hover:text-red-600"
                                    onClick={() => {
                                      setDeletingInstrument(inst);
                                      setDeleteInstrumentOpen(true);
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
                  </TabsContent>

                  {/* Recurring Availability Tab */}
                  <TabsContent value="disponibilidad" className="mt-0">
                    <div className="space-y-4">
                      {canWrite && (
                        <div className="flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAddPatternOpen(true)}
                            className="gap-1"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Agregar patrón
                          </Button>
                        </div>
                      )}

                      {musician.music_recurring_availability.length === 0 ? (
                        <p className="text-center py-8" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                          No hay patrones de disponibilidad configurados.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {musician.music_recurring_availability.map((pattern) => (
                            <div
                              key={pattern.id}
                              className="p-4 rounded-lg border"
                              style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <Badge variant="secondary">
                                    {PATTERN_LABELS[pattern.pattern_type]}
                                  </Badge>
                                  <div className="mt-2 text-sm" style={{ color: CASA_BRAND.colors.secondary.grayDark }}>
                                    <span>Desde: {format(parseISO(pattern.effective_from), 'd MMM yyyy', { locale: es })}</span>
                                    <span className="mx-2">—</span>
                                    <span>
                                      {pattern.effective_until
                                        ? `Hasta: ${format(parseISO(pattern.effective_until), 'd MMM yyyy', { locale: es })}`
                                        : 'Sin fecha límite'}
                                    </span>
                                  </div>
                                  {pattern.notes && (
                                    <p className="mt-1 text-xs" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                                      {pattern.notes}
                                    </p>
                                  )}
                                </div>
                                {canManage && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-red-500 hover:text-red-600"
                                    onClick={() => {
                                      setDeletingPatternId(pattern.id);
                                      setDeletePatternOpen(true);
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
                  </TabsContent>

                  {/* Overrides Tab */}
                  <TabsContent value="excepciones" className="mt-0">
                    {!overrides || overrides.length === 0 ? (
                      <p className="text-center py-8" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                        No hay excepciones de disponibilidad registradas.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {overrides.map((override) => (
                          <div
                            key={override.id}
                            className="flex items-center justify-between p-3 rounded-lg border"
                            style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
                          >
                            <div>
                              <span className="text-sm font-medium" style={{ color: CASA_BRAND.colors.primary.black }}>
                                {format(parseISO(override.music_service_dates.date), 'EEE d MMM yyyy', { locale: es })}
                              </span>
                              <Badge
                                variant={
                                  override.status === 'available'
                                    ? 'default'
                                    : override.status === 'unavailable'
                                      ? 'destructive'
                                      : 'secondary'
                                }
                                className="ml-2"
                              >
                                {OVERRIDE_STATUS_LABELS[override.status]}
                              </Badge>
                              {override.notes && (
                                <p className="mt-1 text-xs" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                                  {override.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </div>
              </ScrollArea>
            </Tabs>
          </>
        )}
      </SheetContent>

      {/* Add Instrument Dialog */}
      <Dialog open={addInstrumentOpen} onOpenChange={setAddInstrumentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: CASA_BRAND.fonts.heading, fontWeight: 300 }}>
              Agregar instrumento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Instrumento</Label>
              <Select value={newInstrument} onValueChange={(v) => setNewInstrument(v as InstrumentType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(INSTRUMENT_LABELS) as [InstrumentType, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nivel</Label>
              <Select value={newProficiency} onValueChange={(v) => setNewProficiency(v as ProficiencyLevel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(PROFICIENCY_LABELS) as [ProficiencyLevel, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={newIsPrimary}
                onCheckedChange={(checked) => setNewIsPrimary(checked === true)}
              />
              <span className="text-sm">Instrumento principal</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddInstrumentOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddInstrument} disabled={addInstrument.isPending}>
              {addInstrument.isPending ? 'Agregando...' : 'Agregar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Instrument Confirmation */}
      <AlertDialog open={deleteInstrumentOpen} onOpenChange={setDeleteInstrumentOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar instrumento</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingInstrument
                ? `¿Estás seguro de que quieres eliminar ${INSTRUMENT_LABELS[deletingInstrument.instrument]}?`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteInstrument}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Pattern Confirmation */}
      <AlertDialog open={deletePatternOpen} onOpenChange={setDeletePatternOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar patrón</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres eliminar este patrón de disponibilidad?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePattern}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Pattern Dialog */}
      <Dialog open={addPatternOpen} onOpenChange={setAddPatternOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: CASA_BRAND.fonts.heading, fontWeight: 300 }}>
              Agregar patrón de disponibilidad
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Patrón</Label>
              <Select value={newPatternType} onValueChange={(v) => setNewPatternType(v as AvailabilityPatternType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(PATTERN_LABELS) as [AvailabilityPatternType, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Vigente desde *</Label>
              <Input
                type="date"
                value={newEffectiveFrom}
                onChange={(e) => setNewEffectiveFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Vigente hasta (opcional)</Label>
              <Input
                type="date"
                value={newEffectiveUntil}
                onChange={(e) => setNewEffectiveUntil(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={newPatternNotes}
                onChange={(e) => setNewPatternNotes(e.target.value)}
                placeholder="Notas opcionales..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddPatternOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAddPattern}
              disabled={!newEffectiveFrom || createAvailability.isPending}
            >
              {createAvailability.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
};

export default MusicianDetailSheet;
