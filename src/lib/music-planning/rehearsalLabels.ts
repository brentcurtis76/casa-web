import type { RehearsalStatus, RsvpStatus } from '@/types/musicPlanning';

export const REHEARSAL_STATUS_LABELS: Record<RehearsalStatus, string> = {
  scheduled: 'Programado',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  completed: 'Completado',
};

export const RSVP_STATUS_LABELS: Record<RsvpStatus, string> = {
  pending: 'Pendiente',
  accepted: 'Aceptado',
  declined: 'Rechazado',
};
