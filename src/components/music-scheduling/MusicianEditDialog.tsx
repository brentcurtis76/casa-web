/**
 * MusicianEditDialog — Dialog for creating or editing a musician.
 *
 * When musicianId is null, it's a "create" dialog. When musicianId is provided,
 * it loads existing data and allows updating.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useMusicianById, useCreateMusician, useUpdateMusician } from '@/hooks/useMusicLibrary';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CASA_BRAND } from '@/lib/brand-kit';
import { normalizeChilePhone } from '@/lib/whatsapp/phone';
import type { WhatsAppOptInMethod } from '@/types/musicPlanning';

interface MusicianEditDialogProps {
  musicianId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const OPT_IN_METHOD_LABELS: Record<WhatsAppOptInMethod, string> = {
  formulario: 'Formulario',
  'verbal-coordinador': 'Verbal con coordinador',
  'en-app': 'En la app',
};

const MusicianEditDialog = ({ musicianId, open, onOpenChange }: MusicianEditDialogProps) => {
  const isEditing = musicianId !== null;
  const { data: existingMusician, isLoading } = useMusicianById(musicianId);
  const createMusician = useCreateMusician();
  const updateMusician = useUpdateMusician();

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [optInMethod, setOptInMethod] = useState<WhatsAppOptInMethod>('verbal-coordinador');
  const [previousOptIn, setPreviousOptIn] = useState(false);
  const [previousOptInAt, setPreviousOptInAt] = useState<string | null>(null);
  const [previousOptInMethod, setPreviousOptInMethod] = useState<WhatsAppOptInMethod | null>(null);
  const [suppressed, setSuppressed] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState('');

  const resetForm = useCallback(() => {
    setDisplayName('');
    setEmail('');
    setPhone('');
    setWhatsappEnabled(false);
    setOptInMethod('verbal-coordinador');
    setPreviousOptIn(false);
    setPreviousOptInAt(null);
    setPreviousOptInMethod(null);
    setSuppressed(false);
    setIsActive(true);
    setNotes('');
  }, []);

  // Populate form when editing
  useEffect(() => {
    if (isEditing && existingMusician) {
      setDisplayName(existingMusician.display_name);
      setEmail(existingMusician.email ?? '');
      setPhone(existingMusician.phone ?? '');
      setWhatsappEnabled(existingMusician.whatsapp_enabled);
      setPreviousOptIn(existingMusician.whatsapp_enabled);
      setPreviousOptInAt(existingMusician.whatsapp_opt_in_at ?? null);
      const m = existingMusician.whatsapp_opt_in_method;
      if (m === 'formulario' || m === 'verbal-coordinador' || m === 'en-app') {
        setPreviousOptInMethod(m);
        setOptInMethod(m);
      } else {
        setPreviousOptInMethod(null);
      }
      setSuppressed(existingMusician.whatsapp_suppressed ?? false);
      setIsActive(existingMusician.is_active);
      setNotes(existingMusician.notes ?? '');
    } else if (!isEditing) {
      resetForm();
    }
  }, [isEditing, existingMusician, resetForm]);

  const phoneResult = useMemo(() => {
    if (!phone.trim()) return null;
    return normalizeChilePhone(phone);
  }, [phone]);

  const phoneError = whatsappEnabled && phoneResult && !phoneResult.ok
    ? phoneResult.reason
    : null;

  const handleSubmit = () => {
    const turningOnOptIn = whatsappEnabled && !previousOptIn;

    const musicianData: Record<string, unknown> = {
      display_name: displayName.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      whatsapp_enabled: whatsappEnabled,
      is_active: isActive,
      notes: notes.trim() || null,
    };

    if (turningOnOptIn) {
      musicianData.whatsapp_opt_in_at = new Date().toISOString();
      musicianData.whatsapp_opt_in_method = optInMethod;
    } else if (whatsappEnabled && previousOptIn) {
      // Preserve existing opt-in metadata; only update method if user changed it.
      if (optInMethod !== previousOptInMethod) {
        musicianData.whatsapp_opt_in_method = optInMethod;
      }
    }

    if (isEditing && musicianId) {
      updateMusician.mutate(
        { id: musicianId, updates: musicianData },
        {
          onSuccess: () => {
            onOpenChange(false);
          },
        }
      );
    } else {
      createMusician.mutate(musicianData, {
        onSuccess: () => {
          onOpenChange(false);
          resetForm();
        },
      });
    }
  };

  const isPending = createMusician.isPending || updateMusician.isPending;
  const canSubmit = displayName.trim().length > 0 && !isPending && !phoneError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle style={{ fontFamily: CASA_BRAND.fonts.heading, fontWeight: 300 }}>
            {isEditing ? 'Editar músico' : 'Nuevo músico'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modifica los datos del músico.'
              : 'Completa los campos para agregar un músico al equipo.'}
          </DialogDescription>
        </DialogHeader>

        {isEditing && isLoading ? (
          <div className="px-6 py-8 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <ScrollArea className="flex-1 px-6">
            <div className="space-y-5 pb-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Nombre *</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Nombre completo del músico"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+56 9 xxxx xxxx"
                />
                {phoneResult?.ok && (
                  <p className="text-xs text-muted-foreground">
                    Se enviará a {phoneResult.display}
                  </p>
                )}
                {phoneError && (
                  <p className="text-xs text-destructive">{phoneError}</p>
                )}
              </div>

              <div className="space-y-3 rounded-md border p-3" style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}>
                <div className="flex items-center justify-between">
                  <Label htmlFor="whatsapp">WhatsApp habilitado</Label>
                  <Switch
                    id="whatsapp"
                    checked={whatsappEnabled}
                    onCheckedChange={setWhatsappEnabled}
                    disabled={suppressed}
                  />
                </div>

                {whatsappEnabled && !suppressed && (
                  <div className="space-y-2">
                    <Label htmlFor="optInMethod">Cómo se obtuvo el consentimiento</Label>
                    <Select
                      value={optInMethod}
                      onValueChange={(v) => setOptInMethod(v as WhatsAppOptInMethod)}
                    >
                      <SelectTrigger id="optInMethod">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="formulario">{OPT_IN_METHOD_LABELS.formulario}</SelectItem>
                        <SelectItem value="verbal-coordinador">{OPT_IN_METHOD_LABELS['verbal-coordinador']}</SelectItem>
                        <SelectItem value="en-app">{OPT_IN_METHOD_LABELS['en-app']}</SelectItem>
                      </SelectContent>
                    </Select>
                    {previousOptInAt && (
                      <p className="text-xs text-muted-foreground">
                        Opt-in registrado el {new Date(previousOptInAt).toLocaleDateString('es-CL')}
                      </p>
                    )}
                  </div>
                )}

                {suppressed && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      El voluntario pidió no recibir mensajes. Para reactivar, debe hacerlo personalmente con el coordinador.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {isEditing && (
                <div className="flex items-center justify-between">
                  <Label htmlFor="active">Músico activo</Label>
                  <Switch
                    id="active"
                    checked={isActive}
                    onCheckedChange={setIsActive}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notas opcionales sobre el músico..."
                  rows={3}
                />
              </div>
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="px-6 py-4 border-t" style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isPending
              ? 'Guardando...'
              : isEditing
                ? 'Guardar cambios'
                : 'Crear músico'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MusicianEditDialog;
