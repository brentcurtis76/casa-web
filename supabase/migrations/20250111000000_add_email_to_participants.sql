-- Add email column to mesa_abierta_participants
-- This allows participants to use a different email for Mesa Abierta events

ALTER TABLE mesa_abierta_participants
ADD COLUMN IF NOT EXISTS email TEXT;

-- Add index for email lookups
CREATE INDEX IF NOT EXISTS idx_mesa_participants_email ON mesa_abierta_participants(email);
