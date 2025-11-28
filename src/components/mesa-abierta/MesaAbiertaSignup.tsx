import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { DietaryRestrictionsForm, DietaryRestriction, PlusOneDietary } from "./DietaryRestrictionsForm";
import { WhatsAppOptIn } from "./WhatsAppOptIn";
import { Home, Users, Check, ArrowLeft, ArrowRight, AlertCircle, CheckCircle, Mail } from "lucide-react";

interface MesaAbiertaSignupProps {
  open: boolean;
  onClose: () => void;
  monthId: string;
  preferredRole?: 'host' | 'guest';
}

export function MesaAbiertaSignup({ open, onClose, monthId, preferredRole }: MesaAbiertaSignupProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Form state
  const [rolePreference, setRolePreference] = useState<'host' | 'guest'>(preferredRole || 'guest');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [hasPlusOne, setHasPlusOne] = useState(false);
  const [recurring, setRecurring] = useState(false);
  const [hostAddress, setHostAddress] = useState('');
  const [maxGuests, setMaxGuests] = useState(5);
  const [restrictions, setRestrictions] = useState<DietaryRestriction[]>([]);
  const [plusOneDietary, setPlusOneDietary] = useState<PlusOneDietary | undefined>();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);

  const totalSteps = 5;
  const progress = (currentStep / totalSteps) * 100;

  const canProceedFromStep1 = rolePreference !== null;
  const canProceedFromStep2 = fullName.trim().length > 0 && email.trim().length > 0 && phoneNumber.trim().length > 0;
  const canProceedFromStep3 = rolePreference === 'guest' || (rolePreference === 'host' && hostAddress.trim().length > 0);

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "Debes iniciar sesión para inscribirte",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Check if user is already registered for this month
      const { data: existing } = await supabase
        .from('mesa_abierta_participants')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('month_id', monthId)
        .maybeSingle();

      if (existing) {
        toast({
          title: "Ya estás inscrito",
          description: existing.status === 'confirmed'
            ? "Ya tienes una inscripción confirmada para este mes"
            : "Ya tienes una inscripción pendiente para este mes",
          variant: "destructive",
        });
        onClose();
        return;
      }

      // Update user profile with name only (email is in auth.users)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Insert participant record
      const { data: participant, error: participantError } = await supabase
        .from('mesa_abierta_participants')
        .insert({
          user_id: user.id,
          month_id: monthId,
          role_preference: rolePreference,
          email: email,
          has_plus_one: hasPlusOne,
          plus_one_name: plusOneDietary?.name || null,
          recurring,
          host_address: rolePreference === 'host' ? hostAddress : null,
          host_max_guests: rolePreference === 'host' ? maxGuests : null,
          phone_number: phoneNumber || null,
          whatsapp_enabled: whatsappEnabled,
          status: 'pending',
        })
        .select()
        .single();

      if (participantError) throw participantError;

      // Insert dietary restrictions for main participant
      if (restrictions.length > 0) {
        const restrictionsData = restrictions.map(r => ({
          participant_id: participant.id,
          restriction_type: r.type,
          description: r.description,
          severity: r.severity,
        }));

        const { error: restrictionsError } = await supabase
          .from('mesa_abierta_dietary_restrictions')
          .insert(restrictionsData);

        if (restrictionsError) throw restrictionsError;
      }

      // Insert dietary restrictions for plus one if applicable
      if (plusOneDietary && plusOneDietary.restrictions.length > 0) {
        const plusOneRestrictionsData = plusOneDietary.restrictions.map(r => ({
          participant_id: participant.id,
          restriction_type: r.type,
          description: r.description,
          severity: r.severity,
        }));

        const { error: plusOneRestrictionsError } = await supabase
          .from('mesa_abierta_dietary_restrictions')
          .insert(plusOneRestrictionsData);

        if (plusOneRestrictionsError) throw plusOneRestrictionsError;
      }

      // Send confirmation email
      try {
        await supabase.functions.invoke('send-signup-confirmation', {
          body: { participantId: participant.id },
        });
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
        // Don't throw - we still want to show success even if email fails
      }

      // Show success screen instead of just closing
      setShowSuccess(true);
    } catch (error: any) {
      console.error('Error signing up:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo completar la inscripción",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">¿Cómo quieres participar?</h3>
              <RadioGroup value={rolePreference} onValueChange={(value) => setRolePreference(value as 'host' | 'guest')}>
                <Card className={rolePreference === 'host' ? 'border-primary' : ''}>
                  <CardContent className="flex items-start space-x-4 pt-6">
                    <RadioGroupItem value="host" id="host" />
                    <div className="flex-1">
                      <Label htmlFor="host" className="text-base font-semibold flex items-center gap-2 cursor-pointer">
                        <Home className="h-5 w-5" />
                        Quiero ser anfitrión
                      </Label>
                      <p className="text-sm text-muted-foreground mt-2">
                        Abre tu hogar para recibir a miembros de la comunidad
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className={rolePreference === 'guest' ? 'border-primary' : ''}>
                  <CardContent className="flex items-start space-x-4 pt-6">
                    <RadioGroupItem value="guest" id="guest" />
                    <div className="flex-1">
                      <Label htmlFor="guest" className="text-base font-semibold flex items-center gap-2 cursor-pointer">
                        <Users className="h-5 w-5" />
                        Quiero ser invitado
                      </Label>
                      <p className="text-sm text-muted-foreground mt-2">
                        Asiste a una cena en el hogar de otro miembro
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </RadioGroup>

              {rolePreference === 'host' && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium mb-1">⚠️ Importante para anfitriones:</p>
                    <p className="text-sm">
                      Tu rol final se confirmará el miércoles anterior a la cena. Esto depende
                      del número de participantes que se inscriban. Si hay suficientes
                      anfitriones, podrías ser asignado como invitado.
                    </p>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Información de contacto</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nombre completo *</Label>
                <Input
                  id="fullName"
                  placeholder="Tu nombre completo"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Necesitamos tu email para enviarte los detalles de la cena
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Número de teléfono *</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+56 9 1234 5678"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Para contactarte en caso de cambios de último momento
                </p>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            {rolePreference === 'host' ? (
              <>
                <h3 className="text-lg font-semibold">Información de anfitrión</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="address">Dirección de tu hogar *</Label>
                    <Input
                      id="address"
                      placeholder="Calle, número, departamento"
                      value={hostAddress}
                      onChange={(e) => setHostAddress(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address-details">Detalles adicionales (opcional)</Label>
                    <Textarea
                      id="address-details"
                      placeholder="Instrucciones para llegar, estacionamiento, etc."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max-guests">Número máximo de invitados</Label>
                    <select
                      id="max-guests"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={maxGuests}
                      onChange={(e) => setMaxGuests(parseInt(e.target.value))}
                    >
                      {[3, 4, 5, 6, 7, 8].map(num => (
                        <option key={num} value={num}>{num} personas</option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Con acompañantes, podrían ser hasta {maxGuests * 2} personas
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <Check className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Como invitado, no necesitas proporcionar información adicional en este paso
                </p>
              </div>
            )}

            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>¿Traerás un acompañante?</Label>
                  <p className="text-xs text-muted-foreground">
                    Máximo una persona adicional
                  </p>
                </div>
                <Switch
                  checked={hasPlusOne}
                  onCheckedChange={setHasPlusOne}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Participación recurrente</Label>
                  <p className="text-xs text-muted-foreground">
                    Inscríbete automáticamente cada mes
                  </p>
                </div>
                <Switch
                  checked={recurring}
                  onCheckedChange={setRecurring}
                />
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <DietaryRestrictionsForm
            hasPlusOne={hasPlusOne}
            onRestrictionsChange={(r, p) => {
              setRestrictions(r);
              setPlusOneDietary(p);
            }}
            restrictions={restrictions}
            plusOneRestrictions={plusOneDietary}
          />
        );

      case 5:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">¡Casi listo!</h3>
            <div className="bg-muted p-6 rounded-lg space-y-4">
              <div className="flex items-start gap-3">
                <Check className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-semibold">Rol: {rolePreference === 'host' ? 'Anfitrión' : 'Invitado'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-semibold">Nombre: {fullName}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-semibold">Email: {email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-semibold">Teléfono: {phoneNumber}</p>
                </div>
              </div>
              {hasPlusOne && (
                <div className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-semibold">Con acompañante (+1)</p>
                  </div>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Recibirás un correo electrónico el miércoles anterior a la cena con todos los detalles.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  // Show success screen after successful signup
  if (showSuccess) {
    return (
      <Dialog open={open} onOpenChange={() => {
        setShowSuccess(false);
        setCurrentStep(1);
        onClose();
      }}>
        <DialogContent className="max-w-md">
          <div className="text-center space-y-6 py-6">
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-casa-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-casa-700" />
              </div>
            </div>

            <div className="space-y-2">
              <DialogTitle className="text-2xl font-bold text-casa-800">
                ¡Inscripción Exitosa!
              </DialogTitle>
              <DialogDescription className="text-base">
                {rolePreference === 'host'
                  ? "Te confirmaremos si serás anfitrión el miércoles anterior a la cena."
                  : "Recibirás los detalles de tu cena el miércoles anterior al evento."}
              </DialogDescription>
            </div>

            <div className="bg-casa-50 border border-casa-200 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-center gap-2 text-casa-800">
                <Mail className="w-5 h-5" />
                <span className="font-semibold">Revisa tu correo</span>
              </div>
              <p className="text-sm text-casa-700">
                Te hemos enviado un email de confirmación a <strong>{email}</strong>
              </p>
            </div>

            <Alert className="bg-amber-50 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                Recibirás toda la información sobre tu cena el <strong>miércoles anterior al evento</strong> por correo electrónico.
              </AlertDescription>
            </Alert>

            <Button
              onClick={() => {
                setShowSuccess(false);
                setCurrentStep(1);
                onClose();
              }}
              className="w-full bg-casa-700 hover:bg-casa-800 text-white"
              size="lg"
            >
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Inscripción - La Mesa Abierta</DialogTitle>
          <DialogDescription>
            Paso {currentStep} de {totalSteps}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Progress value={progress} className="w-full" />

          {renderStep()}

          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1 || loading}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Atrás
            </Button>

            {currentStep < totalSteps ? (
              <Button
                onClick={handleNext}
                disabled={
                  (currentStep === 1 && !canProceedFromStep1) ||
                  (currentStep === 2 && !canProceedFromStep2) ||
                  (currentStep === 3 && !canProceedFromStep3)
                }
              >
                Siguiente
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? "Enviando..." : "Completar Inscripción"}
                <Check className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
