/**
 * Children Publication State Service — Supabase CRUD
 *
 * Manages publication state and packet delivery tracking for children's
 * ministry activities generated from Liturgy Builder.
 *
 * Mirrors the pattern of music-planning/publicationStateService.ts
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  ChildrenPublicationStateRow,
  ChildrenPublicationStateInsert,
  ChildrenPublicationStateUpdate,
  ChildrenPacketDeliveryRow,
  ChildrenPacketDeliveryInsert,
  ChildrenPacketDeliveryUpdate,
} from '@/types/childrenPublicationState';

// =====================================================
// PUBLICATION STATE — CRUD
// =====================================================

/**
 * Get publication state by liturgy_id + age_group_id (unique combo).
 */
export async function getPublicationByLiturgyAndAgeGroup(
  liturgyId: string,
  ageGroupId: string
): Promise<ChildrenPublicationStateRow | null> {
  const { data, error } = await supabase
    .from('church_children_publication_state')
    .select('*')
    .eq('liturgy_id', liturgyId)
    .eq('age_group_id', ageGroupId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as ChildrenPublicationStateRow) || null;
}

/**
 * Get all publications for a liturgy.
 */
export async function getPublicationsByLiturgyId(
  liturgyId: string
): Promise<ChildrenPublicationStateRow[]> {
  const { data, error } = await supabase
    .from('church_children_publication_state')
    .select('*')
    .eq('liturgy_id', liturgyId)
    .order('published_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ChildrenPublicationStateRow[];
}

/**
 * Get a single publication by ID.
 */
export async function getPublicationById(
  id: string
): Promise<ChildrenPublicationStateRow | null> {
  const { data, error } = await supabase
    .from('church_children_publication_state')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as ChildrenPublicationStateRow) || null;
}

/**
 * Create a new publication state record.
 */
export async function createPublication(
  data: ChildrenPublicationStateInsert
): Promise<ChildrenPublicationStateRow> {
  const { data: row, error } = await supabase
    .from('church_children_publication_state')
    .insert(data)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return row as ChildrenPublicationStateRow;
}

/**
 * Update a publication state record by ID.
 */
export async function updatePublication(
  id: string,
  updates: ChildrenPublicationStateUpdate
): Promise<ChildrenPublicationStateRow> {
  const { data: row, error } = await supabase
    .from('church_children_publication_state')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return row as ChildrenPublicationStateRow;
}

/**
 * Increment the publish_version of a publication state record.
 * Also updates published_at to now().
 */
export async function incrementPublishVersion(
  id: string,
  updates?: ChildrenPublicationStateUpdate
): Promise<ChildrenPublicationStateRow> {
  // Fetch current version
  const { data: current, error: fetchError } = await supabase
    .from('church_children_publication_state')
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
    .from('church_children_publication_state')
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
): Promise<ChildrenPacketDeliveryRow[]> {
  const { data, error } = await supabase
    .from('church_children_packet_deliveries')
    .select('*')
    .eq('publication_id', publicationId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ChildrenPacketDeliveryRow[];
}

/**
 * Create a single delivery record.
 */
export async function createDelivery(
  data: ChildrenPacketDeliveryInsert
): Promise<ChildrenPacketDeliveryRow> {
  const { data: row, error } = await supabase
    .from('church_children_packet_deliveries')
    .insert(data)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return row as ChildrenPacketDeliveryRow;
}

/**
 * Batch create delivery records.
 */
export async function batchCreateDeliveries(
  deliveries: ChildrenPacketDeliveryInsert[]
): Promise<ChildrenPacketDeliveryRow[]> {
  if (deliveries.length === 0) return [];

  const { data, error } = await supabase
    .from('church_children_packet_deliveries')
    .insert(deliveries)
    .select('*');

  if (error) throw new Error(error.message);
  return (data ?? []) as ChildrenPacketDeliveryRow[];
}

/**
 * Update a delivery record (status, external_id, error_message).
 */
export async function updateDelivery(
  id: string,
  updates: ChildrenPacketDeliveryUpdate
): Promise<ChildrenPacketDeliveryRow> {
  const { data: row, error } = await supabase
    .from('church_children_packet_deliveries')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return row as ChildrenPacketDeliveryRow;
}
