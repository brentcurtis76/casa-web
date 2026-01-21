/**
 * Servicio de sesiones de presentación
 * Permite guardar, cargar y gestionar sesiones para uso cross-device
 *
 * Phase 1.6: Presentation Persistence
 */

import { supabase } from '@/integrations/supabase/client';
import type { Slide } from '@/types/shared/slide';
import {
  SESSION_STATE_VERSION,
  type PresentationSession,
  type PresentationSessionState,
  type PresentationSessionSummary,
  type CreateSessionData,
  type StyleState,
  type LogoState,
  type TextOverlayState,
  type ImageOverlayState,
  type TempSlideEdit,
} from './types';

/**
 * Guarda una nueva sesión de presentación
 */
export async function saveSession(data: CreateSessionData): Promise<PresentationSession> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  const { data: session, error } = await supabase
    .from('presentation_sessions')
    .insert({
      liturgy_id: data.liturgyId,
      name: data.name,
      description: data.description,
      state: data.state as unknown as Record<string, unknown>,
      created_by: user.id,
      service_date: data.serviceDate,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return mapSessionFromDB(session);
}

/**
 * Actualiza una sesión existente con nuevo estado
 */
export async function updateSession(
  sessionId: string,
  state: PresentationSessionState
): Promise<PresentationSession> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  const { data: session, error } = await supabase
    .from('presentation_sessions')
    .update({
      state: state as unknown as Record<string, unknown>,
      // updated_at is handled by database trigger
    })
    .eq('id', sessionId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return mapSessionFromDB(session);
}

/**
 * Carga una sesión por ID
 */
export async function loadSession(sessionId: string): Promise<PresentationSession | null> {
  const { data: session, error } = await supabase
    .from('presentation_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null;
    }
    throw error;
  }

  return mapSessionFromDB(session);
}

/**
 * Lista todas las sesiones disponibles
 * Opcionalmente filtrar por liturgia
 */
export async function listSessions(liturgyId?: string): Promise<PresentationSessionSummary[]> {
  let query = supabase
    .from('presentation_sessions')
    .select(`
      id,
      name,
      description,
      liturgy_id,
      service_date,
      created_at,
      created_by,
      liturgias(titulo),
      profiles:created_by(full_name)
    `)
    .eq('is_archived', false)
    .order('created_at', { ascending: false });

  if (liturgyId) {
    query = query.eq('liturgy_id', liturgyId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data.map(session => ({
    id: session.id,
    name: session.name,
    description: session.description || undefined,
    liturgyId: session.liturgy_id,
    liturgyTitle: (session.liturgias as { titulo?: string } | null)?.titulo || 'Liturgia',
    createdByName: (session.profiles as { full_name?: string } | null)?.full_name || 'Usuario',
    createdAt: session.created_at,
    serviceDate: session.service_date || undefined,
  }));
}

/**
 * Elimina (archiva) una sesión
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  const { error } = await supabase
    .from('presentation_sessions')
    .update({ is_archived: true })
    .eq('id', sessionId);

  if (error) {
    throw error;
  }
}

/**
 * Renombra una sesión
 */
export async function renameSession(
  sessionId: string,
  name: string,
  description?: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  const { error } = await supabase
    .from('presentation_sessions')
    .update({
      name,
      description: description ?? null,
      // updated_at is handled by database trigger
    })
    .eq('id', sessionId);

  if (error) {
    throw error;
  }
}

/**
 * Helper: Mapea datos de DB al tipo TypeScript
 */
function mapSessionFromDB(dbSession: {
  id: string;
  liturgy_id: string;
  name: string;
  description: string | null;
  state: unknown;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  service_date: string | null;
  is_archived: boolean;
}): PresentationSession {
  return {
    id: dbSession.id,
    liturgyId: dbSession.liturgy_id,
    name: dbSession.name,
    description: dbSession.description || undefined,
    state: dbSession.state as PresentationSessionState,
    createdBy: dbSession.created_by || '',
    createdAt: dbSession.created_at,
    updatedAt: dbSession.updated_at,
    serviceDate: dbSession.service_date || undefined,
    isArchived: dbSession.is_archived,
  };
}

/**
 * Helper: Crea un PresentationSessionState desde el estado actual de la presentación
 */
export function createSessionState(
  slides: Slide[],
  styleState: StyleState,
  logoState: LogoState,
  textOverlayState: TextOverlayState,
  imageOverlayState: ImageOverlayState,
  tempEdits: Record<string, TempSlideEdit>,
  previewSlideIndex: number,
  liveSlideIndex: number
): PresentationSessionState {
  // Filter to only include temp slides (those with 'temp-' or 'imported-' prefix in ID)
  const tempSlides = slides.filter(
    s => s.id.startsWith('temp-') || s.id.startsWith('imported-')
  );

  return {
    version: SESSION_STATE_VERSION,
    tempSlides,
    styleState,
    logoState,
    textOverlayState,
    imageOverlayState,
    tempEdits,
    previewSlideIndex,
    liveSlideIndex,
  };
}

/**
 * Helper: Combina los tempSlides de una sesión con los slides base de una liturgia
 */
export function mergeTempSlides(
  baseSlides: Slide[],
  tempSlides: Slide[]
): Slide[] {
  // Remove any existing temp/imported slides from base
  const filtered = baseSlides.filter(
    s => !s.id.startsWith('temp-') && !s.id.startsWith('imported-')
  );

  // Append temp slides at the end
  // Note: In the future, we might want to preserve original positions
  return [...filtered, ...tempSlides];
}
