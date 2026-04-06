/**
 * Public Sign-Up Form Types
 *
 * TypeScript types for the church_signups table and
 * public sign-up form submissions (Grupos Casa, Club de Lectura,
 * Apoyo Psicoemocional).
 *
 * These are application-level types — the auto-generated Supabase types
 * file (src/types/supabase.ts) is NOT modified.
 */

// ── Type Unions ─────────────────────────────────────────────────────────────

export type SignupFormType = 'grupos_casa' | 'club_lectura' | 'apoyo_psicoemocional';

export type SignupStatus = 'pending' | 'confirmed' | 'cancelled';

// ── Interfaces ──────────────────────────────────────────────────────────────

/** Mirrors church_signups table row */
export interface ChurchSignup {
  id: string;
  form_type: SignupFormType;
  full_name: string;
  email: string;
  phone: string | null;
  comuna: string | null;
  group_slot: string | null;
  notes: string | null;
  status: SignupStatus;
  spam_score: number;
  ip_address: string | null;
  created_at: string;
  updated_at: string;
}

/** Payload submitted by the public sign-up form */
export interface SignupFormData {
  form_type: SignupFormType;
  full_name: string;
  email: string;
  phone?: string;
  comuna?: string;
  group_slot?: string;
  notes?: string;
  /** Honeypot field — must be empty for legitimate submissions */
  _honey?: string;
  /** Timestamp when the form was rendered (anti-spam timing check) */
  _timestamp?: number;
}
