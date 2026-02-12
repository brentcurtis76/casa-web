/**
 * Notification Service — Supabase CRUD for music_notification_logs.
 *
 * Logging + template system. Does NOT send actual emails/WhatsApp messages.
 * Creates log rows with status 'queued' for future external integration.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  MusicNotificationLogRow,
  MusicNotificationLogInsert,
  MusicNotificationLogUpdate,
  NotificationType,
  NotificationChannel,
  NotificationDeliveryStatus,
} from '@/types/musicPlanning';

// ─── Filters ────────────────────────────────────────────────────────────────

export interface NotificationLogFilters {
  recipientId?: string;
  notificationType?: NotificationType;
  channel?: NotificationChannel;
  status?: NotificationDeliveryStatus;
  from?: string;   // ISO date string for created_at >= from
  to?: string;     // ISO date string for created_at <= to
}

// ─── Query Functions ────────────────────────────────────────────────────────

export async function getNotificationLogs(
  filters?: NotificationLogFilters
): Promise<MusicNotificationLogRow[]> {
  let query = supabase
    .from('music_notification_logs')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.recipientId) query = query.eq('recipient_id', filters.recipientId);
  if (filters?.notificationType) query = query.eq('notification_type', filters.notificationType);
  if (filters?.channel) query = query.eq('channel', filters.channel);
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.from) query = query.gte('created_at', filters.from);
  if (filters?.to) query = query.lte('created_at', filters.to);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as MusicNotificationLogRow[];
}

export async function getNotificationLogById(
  id: string
): Promise<MusicNotificationLogRow | null> {
  const { data, error } = await supabase
    .from('music_notification_logs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(error.message);
  }
  return data as MusicNotificationLogRow;
}

export async function getNotificationLogsForRecipient(
  recipientId: string,
  limit: number = 50
): Promise<MusicNotificationLogRow[]> {
  const { data, error } = await supabase
    .from('music_notification_logs')
    .select('*')
    .eq('recipient_id', recipientId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as MusicNotificationLogRow[];
}

// ─── Mutation Functions ─────────────────────────────────────────────────────

export async function createNotificationLog(
  log: MusicNotificationLogInsert
): Promise<MusicNotificationLogRow> {
  const { data, error } = await supabase
    .from('music_notification_logs')
    .insert(log)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MusicNotificationLogRow;
}

export async function batchCreateNotificationLogs(
  logs: MusicNotificationLogInsert[]
): Promise<MusicNotificationLogRow[]> {
  if (logs.length === 0) return [];

  const { data, error } = await supabase
    .from('music_notification_logs')
    .insert(logs)
    .select('*');

  if (error) throw new Error(error.message);
  return (data ?? []) as MusicNotificationLogRow[];
}

export async function updateNotificationLog(
  id: string,
  updates: MusicNotificationLogUpdate
): Promise<MusicNotificationLogRow> {
  const { data, error } = await supabase
    .from('music_notification_logs')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MusicNotificationLogRow;
}

export async function deleteNotificationLog(id: string): Promise<void> {
  const { error } = await supabase
    .from('music_notification_logs')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

// ─── Stats ──────────────────────────────────────────────────────────────────

export interface NotificationStats {
  total: number;
  queued: number;
  sent: number;
  delivered: number;
  failed: number;
}

export async function getNotificationStats(): Promise<NotificationStats> {
  const { data, error } = await supabase
    .from('music_notification_logs')
    .select('status');

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as { status: NotificationDeliveryStatus }[];
  const stats: NotificationStats = { total: rows.length, queued: 0, sent: 0, delivered: 0, failed: 0 };
  for (const row of rows) {
    stats[row.status]++;
  }
  return stats;
}

// ─── Template System ────────────────────────────────────────────────────────

export interface NotificationContext {
  recipientName: string;
  /** ISO date string */
  serviceDate?: string;
  serviceDateLabel?: string;
  rehearsalDate?: string;
  rehearsalLocation?: string;
  rehearsalTime?: string;
  assignedRole?: string;
  songList?: string[];
  customMessage?: string;
}

export interface NotificationContent {
  subject: string;
  message: string;
}

