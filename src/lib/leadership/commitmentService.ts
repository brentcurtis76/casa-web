/**
 * Commitment Service — Supabase CRUD for church_leadership_commitments
 * NOTE: Column is `assignee_id`, NOT `assigned_to`
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  CommitmentRow,
  CommitmentInsert,
  CommitmentUpdate,
  CommitmentStatus,
  CommitmentFilters,
} from '@/types/leadershipModule';

/**
 * Get commitments with optional filters.
 */
export async function getCommitments(
  filters?: CommitmentFilters,
): Promise<CommitmentRow[]> {
  let query = supabase.from('church_leadership_commitments').select('*');

  if (filters?.meeting_id) {
    query = query.eq('meeting_id', filters.meeting_id);
  }

  if (filters?.assignee_id) {
    query = query.eq('assignee_id', filters.assignee_id);
  }

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.priority) {
    query = query.eq('priority', filters.priority);
  }

  if (filters?.search) {
    const pattern = `%${filters.search}%`;
    query = query.ilike('title', pattern);
  }

  if (filters?.overdue_only) {
    const today = new Date().toISOString().split('T')[0];
    query = query.lt('due_date', today);
    query = query.not('status', 'in', '(completed,cancelled)');
  }

  const { data, error } = await query.order('due_date', { ascending: true, nullsFirst: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as CommitmentRow[];
}

/**
 * Get a single commitment by ID.
 */
export async function getCommitment(id: string): Promise<CommitmentRow> {
  const { data, error } = await supabase
    .from('church_leadership_commitments')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message);
  return data as CommitmentRow;
}

/**
 * Create a new commitment.
 */
export async function createCommitment(commitment: CommitmentInsert): Promise<CommitmentRow> {
  const { data, error } = await supabase
    .from('church_leadership_commitments')
    .insert(commitment)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as CommitmentRow;
}

/**
 * Update a commitment.
 */
export async function updateCommitment(
  id: string,
  update: CommitmentUpdate,
): Promise<CommitmentRow> {
  const { data, error } = await supabase
    .from('church_leadership_commitments')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as CommitmentRow;
}

/**
 * Delete a commitment.
 */
export async function deleteCommitment(id: string): Promise<void> {
  const { error } = await supabase
    .from('church_leadership_commitments')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

/**
 * Update the status of a commitment.
 * If status is 'completed', also sets completed_at to now.
 */
export async function updateCommitmentStatus(
  id: string,
  status: CommitmentStatus,
): Promise<CommitmentRow> {
  const update: CommitmentUpdate = { status };

  if (status === 'completed') {
    update.completed_at = new Date().toISOString();
  } else if (status !== 'cancelled') {
    update.completed_at = null;
  }

  const { data, error } = await supabase
    .from('church_leadership_commitments')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as CommitmentRow;
}

/**
 * Get all overdue commitments.
 */
export async function getOverdueCommitments(): Promise<CommitmentRow[]> {
  return getCommitments({ overdue_only: true });
}

/**
 * Get all commitments for a specific meeting.
 */
export async function getMeetingCommitments(meetingId: string): Promise<CommitmentRow[]> {
  return getCommitments({ meeting_id: meetingId });
}
