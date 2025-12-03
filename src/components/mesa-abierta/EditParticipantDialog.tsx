import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Home, Users, Pencil } from 'lucide-react';

interface DietaryRestriction {
  id: string;
  restriction_type: string;
  description?: string;
  severity: string;
  is_plus_one: boolean;
}

interface Participant {
  id: string;
  role_preference: string;
  assigned_role: string | null;
  has_plus_one: boolean;
  status: string;
  user_id: string;
  phone_number?: string;
  host_address?: string;
  host_max_guests?: number;
  plus_one_name?: string;
  email?: string;
  mesa_abierta_dietary_restrictions?: DietaryRestriction[];
  full_name?: string;
}

interface EditParticipantDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  participant: Participant;
}

export function EditParticipantDialog({ open, onClose, onSuccess, participant }: EditParticipantDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Form state - initialized from participant
  const [fullName, setFullName] = useState(participant.full_name || '');
  const [email, setEmail] = useState(participant.email || '');
  const [phoneNumber, setPhoneNumber] = useState(participant.phone_number || '');
  const [rolePreference, setRolePreference] = useState<'host' | 'guest'>(
    participant.role_preference as 'host' | 'guest'
  );
  const [hasPlusOne, setHasPlusOne] = useState(participant.has_plus_one);
  const [plusOneName, setPlusOneName] = useState(participant.plus_one_name || '');
  const [hostAddress, setHostAddress] = useState(participant.host_address || '');
  const [maxGuests, setMaxGuests] = useState(participant.host_max_guests || 5);
  const [status, setStatus] = useState(participant.status);

  // Reset form when participant changes
  useEffect(() => {
    setFullName(participant.full_name || '');
    setEmail(participant.email || '');
    setPhoneNumber(participant.phone_number || '');
    setRolePreference(participant.role_preference as 'host' | 'guest');
    setHasPlusOne(participant.has_plus_one);
    setPlusOneName(participant.plus_one_name || '');
    setHostAddress(participant.host_address || '');
    setMaxGuests(participant.host_max_guests || 5);
    setStatus(participant.status);
  }, [participant]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      toast({
        title: 'Error',
        description: 'El nombre es requerido',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Update participant record
      const { error: participantError } = await supabase
        .from('mesa_abierta_participants')
        .update({
          role_preference: rolePreference,
          email: email || null,
          has_plus_one: hasPlusOne,
          plus_one_name: hasPlusOne ? plusOneName : null,
          host_address: rolePreference === 'host' ? hostAddress : null,
          host_max_guests: rolePreference === 'host' ? maxGuests : null,
          phone_number: phoneNumber || null,
          status: status,
        })
        .eq('id', participant.id);

      if (participantError) throw participantError;

      // Update profile with full name if user exists
      if (participant.user_id) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ full_name: fullName })
          .eq('id', participant.user_id);

        if (profileError) {
          console.warn('Could not update profile:', profileError);
          // Don't fail the whole operation for this
        }
      }

      toast({
        title: 'Participante actualizado',
        description: `${fullName} ha sido actualizado exitosamente`,
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error updating participant:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar el participante',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Editar Participante
          </DialogTitle>
          <DialogDescription>
            Modifica los datos del participante
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Role Selection */}
          <div className="space-y-3">
            <Label>Rol preferido</Label>
            <RadioGroup value={rolePreference} onValueChange={(v) => setRolePreference(v as 'host' | 'guest')}>
              <div className="grid grid-cols-2 gap-3">
                <Card className={`cursor-pointer ${rolePreference === 'guest' ? 'border-primary bg-primary/5' : ''}`}>
                  <CardContent className="flex items-center gap-2 p-3" onClick={() => setRolePreference('guest')}>
                    <RadioGroupItem value="guest" id="edit-guest" />
                    <Label htmlFor="edit-guest" className="flex items-center gap-2 cursor-pointer">
                      <Users className="h-4 w-4" />
                      Invitado
                    </Label>
                  </CardContent>
                </Card>
                <Card className={`cursor-pointer ${rolePreference === 'host' ? 'border-primary bg-primary/5' : ''}`}>
                  <CardContent className="flex items-center gap-2 p-3" onClick={() => setRolePreference('host')}>
                    <RadioGroupItem value="host" id="edit-host" />
                    <Label htmlFor="edit-host" className="flex items-center gap-2 cursor-pointer">
                      <Home className="h-4 w-4" />
                      Anfitrión
                    </Label>
                  </CardContent>
                </Card>
              </div>
            </RadioGroup>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Estado</Label>
            <select
              id="status"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="pending">Pendiente</option>
              <option value="confirmed">Confirmado</option>
              <option value="cancelled">Cancelado</option>
              <option value="waitlist">Lista de espera</option>
            </select>
          </div>

          {/* Basic Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-fullName">Nombre completo *</Label>
              <Input
                id="edit-fullName"
                placeholder="Nombre de la persona"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">Correo electrónico</Label>
              <Input
                id="edit-email"
                type="email"
                placeholder="correo@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-phone">Teléfono</Label>
              <Input
                id="edit-phone"
                type="tel"
                placeholder="+56 9 1234 5678"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>
          </div>

          {/* Host-specific fields */}
          {rolePreference === 'host' && (
            <div className="space-y-4 p-4 bg-muted rounded-lg">
              <h4 className="font-medium">Información de anfitrión</h4>

              <div className="space-y-2">
                <Label htmlFor="edit-address">Dirección</Label>
                <Input
                  id="edit-address"
                  placeholder="Calle, número, departamento"
                  value={hostAddress}
                  onChange={(e) => setHostAddress(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Plus One */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>¿Trae acompañante?</Label>
              <p className="text-xs text-muted-foreground">+1 persona adicional</p>
            </div>
            <Switch
              checked={hasPlusOne}
              onCheckedChange={setHasPlusOne}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !fullName.trim()}>
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
