/**
 * Musician Labels — Spanish display labels for instrument types,
 * proficiency levels, availability patterns, service types, and statuses.
 */

import type {
  InstrumentType,
  ProficiencyLevel,
  AvailabilityPatternType,
  ServiceType,
  ServiceDateStatus,
  AvailabilityOverrideStatus,
} from '@/types/musicPlanning';

export const INSTRUMENT_LABELS: Record<InstrumentType, string> = {
  vocals: 'Voz',
  acoustic_guitar: 'Guitarra Acústica',
  electric_guitar: 'Guitarra Eléctrica',
  bass: 'Bajo',
  drums: 'Batería',
  keys: 'Teclado',
  percussion: 'Percusión',
  sound_tech: 'Sonido',
  other: 'Otro',
};

export const PROFICIENCY_LABELS: Record<ProficiencyLevel, string> = {
  beginner: 'Principiante',
  intermediate: 'Intermedio',
  advanced: 'Avanzado',
};

export const PATTERN_LABELS: Record<AvailabilityPatternType, string> = {
  every_week: 'Cada semana',
  first_and_third: '1er y 3er domingo',
  second_and_fourth: '2do y 4to domingo',
  first_only: 'Solo 1er domingo',
  second_only: 'Solo 2do domingo',
  third_only: 'Solo 3er domingo',
  fourth_only: 'Solo 4to domingo',
  last_only: 'Solo último domingo',
  custom: 'Personalizado',
};

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  domingo_principal: 'Domingo Principal',
  especial: 'Especial',
  ensayo: 'Ensayo',
};

export const SERVICE_STATUS_LABELS: Record<ServiceDateStatus, string> = {
  planning: 'Planificación',
  confirmed: 'Confirmado',
  completed: 'Completado',
};

export const OVERRIDE_STATUS_LABELS: Record<AvailabilityOverrideStatus, string> = {
  available: 'Disponible',
  unavailable: 'No disponible',
  maybe: 'Tal vez',
};
