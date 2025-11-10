import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MessageCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WhatsAppOptInProps {
  phoneNumber: string;
  whatsappEnabled: boolean;
  onPhoneNumberChange: (phoneNumber: string) => void;
  onWhatsAppEnabledChange: (enabled: boolean) => void;
}

export function WhatsAppOptIn({
  phoneNumber,
  whatsappEnabled,
  onPhoneNumberChange,
  onWhatsAppEnabledChange,
}: WhatsAppOptInProps) {
  const [formattedPhone, setFormattedPhone] = useState(phoneNumber);

  const formatPhoneNumber = (value: string) => {
    // Remove all non-numeric characters
    const cleaned = value.replace(/\D/g, '');

    // Format as (XXX) XXX-XXXX for US numbers
    // Adjust this based on your region
    let formatted = cleaned;
    if (cleaned.length >= 6) {
      formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
    } else if (cleaned.length >= 3) {
      formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    }

    return { cleaned, formatted };
  };

  const handlePhoneChange = (value: string) => {
    const { cleaned, formatted } = formatPhoneNumber(value);
    setFormattedPhone(formatted);
    onPhoneNumberChange(cleaned);
  };

  const messages = [
    { icon: "✓", text: "Confirmación de inscripción" },
    { icon: "⏰", text: "Recordatorio 7 días antes" },
    { icon: "📍", text: "Recordatorio 1 día antes con detalles" },
    { icon: "💬", text: "Solicitud de feedback después" },
    { icon: "⚠️", text: "Alertas de cambios de última hora" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <MessageCircle className="h-5 w-5 text-green-600" />
          Notificaciones por WhatsApp
        </CardTitle>
        <CardDescription>
          Recibe recordatorios y actualizaciones importantes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone-number">Número de teléfono</Label>
            <div className="flex gap-2">
              <Input
                id="phone-number"
                type="tel"
                placeholder="(555) 123-4567"
                value={formattedPhone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                maxLength={14}
                className="flex-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Incluye tu número con código de país si estás fuera de Chile
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium">Recibirás mensajes para:</p>
            <div className="space-y-2">
              {messages.map((message, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span>{message.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-start space-x-3 pt-2">
            <Checkbox
              id="whatsapp-consent"
              checked={whatsappEnabled}
              onCheckedChange={(checked) => onWhatsAppEnabledChange(checked as boolean)}
            />
            <div className="grid gap-1.5 leading-none">
              <Label
                htmlFor="whatsapp-consent"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Acepto recibir mensajes de WhatsApp
              </Label>
              <p className="text-sm text-muted-foreground">
                Puedes desactivar las notificaciones en cualquier momento
              </p>
            </div>
          </div>
        </div>

        <Alert>
          <MessageCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <p className="font-medium mb-1">¿Por qué WhatsApp?</p>
            <p className="text-muted-foreground">
              Los mensajes de WhatsApp son más inmediatos que el correo electrónico
              y nos permiten mantener te informado sobre tu cena, especialmente
              en caso de cambios de última hora.
            </p>
          </AlertDescription>
        </Alert>

        <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFormattedPhone('');
              onPhoneNumberChange('');
              onWhatsAppEnabledChange(false);
            }}
          >
            Omitir - Solo Email
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
