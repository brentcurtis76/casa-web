/**
 * Inventory Service — Supabase CRUD for inventory items
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  ChildrenInventoryRow,
  ChildrenInventoryInsert,
  ChildrenInventoryUpdate,
} from '@/types/childrenMinistry';

/**
 * Get all inventory items.
 */
export async function getInventory(): Promise<ChildrenInventoryRow[]> {
  const { data, error } = await supabase
    .from('church_children_inventory')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ChildrenInventoryRow[];
}

/**
 * Get a single inventory item by ID.
 */
export async function getInventoryItem(id: string): Promise<ChildrenInventoryRow> {
  const { data, error } = await supabase
    .from('church_children_inventory')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message);
  return data as ChildrenInventoryRow;
}

/**
 * Create a new inventory item.
 */
export async function createInventoryItem(
  item: ChildrenInventoryInsert,
): Promise<ChildrenInventoryRow> {
  const { data, error } = await supabase
    .from('church_children_inventory')
    .insert(item)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as ChildrenInventoryRow;
}

/**
 * Update an inventory item.
 */
export async function updateInventoryItem(
  id: string,
  update: ChildrenInventoryUpdate,
): Promise<ChildrenInventoryRow> {
  const { data, error } = await supabase
    .from('church_children_inventory')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as ChildrenInventoryRow;
}

/**
 * Delete an inventory item.
 */
export async function deleteInventoryItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('church_children_inventory')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

/**
 * Get inventory items with low stock (quantity < min_quantity and min_quantity > 0).
 */
export async function getLowStockItems(): Promise<ChildrenInventoryRow[]> {
  const { data, error } = await supabase
    .from('church_children_inventory')
    .select('*')
    .gt('min_quantity', 0);

  if (error) throw new Error(error.message);

  const items = (data ?? []) as ChildrenInventoryRow[];
  return items.filter((item) => item.quantity < item.min_quantity);
}

/**
 * Restock an item by updating quantity and last_restocked_at.
 */
export async function restockItem(id: string, newQuantity: number): Promise<ChildrenInventoryRow> {
  const { data, error } = await supabase
    .from('church_children_inventory')
    .update({
      quantity: newQuantity,
      last_restocked_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as ChildrenInventoryRow;
}