export function generateNotificationContent(
  type: NotificationType,
  context: NotificationContext
): NotificationContent {
  const { recipientName } = context;

  switch (type) {
    case 'assignment':
      return {
        subject: 'Nueva asignación de servicio',
        message: `Hola ${recipientName}, has sido asignado/a al servicio del ${context.serviceDateLabel ?? context.serviceDate ?? '(fecha por confirmar)'}${context.assignedRole ? ` como ${context.assignedRole}` : ''}. Por favor confirma tu disponibilidad.`,
      };
    case 'reminder_1week':
      return {
        subject: 'Recordatorio: Servicio en 1 semana',
        message: `Hola ${recipientName}, te recordamos que tienes un servicio programado para el ${context.serviceDateLabel ?? context.serviceDate ?? '(fecha por confirmar)'}. ¡Nos vemos pronto!`,
      };
    case 'reminder_1day':
      return {
        subject: 'Recordatorio: Servicio mañana',
        message: `Hola ${recipientName}, te recordamos que mañana tienes servicio${context.serviceDateLabel ? ` (${context.serviceDateLabel})` : ''}. Por favor llega puntual.`,
      };
    case 'availability_request':
      return {
        subject: 'Solicitud de disponibilidad',
        message: `Hola ${recipientName}, necesitamos que confirmes tu disponibilidad para el servicio del ${context.serviceDateLabel ?? context.serviceDate ?? '(fecha por confirmar)'}. Por favor responde a la brevedad.`,
      };
    case 'rehearsal_invite':
      return {
        subject: 'Invitación a ensayo',
        message: `Hola ${recipientName}, estás invitado/a al ensayo del ${context.rehearsalDate ?? '(fecha por confirmar)'}${context.rehearsalTime ? ` a las ${context.rehearsalTime}` : ''}${context.rehearsalLocation ? ` en ${context.rehearsalLocation}` : ''}. Por favor confirma tu asistencia.`,
      };
    case 'rehearsal_reminder':
      return {
        subject: 'Recordatorio de ensayo',
        message: `Hola ${recipientName}, te recordamos el ensayo del ${context.rehearsalDate ?? '(fecha por confirmar)'}${context.rehearsalTime ? ` a las ${context.rehearsalTime}` : ''}${context.rehearsalLocation ? ` en ${context.rehearsalLocation}` : ''}.${context.songList && context.songList.length > 0 ? ` Canciones: ${context.songList.join(', ')}.` : ''}`,
      };
    case 'schedule_published':
      return {
        subject: 'Programación publicada',
        message: `Hola ${recipientName}, la programación del servicio del ${context.serviceDateLabel ?? context.serviceDate ?? '(fecha por confirmar)'} ha sido publicada. Revisa tus asignaciones en el sistema.`,
      };
    case 'cancellation':
      return {
        subject: 'Cancelación de servicio/ensayo',
        message: `Hola ${recipientName}, lamentamos informarte que ${context.customMessage ?? 'el evento programado ha sido cancelado'}. Te contactaremos con más información.`,
      };
    default: {
      const _exhaustive: never = type;
      return { subject: 'Notificación', message: `Hola ${recipientName}, tienes una nueva notificación.` };
    }
  }
}

// ─── Queue Helpers ──────────────────────────────────────────────────────────

export async function queueNotification(params: {
  recipientId: string;
  recipientName: string;
  type: NotificationType;
  channel: NotificationChannel;
  context: NotificationContext;
}): Promise<MusicNotificationLogRow> {
  const { recipientId, type, channel, context } = params;
  const { subject, message } = generateNotificationContent(type, context);

  return createNotificationLog({
    recipient_id: recipientId,
    notification_type: type,
    channel,
    subject,
    message_content: message,
    status: 'queued',
  });
}

export async function queueBatchNotifications(params: {
  recipients: { id: string; displayName: string; channel: NotificationChannel }[];
  type: NotificationType;
  context: Omit<NotificationContext, 'recipientName'>;
}): Promise<MusicNotificationLogRow[]> {
  const { recipients, type, context } = params;
  if (recipients.length === 0) return [];

  const logs: MusicNotificationLogInsert[] = recipients.map((r) => {
    const fullContext: NotificationContext = { ...context, recipientName: r.displayName };
    const { subject, message } = generateNotificationContent(type, fullContext);
    return {
      recipient_id: r.id,
      notification_type: type,
      channel: r.channel,
      subject,
      message_content: message,
      status: 'queued' as const,
    };
  });

  return batchCreateNotificationLogs(logs);
}
