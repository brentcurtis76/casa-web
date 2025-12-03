import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Home, Users, UserPlus } from 'lucide-react';

interface AddParticipantDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  monthId: string;
}

export function AddParticipantDialog({ open, onClose, onSuccess, monthId }: AddParticipantDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [rolePreference, setRolePreference] = useState<'host' | 'guest'>('guest');
  const [hasPlusOne, setHasPlusOne] = useState(false);
  const [plusOneName, setPlusOneName] = useState('');
  const [hostAddress, setHostAddress] = useState('');
  const [maxGuests, setMaxGuests] = useState(5);
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);

  const resetForm = () => {
    setFullName('');
    setEmail('');
    setPhoneNumber('');
    setRolePreference('guest');
    setHasPlusOne(false);
    setPlusOneName('');
    setHostAddress('');
    setMaxGuests(5);
    setWhatsappEnabled(true);
  };

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
      // For admin-added participants, we'll create a record without a user_id
      // We need to use a placeholder user_id or modify the schema
      // For now, let's use the service role to insert directly

      // First, check if we can find an existing user by email
      let userId: string | null = null;

      if (email) {
        // Try to find user by email in profiles
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', email)
          .maybeSingle();

        if (existingProfile) {
          userId = existingProfile.id;

          // Check if this user is already registered for this month
          const { data: existingParticipant } = await supabase
            .from('mesa_abierta_participants')
            .select('id')
            .eq('user_id', userId)
            .eq('month_id', monthId)
            .maybeSingle();

          if (existingParticipant) {
            toast({
              title: 'Error',
              description: 'Este usuario ya está inscrito para este mes',
              variant: 'destructive',
            });
            setLoading(false);
            return;
          }
        }
      }

      // If no existing user found, we need to create one or use a special approach
      // For simplicity, we'll create a "manual" participant without user_id validation
      // This requires RLS to allow admin inserts

      if (!userId) {
        // Generate a deterministic UUID based on email or name for manual entries
        // This is a workaround - in production you might want to invite the user
        const { data: authData } = await supabase.auth.admin?.createUser?.({
          email: email || `manual_${Date.now()}@placeholder.local`,
          email_confirm: true,
          user_metadata: { full_name: fullName }
        }) || { data: null };

        if (authData?.user) {
          userId = authData.user.id;
        }
      }

      // Since we can't easily create users as admin from the client,
      // let's use a different approach: store participant with admin's user_id
      // but mark them differently, OR use a server function

      // For now, let's call an edge function to handle this
      const { data, error } = await supabase.functions.invoke('admin-add-participant', {
        body: {
          monthId,
          fullName,
          email: email || null,
          phoneNumber: phoneNumber || null,
          rolePreference,
          hasPlusOne,
          plusOneName: hasPlusOne ? plusOneName : null,
          hostAddress: rolePreference === 'host' ? hostAddress : null,
          hostMaxGuests: rolePreference === 'host' ? maxGuests : null,
          whatsappEnabled,
        },
      });

      if (error) throw error;

      toast({
        title: 'Participante agregado',
        description: `${fullName} ha sido agregado exitosamente`,
      });

      resetForm();
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error adding participant:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo agregar el participante',
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
            <UserPlus className="h-5 w-5" />
            Agregar Participante Manualmente
          </DialogTitle>
          <DialogDescription>
            Agrega un participante para personas que no pueden inscribirse por sí mismas
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Role Selection */}
          <div className="space-y-3">
            <Label>Rol</Label>
            <RadioGroup value={rolePreference} onValueChange={(v) => setRolePreference(v as 'host' | 'guest')}>
              <div className="grid grid-cols-2 gap-3">
                <Card className={`cursor-pointer ${rolePreference === 'guest' ? 'border-primary bg-primary/5' : ''}`}>
                  <CardContent className="flex items-center gap-2 p-3" onClick={() => setRolePreference('guest')}>
                    <RadioGroupItem value="guest" id="guest" />
                    <Label htmlFor="guest" className="flex items-center gap-2 cursor-pointer">
                      <Users className="h-4 w-4" />
                      Invitado
                    </Label>
                  </CardContent>
                </Card>
                <Card className={`cursor-pointer ${rolePreference === 'host' ? 'border-primary bg-primary/5' : ''}`}>
                  <CardContent className="flex items-center gap-2 p-3" onClick={() => setRolePreference('host')}>
                    <RadioGroupItem value="host" id="host" />
                    <Label htmlFor="host" className="flex items-center gap-2 cursor-pointer">
                      <Home className="h-4 w-4" />
                      Anfitrión
                    </Label>
                  </CardContent>
                </Card>
              </div>
            </RadioGroup>
          </div>

          {/* Basic Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nombre completo *</Label>
              <Input
                id="fullName"
                placeholder="Nombre de la persona"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico (opcional)</Label>
              <Input
                id="email"
                type="email"
                placeholder="correo@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Si tiene correo, recibirá notificaciones automáticas
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
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
                <Label htmlFor="address">Dirección *</Label>
                <Input
                  id="address"
                  placeholder="Calle, número, departamento"
                  value={hostAddress}
                  onChange={(e) => setHostAddress(e.target.value)}
                  required={rolePreference === 'host'}
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

          {/* WhatsApp */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Notificaciones WhatsApp</Label>
              <p className="text-xs text-muted-foreground">Enviar mensajes por WhatsApp</p>
            </div>
            <Switch
              checked={whatsappEnabled}
              onCheckedChange={setWhatsappEnabled}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !fullName.trim()}>
              {loading ? 'Agregando...' : 'Agregar Participante'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
