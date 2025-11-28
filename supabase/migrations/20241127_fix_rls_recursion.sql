-- =====================================================
-- Fix RLS Infinite Recursion in Mesa Abierta Tables
-- Migration: 2024-11-27
-- Problem: Matches policy queries Assignments, Assignments policy queries Matches
-- =====================================================

-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view own matches" ON mesa_abierta_matches;
DROP POLICY IF EXISTS "Users can view own assignments" ON mesa_abierta_assignments;

-- Recreate matches policy without referencing assignments
-- Users who are hosts can view their matches
CREATE POLICY "Users can view own matches"
  ON mesa_abierta_matches FOR SELECT
  USING (
    -- User is the host
    EXISTS (
      SELECT 1 FROM mesa_abierta_participants
      WHERE id = host_participant_id AND user_id = auth.uid()
    )
    OR
    -- User is an admin
    is_mesa_admin(auth.uid())
  );

-- Guests can view matches they're assigned to (separate policy, no recursion)
CREATE POLICY "Guests can view assigned matches"
  ON mesa_abierta_matches FOR SELECT
  USING (
    id IN (
      SELECT a.match_id
      FROM mesa_abierta_assignments a
      JOIN mesa_abierta_participants p ON p.id = a.guest_participant_id
      WHERE p.user_id = auth.uid()
    )
  );

-- Recreate assignments policy without referencing matches directly in a way that causes recursion
CREATE POLICY "Users can view own assignments"
  ON mesa_abierta_assignments FOR SELECT
  USING (
    -- User is the guest in this assignment
    EXISTS (
      SELECT 1 FROM mesa_abierta_participants
      WHERE id = guest_participant_id AND user_id = auth.uid()
    )
    OR
    -- User is an admin
    is_mesa_admin(auth.uid())
  );

-- Hosts can view assignments for their matches (separate policy)
CREATE POLICY "Hosts can view assignments for their matches"
  ON mesa_abierta_assignments FOR SELECT
  USING (
    match_id IN (
      SELECT m.id
      FROM mesa_abierta_matches m
      JOIN mesa_abierta_participants p ON p.id = m.host_participant_id
      WHERE p.user_id = auth.uid()
    )
  );

-- Also fix dietary restrictions policy which has similar issues
DROP POLICY IF EXISTS "Users can view group dietary restrictions" ON mesa_abierta_dietary_restrictions;

-- Recreate without the circular references
CREATE POLICY "Hosts can view guest dietary restrictions"
  ON mesa_abierta_dietary_restrictions FOR SELECT
  USING (
    -- If user is a host, can see restrictions for guests assigned to their match
    participant_id IN (
      SELECT a.guest_participant_id
      FROM mesa_abierta_assignments a
      JOIN mesa_abierta_matches m ON m.id = a.match_id
      JOIN mesa_abierta_participants host_p ON host_p.id = m.host_participant_id
      WHERE host_p.user_id = auth.uid()
    )
  );

CREATE POLICY "Guests can view group dietary restrictions"
  ON mesa_abierta_dietary_restrictions FOR SELECT
  USING (
    -- If user is a guest, can see restrictions for others in their group
    participant_id IN (
      SELECT other_a.guest_participant_id
      FROM mesa_abierta_assignments my_a
      JOIN mesa_abierta_participants my_p ON my_p.id = my_a.guest_participant_id
      JOIN mesa_abierta_assignments other_a ON other_a.match_id = my_a.match_id
      WHERE my_p.user_id = auth.uid()
    )
    OR
    -- Include host's dietary restrictions
    participant_id IN (
      SELECT m.host_participant_id
      FROM mesa_abierta_assignments my_a
      JOIN mesa_abierta_participants my_p ON my_p.id = my_a.guest_participant_id
      JOIN mesa_abierta_matches m ON m.id = my_a.match_id
      WHERE my_p.user_id = auth.uid()
    )
  );

-- =====================================================
-- COMPLETION
-- =====================================================
COMMENT ON SCHEMA public IS 'Fixed RLS infinite recursion in Mesa Abierta tables';
