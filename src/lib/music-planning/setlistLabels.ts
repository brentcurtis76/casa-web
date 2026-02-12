import type { SetlistStatus } from '@/types/musicPlanning';
import type { LiturgicalMoment } from '@/types/musicPlanning';

export const SETLIST_STATUS_LABELS: Record<SetlistStatus, string> = {
  draft: 'Borrador',
  finalized: 'Finalizado',
  presented: 'Presentado',
};

export const LITURGICAL_MOMENT_LABELS: Record<LiturgicalMoment, string> = {
  'himno-entrada': 'Himno de entrada',
  'himno-gloria': 'Himno de gloria',
  'cancion-meditacion': 'Canción de meditación',
  'himno-salida': 'Himno de salida',
  'comunion': 'Comunión',
  'ofrenda': 'Ofrenda',
  'adoracion': 'Adoración',
  'reflexion': 'Reflexión',
};
