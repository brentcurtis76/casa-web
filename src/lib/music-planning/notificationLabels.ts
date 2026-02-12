import type {
  NotificationType,
  NotificationChannel,
  NotificationDeliveryStatus,
} from '@/types/musicPlanning';

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  assignment: 'Asignación',
  reminder_1week: 'Recordatorio (1 semana)',
  reminder_1day: 'Recordatorio (1 día)',
  availability_request: 'Solicitud de disponibilidad',
  rehearsal_invite: 'Invitación a ensayo',
  rehearsal_reminder: 'Recordatorio de ensayo',
  schedule_published: 'Programación publicada',
  cancellation: 'Cancelación',
};

export const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannel, string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
};

export const NOTIFICATION_STATUS_LABELS: Record<NotificationDeliveryStatus, string> = {
  queued: 'En cola',
  sent: 'Enviado',
  delivered: 'Entregado',
  failed: 'Fallido',
};
