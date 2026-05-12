import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Settings2 } from 'lucide-react';
import type { ChurchSignupSettings, SignupFormType } from '@/types/signups';

interface SignupSettingsPanelProps {
  formType: SignupFormType;
  label: string;
}

function isoToLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

// Generated Supabase types don't yet include church_signup_settings.
type SettingsClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        maybeSingle: () => Promise<{ data: ChurchSignupSettings | null; error: unknown }>;
      };
    };
    update: (values: Record<string, unknown>) => {
      eq: (col: string, val: string) => Promise<{ error: unknown }>;
    };
  };
};

export default function SignupSettingsPanel({ formType, label }: SignupSettingsPanelProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { canManage } = usePermissions('signups');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentCount, setCurrentCount] = useState<number | null>(null);

  const [isOpen, setIsOpen] = useState(true);
  const [cutoffLocal, setCutoffLocal] = useState('');
  const [maxCapacityStr, setMaxCapacityStr] = useState('');
  const [closedMessage, setClosedMessage] = useState('');

  const settingsClient = supabase as unknown as SettingsClient;

  const load = useCallback(async () => {
    setLoading(true);

    const settingsRes = await settingsClient
      .from('church_signup_settings')
      .select('*')
      .eq('form_type', formType)
      .maybeSingle();

    const countRes = await supabase
      .from('church_signups')
      .select('id', { head: true, count: 'exact' })
      .eq('form_type', formType)
      .neq('status', 'cancelled');

    const row = settingsRes.data;
    setIsOpen(row?.is_open ?? true);
    setCutoffLocal(isoToLocalInput(row?.cutoff_at ?? null));
    setMaxCapacityStr(row?.max_capacity != null ? String(row.max_capacity) : '');
    setClosedMessage(row?.closed_message ?? '');
    setCurrentCount(typeof countRes.count === 'number' ? countRes.count : null);
    setLoading(false);
  }, [formType, settingsClient]);

  useEffect(() => {
    load();
  }, [load]);

  if (!canManage) return null;

  const handleSave = async () => {
    let maxCapacity: number | null = null;
    if (maxCapacityStr.trim() !== '') {
      const parsed = Number(maxCapacityStr);
      if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
        toast({
          title: 'Capacidad inválida',
          description: 'Ingresa un número entero positivo o deja el campo vacío.',
          variant: 'destructive',
        });
        return;
      }
      maxCapacity = parsed;
    }

    const cutoffIso = localInputToIso(cutoffLocal);

    setSaving(true);
    const { error } = await settingsClient
      .from('church_signup_settings')
      .update({
        is_open: isOpen,
        cutoff_at: cutoffIso,
        max_capacity: maxCapacity,
        closed_message: closedMessage.trim() ? closedMessage.trim() : null,
        updated_at: new Date().toISOString(),
        updated_by: user?.id ?? null,
      })
      .eq('form_type', formType);

    if (error) {
      console.error('Error saving signup settings:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron guardar los ajustes.',
        variant: 'destructive',
      });
      setSaving(false);
      return;
    }

    toast({
      title: 'Ajustes guardados',
      description: `Configuración de "${label}" actualizada.`,
    });
    setSaving(false);
    await load();
  };

  const countText = (() => {
    if (currentCount === null) return null;
    const cap = maxCapacityStr.trim() !== '' ? Number(maxCapacityStr) : null;
    if (cap !== null && Number.isFinite(cap)) {
      return `${currentCount} inscritos / ${cap} cupos`;
    }
    return `${currentCount} inscritos`;
  })();

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          Ajustes de inscripción — {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <Label htmlFor={`is-open-${formType}`} className="cursor-pointer">
                  Inscripciones abiertas
                </Label>
                <p className="text-xs text-muted-foreground">
                  Desactiva para mostrar el aviso de cierre en el formulario público.
                </p>
              </div>
              <Switch
                id={`is-open-${formType}`}
                checked={isOpen}
                onCheckedChange={setIsOpen}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor={`cutoff-${formType}`}>Fecha y hora de cierre</Label>
                <Input
                  id={`cutoff-${formType}`}
                  type="datetime-local"
                  value={cutoffLocal}
                  onChange={(e) => setCutoffLocal(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Déjalo vacío si no quieres un cierre automático.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`capacity-${formType}`}>Cupo máximo</Label>
                <Input
                  id={`capacity-${formType}`}
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={maxCapacityStr}
                  onChange={(e) => setMaxCapacityStr(e.target.value)}
                  placeholder="Sin límite"
                />
                {countText && (
                  <p className="text-xs text-muted-foreground">{countText}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`closed-msg-${formType}`}>Mensaje al cerrar</Label>
              <Textarea
                id={`closed-msg-${formType}`}
                value={closedMessage}
                onChange={(e) => setClosedMessage(e.target.value)}
                placeholder="Mensaje opcional que verán los visitantes cuando las inscripciones estén cerradas."
                rows={3}
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar'
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
