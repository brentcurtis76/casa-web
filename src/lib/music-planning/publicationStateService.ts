/**
 * Publication State Service — Supabase CRUD for music_publication_state
 * and music_packet_deliveries tables.
 *
 * Tracks which liturgy published to which setlist, versioning, and
 * email delivery status per musician.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  MusicPublicationStateRow,
  MusicPublicationStateInsert,
  MusicPublicationStateUpdate,
  MusicPacketDeliveryRow,
  MusicPacketDeliveryInsert,
  MusicPacketDeliveryUpdate,
  PublicationWithDeliverySummary,
} from '@/types/musicPlanning';

// =====================================================
// PUBLICATION STATE — CRUD
// =====================================================

/**
 * Get publication state by liturgy_id (TEXT).
 * Returns the most recent publication for a given liturgy.
 */
export async function getPublicationByLiturgyId(
  liturgyId: string
): Promise<MusicPublicationStateRow | null> {
  const { data, error } = await supabase
    .from('music_publication_state')
    .select('*')
    .eq('liturgy_id', liturgyId)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as MusicPublicationStateRow | null;
}

/**
 * Get publication state by liturgy_id AND service_date_id (unique combo).
 */
export async function getPublicationByLiturgyAndServiceDate(
  liturgyId: string,
  serviceDateId: string
): Promise<MusicPublicationStateRow | null> {
  const { data, error } = await supabase
    .from('music_publication_state')
    .select('*')
    .eq('liturgy_id', liturgyId)
    .eq('service_date_id', serviceDateId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as MusicPublicationStateRow | null;
}

/**
 * Get publication state by service_date_id.
 */
export async function getPublicationByServiceDateId(
  serviceDateId: string
): Promise<MusicPublicationStateRow | null> {
  const { data, error } = await supabase
    .from('music_publication_state')
    .select('*')
    .eq('service_date_id', serviceDateId)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as MusicPublicationStateRow | null;
}

/**
 * Get publication state with delivery summary for a service date.
 */
export async function getPublicationWithDeliverySummary(
  serviceDateId: string
): Promise<PublicationWithDeliverySummary | null> {
  const pub = await getPublicationByServiceDateId(serviceDateId);
  if (!pub) return null;

  const deliveries = await getDeliveriesForPublication(pub.id);

  const summary = {
    total: deliveries.length,
    sent: deliveries.filter((d) => d.status === 'sent' || d.status === 'delivered').length,
    failed: deliveries.filter((d) => d.status === 'failed').length,
    pending: deliveries.filter((d) => d.status === 'pending').length,
  };

  return { ...pub, deliverySummary: summary };
}

/**
 * Create a new publication state record.
 */
export async function createPublication(
  data: MusicPublicationStateInsert
): Promise<MusicPublicationStateRow> {
  const { data: row, error } = await supabase
    .from('music_publication_state')
    .insert(data)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return row as MusicPublicationStateRow;
}

/**
 * Update a publication state record by ID.
 */
export async function updatePublication(
  id: string,
  updates: MusicPublicationStateUpdate
): Promise<MusicPublicationStateRow> {
  const { data: row, error } = await supabase
    .from('music_publication_state')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return row as MusicPublicationStateRow;
}

/**
 * Increment the publish_version of a publication state record.
 * Also updates published_at to now().
 */
export async function incrementPublishVersion(
  id: string,
  updates?: MusicPublicationStateUpdate
): Promise<MusicPublicationStateRow> {
  // Fetch current version
  const { data: current, error: fetchError } = await supabase
    .from('music_publication_state')
    .select('publish_version')
    .eq('id', id)
    .single();

  if (fetchError) throw new Error(fetchError.message);

  const currentVersion = (current as { publish_version: number }).publish_version;

  return updatePublication(id, {
    ...updates,
    publish_version: currentVersion + 1,
    published_at: new Date().toISOString(),
  });
}

/**
 * Delete a publication state record by ID.
 */
export async function deletePublication(id: string): Promise<void> {
  const { error } = await supabase
    .from('music_publication_state')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

// =====================================================
// PACKET DELIVERIES — CRUD
// =====================================================

/**
 * Get all deliveries for a publication.
 */
export async function getDeliveriesForPublication(
  publicationId: string
): Promise<MusicPacketDeliveryRow[]> {
  const { data, error } = await supabase
    .from('music_packet_deliveries')
    .select('*')
    .eq('publication_id', publicationId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as MusicPacketDeliveryRow[];
}

/**
 * Create a single delivery record.
 */
export async function createDelivery(
  data: MusicPacketDeliveryInsert
): Promise<MusicPacketDeliveryRow> {
  const { data: row, error } = await supabase
    .from('music_packet_deliveries')
    .insert(data)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return row as MusicPacketDeliveryRow;
}

/**
 * Batch create delivery records.
 */
export async function batchCreateDeliveries(
  deliveries: MusicPacketDeliveryInsert[]
): Promise<MusicPacketDeliveryRow[]> {
  if (deliveries.length === 0) return [];

  const { data, error } = await supabase
    .from('music_packet_deliveries')
    .insert(deliveries)
    .select('*');

  if (error) throw new Error(error.message);
  return (data ?? []) as MusicPacketDeliveryRow[];
}

/**
 * Update a delivery record (status, external_id, error_message).
 */
export async function updateDelivery(
  id: string,
  updates: MusicPacketDeliveryUpdate
): Promise<MusicPacketDeliveryRow> {
  const { data: row, error } = await supabase
    .from('music_packet_deliveries')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return row as MusicPacketDeliveryRow;
}
