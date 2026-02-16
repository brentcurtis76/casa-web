/**
 * Age Group Service — Query age groups
 *
 * Age groups are pre-seeded and read-only.
 */

import { supabase } from '@/integrations/supabase/client';
import type { ChildrenAgeGroupRow } from '@/types/childrenMinistry';

/**
 * Get all age groups ordered by display_order.
 */
export async function getAgeGroups(): Promise<ChildrenAgeGroupRow[]> {
  const { data, error } = await supabase
    .from('church_children_age_groups')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ChildrenAgeGroupRow[];
}
