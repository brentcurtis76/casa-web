// Best-effort WhatsApp fan-out for the music ministry publication flow.
// Runs alongside the existing email packet. Failures here must NEVER break
// the email path — the caller surfaces the summary in a toast.

import { supabase } from '@/integrations/supabase/client';
import { buildPayload } from '@/lib/whatsapp/payload';

export type WhatsAppFanoutSummary = {
  enviados: number;
  fallidos: number;
  sinOptIn: number;
  errores: string[];
};

type AssignmentRow = {
  id: string;
  assigned_instrument: string | null;
  assigned_role: string | null;
  music_musicians: {
    id: string;
    display_name: string;
    whatsapp_enabled: boolean | null;
    whatsapp_suppressed: boolean | null;
    phone: string | null;
  } | null;
};

function formatDateEs(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  const days = [
    'domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado',
  ];
  return `${days[d.getDay()]} ${d.getDate()} de ${months[d.getMonth()]}`;
}

export async function fanoutMusicAssignmentWhatsApp(
  serviceDateId: string,
): Promise<WhatsAppFanoutSummary> {
  const summary: WhatsAppFanoutSummary = {
    enviados: 0,
    fallidos: 0,
    sinOptIn: 0,
    errores: [],
  };

  const { data: serviceDate } = await supabase
    .from('music_service_dates')
    .select('id, date')
    .eq('id', serviceDateId)
    .maybeSingle();

  const fecha = formatDateEs(serviceDate?.date);

  const { data: rows, error } = await supabase
    .from('music_service_assignments')
    .select(
      `id, assigned_instrument, assigned_role,
       music_musicians(id, display_name, whatsapp_enabled, whatsapp_suppressed, phone)`,
    )
    .eq('service_date_id', serviceDateId);

  if (error) {
    summary.errores.push(error.message);
    return summary;
  }

  for (const raw of (rows ?? []) as AssignmentRow[]) {
    const m = raw.music_musicians;
    if (!m) continue;
    if (!m.whatsapp_enabled || m.whatsapp_suppressed || !m.phone) {
      summary.sinOptIn++;
      continue;
    }

    const rol = raw.assigned_instrument || raw.assigned_role || 'voluntario';

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('wa-send', {
        body: {
          recipientType: 'musician',
          recipientId: m.id,
          templateName: 'asignacion_servicio',
          notificationType: 'assignment',
          variables: [m.display_name, fecha, rol],
          buttons: [
            { index: 0, payload: buildPayload('confirm', 'music', raw.id) },
            { index: 1, payload: buildPayload('decline', 'music', raw.id) },
          ],
          assignmentRef: { domain: 'music', id: raw.id },
        },
      });

      if (invokeError) {
        summary.fallidos++;
        summary.errores.push(`${m.display_name}: ${invokeError.message}`);
        continue;
      }

      const result = data as { sent?: boolean; reason?: string; fallback?: string };
      if (result?.sent) {
        summary.enviados++;
      } else {
        summary.fallidos++;
        if (result?.reason) {
          summary.errores.push(`${m.display_name}: ${result.reason}`);
        }
      }
    } catch (err) {
      summary.fallidos++;
      summary.errores.push(
        `${m.display_name}: ${err instanceof Error ? err.message : 'error desconocido'}`,
      );
    }
  }

  return summary;
}

export function describeWhatsAppFanout(s: WhatsAppFanoutSummary): string {
  return `WhatsApp: ${s.enviados} enviado${s.enviados !== 1 ? 's' : ''}, ${s.fallidos} fallido${s.fallidos !== 1 ? 's' : ''}, ${s.sinOptIn} sin opt-in`;
}
