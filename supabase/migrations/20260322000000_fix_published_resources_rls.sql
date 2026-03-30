-- Migration: Fix published_resources RLS for archive page
-- Project: CASA
-- Date: 2026-03-22
-- Purpose: Allow anonymous/public users to read ALL published resources (active and archived)
-- The original policy restricted SELECT to is_active = true rows, breaking the archive page.

-- 1. Drop the restrictive policy
DROP POLICY IF EXISTS "Anyone can read active published resources" ON published_resources;

-- 2. Create unrestricted read policy for all users (anon + authenticated)
CREATE POLICY "Anyone can read all published resources public"
  ON published_resources
  FOR SELECT
  TO anon, authenticated
  USING (true);
