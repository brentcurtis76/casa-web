-- Allow anonymous users to read mesa_abierta_participants for stats display
-- This enables showing participant count to non-logged-in users

CREATE POLICY "Allow public read access for stats"
ON mesa_abierta_participants
FOR SELECT
TO anon
USING (true);
