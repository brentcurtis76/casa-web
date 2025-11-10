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
import { Home, Users, Check, ArrowLeft, ArrowRight, AlertCircle } from "lucide-react";

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

  // Form state
  const [rolePreference, setRolePreference] = useState<'host' | 'guest'>(preferredRole || 'guest');
  const [hasPlusOne, setHasPlusOne] = useState(false);
  const [recurring, setRecurring] = useState(false);
  const [hostAddress, setHostAddress] = useState('');
  const [maxGuests, setMaxGuests] = useState(5);
  const [restrictions, setRestrictions] = useState<DietaryRestriction[]>([]);
  const [plusOneDietary, setPlusOneDietary] = useState<PlusOneDietary | undefined>();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);

  const totalSteps = 4;
  const progress = (currentStep / totalSteps) * 100;

  const canProceedFromStep1 = rolePreference !== null;
  const canProceedFromStep2 = rolePreference === 'guest' || (rolePreference === 'host' && hostAddress.trim().length > 0);

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
      // Insert participant record
      const { data: participant, error: participantError } = await supabase
        .from('mesa_abierta_participants')
        .insert({
          user_id: user.id,
          month_id: monthId,
          role_preference: rolePreference,
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

      // TODO: Send confirmation email/WhatsApp

      toast({
        title: "¡Inscripción exitosa!",
        description: rolePreference === 'host'
          ? "Te confirmaremos si serás anfitrión el lunes anterior a la cena."
          : "Recibirás los detalles de tu cena el lunes anterior al evento.",
      });

      onClose();
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
                        Abre tu hogar para recibir a hermanos de la iglesia
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
                        Asiste a una cena en el hogar de otro hermano
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
                      Tu rol final se confirmará el lunes anterior a la cena. Esto depende
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

      case 3:
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

      case 4:
        return (
          <WhatsAppOptIn
            phoneNumber={phoneNumber}
            whatsappEnabled={whatsappEnabled}
            onPhoneNumberChange={setPhoneNumber}
            onWhatsAppEnabledChange={setWhatsappEnabled}
          />
        );

      default:
        return null;
    }
  };

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
                  (currentStep === 2 && !canProceedFromStep2)
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
