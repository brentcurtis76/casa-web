/**
 * Financial Module — Personnel Service Layer
 *
 * Supabase CRUD functions for personnel (church_fin_personnel).
 * Each function receives the Supabase client as its first parameter
 * (dependency injection for testability).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Personnel, ContractType } from '@/types/financial';
import { validateRut } from './rutValidator';
import { writeAuditLog } from './financialService';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PersonnelFilters {
  is_active?: boolean;
}

export interface PersonnelCreateData {
  name: string;
  rut: string;
  role_position: string;
  contract_type: ContractType;
  gross_salary: number;
  afp_name?: string | null;
  isapre_name?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  start_date?: string | null;
}

export type PersonnelUpdateData = Partial<PersonnelCreateData>;

// ─── Service Functions ──────────────────────────────────────────────────────

/**
 * List personnel with optional filters.
 */
export async function getPersonnel(
  client: SupabaseClient,
  filters?: PersonnelFilters
): Promise<{ data: Personnel[] | null; error: Error | null }> {
  let query = client
    .from('church_fin_personnel')
    .select('id, name, rut, role_position, contract_type, gross_salary, afp_name, isapre_name, bank_name, bank_account_number, start_date, is_active, created_at')
    .order('name', { ascending: true });

  if (filters?.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active);
  }

  const { data, error } = await query;

  if (error) return { data: null, error };
  return { data: (data as Personnel[]) ?? [], error: null };
}

/**
 * Create a new personnel record. Validates RUT before insert.
 */
export async function createPersonnel(
  client: SupabaseClient,
  data: PersonnelCreateData,
  userId?: string
): Promise<{ data: Personnel | null; error: Error | null }> {
  if (!validateRut(data.rut)) {
    return { data: null, error: new Error('RUT inválido') };
  }

  if (data.bank_account_number && !/^\d{1,20}$/.test(data.bank_account_number)) {
    return { data: null, error: new Error('Número de cuenta bancaria inválido') };
  }

  const { data: result, error } = await client
    .from('church_fin_personnel')
    .insert(data)
    .select()
    .single();

  if (error) return { data: null, error };

  if (userId) {
    writeAuditLog(client, userId, 'fin_personnel_create', {
      resource_type: 'fin_personnel',
      resource_id: (result as Personnel).id,
      name: data.name,
    });
  }

  return { data: result as Personnel, error: null };
}

/**
 * Update an existing personnel record.
 */
export async function updatePersonnel(
  client: SupabaseClient,
  id: string,
  data: PersonnelUpdateData,
  userId?: string
): Promise<{ data: Personnel | null; error: Error | null }> {
  if (data.rut && !validateRut(data.rut)) {
    return { data: null, error: new Error('RUT inválido') };
  }

  if (data.bank_account_number && !/^\d{1,20}$/.test(data.bank_account_number)) {
    return { data: null, error: new Error('Número de cuenta bancaria inválido') };
  }

  const { data: result, error } = await client
    .from('church_fin_personnel')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) return { data: null, error };

  if (userId) {
    writeAuditLog(client, userId, 'fin_personnel_update', {
      resource_type: 'fin_personnel',
      resource_id: id,
    });
  }

  return { data: result as Personnel, error: null };
}

/**
 * Activate or deactivate a personnel record.
 */
export async function togglePersonnelActive(
  client: SupabaseClient,
  id: string,
  is_active: boolean,
  userId?: string
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from('church_fin_personnel')
    .update({ is_active })
    .eq('id', id);

  if (!error && userId) {
    writeAuditLog(client, userId, 'fin_personnel_toggle', {
      resource_type: 'fin_personnel',
      resource_id: id,
      is_active,
    });
  }

  return { error: error ?? null };
}
