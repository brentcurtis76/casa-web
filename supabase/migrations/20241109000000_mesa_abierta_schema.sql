-- =====================================================
-- La Mesa Abierta - Complete Database Schema
-- Migration: Initial setup
-- Created: 2024-11-09
-- =====================================================

-- =====================================================
-- ENUMS
-- =====================================================

-- Status for monthly events
CREATE TYPE mesa_abierta_month_status AS ENUM (
  'open',           -- Registration open
  'matching',       -- Algorithm running
  'matched',        -- Assignments complete
  'completed'       -- Dinner finished
);

-- Role preferences and assignments
CREATE TYPE mesa_abierta_role AS ENUM (
  'host',
  'guest'
);

-- Participant status
CREATE TYPE mesa_abierta_participant_status AS ENUM (
  'pending',        -- Waiting for matching
  'confirmed',      -- Assignment confirmed
  'cancelled',      -- User cancelled
  'waitlist'        -- On waitlist
);

-- Food assignments
CREATE TYPE mesa_abierta_food_assignment AS ENUM (
  'main_course',
  'salad',
  'drinks',
  'dessert',
  'none'
);

-- Dietary restriction types
CREATE TYPE mesa_abierta_dietary_type AS ENUM (
  'vegetarian',
  'vegan',
  'gluten_free',
  'dairy_free',
  'nut_allergy',
  'shellfish_allergy',
  'other'
);

-- Severity of dietary restrictions
CREATE TYPE mesa_abierta_dietary_severity AS ENUM (
  'preference',     -- Lifestyle choice
  'allergy',        -- Medical allergy
  'religious'       -- Religious requirement
);

-- Email types for logging
CREATE TYPE mesa_abierta_email_type AS ENUM (
  'confirmation',
  'assignment',
  'reminder',
  'cancellation',
  'custom'
);

-- Email/WhatsApp status
CREATE TYPE mesa_abierta_message_status AS ENUM (
  'queued',
  'sent',
  'delivered',
  'failed',
  'bounced',
  'undelivered'
);

-- WhatsApp message types
CREATE TYPE mesa_abierta_whatsapp_type AS ENUM (
  'confirmation',
  'reminder_7days',
  'reminder_1day',
  'assignment_host',
  'assignment_guest',
  'feedback_request',
  'emergency',
  'custom'
);

-- Admin roles
CREATE TYPE mesa_abierta_admin_role AS ENUM (
  'super_admin',
  'coordinator'
);

-- =====================================================
-- TABLES
-- =====================================================

-- -----------------------------------------------------
-- Admin Roles Table
-- -----------------------------------------------------
CREATE TABLE mesa_abierta_admin_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role mesa_abierta_admin_role NOT NULL DEFAULT 'coordinator',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id)
);

CREATE INDEX idx_mesa_admin_user ON mesa_abierta_admin_roles(user_id);

-- -----------------------------------------------------
-- Monthly Events Table
-- -----------------------------------------------------
CREATE TABLE mesa_abierta_months (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month_date DATE NOT NULL UNIQUE, -- First day of the month
  registration_deadline TIMESTAMPTZ NOT NULL,
  dinner_date DATE NOT NULL,
  dinner_time TIME NOT NULL DEFAULT '19:00:00', -- 7:00 PM
  status mesa_abierta_month_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mesa_months_status ON mesa_abierta_months(status);
CREATE INDEX idx_mesa_months_date ON mesa_abierta_months(month_date DESC);

-- -----------------------------------------------------
-- Participants Table
-- -----------------------------------------------------
CREATE TABLE mesa_abierta_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_id UUID NOT NULL REFERENCES mesa_abierta_months(id) ON DELETE CASCADE,
  role_preference mesa_abierta_role NOT NULL,
  assigned_role mesa_abierta_role,
  has_plus_one BOOLEAN NOT NULL DEFAULT FALSE,
  plus_one_name TEXT,
  recurring BOOLEAN NOT NULL DEFAULT FALSE,
  host_address TEXT, -- Encrypted in application layer
  host_max_guests INTEGER DEFAULT 5 CHECK (host_max_guests BETWEEN 3 AND 10),
  phone_number TEXT,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  status mesa_abierta_participant_status NOT NULL DEFAULT 'pending',
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, month_id)
);

CREATE INDEX idx_mesa_participants_user ON mesa_abierta_participants(user_id);
CREATE INDEX idx_mesa_participants_month ON mesa_abierta_participants(month_id);
CREATE INDEX idx_mesa_participants_status ON mesa_abierta_participants(status);
CREATE INDEX idx_mesa_participants_role ON mesa_abierta_participants(assigned_role);

-- -----------------------------------------------------
-- Dietary Restrictions Table
-- -----------------------------------------------------
CREATE TABLE mesa_abierta_dietary_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES mesa_abierta_participants(id) ON DELETE CASCADE,
  restriction_type mesa_abierta_dietary_type NOT NULL,
  description TEXT, -- For "other" or additional details
  severity mesa_abierta_dietary_severity NOT NULL DEFAULT 'preference',
  is_plus_one BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE if for plus-one
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mesa_dietary_participant ON mesa_abierta_dietary_restrictions(participant_id);
CREATE INDEX idx_mesa_dietary_type ON mesa_abierta_dietary_restrictions(restriction_type);
CREATE INDEX idx_mesa_dietary_severity ON mesa_abierta_dietary_restrictions(severity);

-- -----------------------------------------------------
-- Matches Table (Dinner Groups)
-- -----------------------------------------------------
CREATE TABLE mesa_abierta_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month_id UUID NOT NULL REFERENCES mesa_abierta_months(id) ON DELETE CASCADE,
  host_participant_id UUID NOT NULL REFERENCES mesa_abierta_participants(id) ON DELETE CASCADE,
  dinner_date DATE NOT NULL,
  dinner_time TIME NOT NULL DEFAULT '19:00:00',
  guest_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mesa_matches_month ON mesa_abierta_matches(month_id);
CREATE INDEX idx_mesa_matches_host ON mesa_abierta_matches(host_participant_id);

-- -----------------------------------------------------
-- Assignments Table (Individual Guests)
-- -----------------------------------------------------
CREATE TABLE mesa_abierta_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES mesa_abierta_matches(id) ON DELETE CASCADE,
  guest_participant_id UUID NOT NULL REFERENCES mesa_abierta_participants(id) ON DELETE CASCADE,
  food_assignment mesa_abierta_food_assignment NOT NULL DEFAULT 'none',
  notification_sent BOOLEAN NOT NULL DEFAULT FALSE,
  notification_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(guest_participant_id, match_id)
);

CREATE INDEX idx_mesa_assignments_match ON mesa_abierta_assignments(match_id);
CREATE INDEX idx_mesa_assignments_guest ON mesa_abierta_assignments(guest_participant_id);
CREATE INDEX idx_mesa_assignments_food ON mesa_abierta_assignments(food_assignment);

-- -----------------------------------------------------
-- Email Logs Table
-- -----------------------------------------------------
CREATE TABLE mesa_abierta_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month_id UUID REFERENCES mesa_abierta_months(id) ON DELETE SET NULL,
  participant_id UUID REFERENCES mesa_abierta_participants(id) ON DELETE SET NULL,
  email_type mesa_abierta_email_type NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status mesa_abierta_message_status NOT NULL DEFAULT 'sent',
  sendgrid_message_id TEXT,
  error_message TEXT
);

CREATE INDEX idx_mesa_email_month ON mesa_abierta_email_logs(month_id);
CREATE INDEX idx_mesa_email_participant ON mesa_abierta_email_logs(participant_id);
CREATE INDEX idx_mesa_email_type ON mesa_abierta_email_logs(email_type);
CREATE INDEX idx_mesa_email_sent_at ON mesa_abierta_email_logs(sent_at DESC);

-- -----------------------------------------------------
-- WhatsApp Messages Table
-- -----------------------------------------------------
CREATE TABLE mesa_abierta_whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID REFERENCES mesa_abierta_participants(id) ON DELETE SET NULL,
  month_id UUID REFERENCES mesa_abierta_months(id) ON DELETE SET NULL,
  message_type mesa_abierta_whatsapp_type NOT NULL,
  phone_number TEXT NOT NULL,
  message_content TEXT NOT NULL,
  twilio_message_sid TEXT,
  status mesa_abierta_message_status NOT NULL DEFAULT 'queued',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE INDEX idx_mesa_whatsapp_participant ON mesa_abierta_whatsapp_messages(participant_id);
CREATE INDEX idx_mesa_whatsapp_month ON mesa_abierta_whatsapp_messages(month_id);
CREATE INDEX idx_mesa_whatsapp_type ON mesa_abierta_whatsapp_messages(message_type);
CREATE INDEX idx_mesa_whatsapp_status ON mesa_abierta_whatsapp_messages(status);
CREATE INDEX idx_mesa_whatsapp_sent_at ON mesa_abierta_whatsapp_messages(sent_at DESC);

-- -----------------------------------------------------
-- Photos Table
-- -----------------------------------------------------
CREATE TABLE mesa_abierta_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES mesa_abierta_matches(id) ON DELETE CASCADE,
  month_id UUID NOT NULL REFERENCES mesa_abierta_months(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL, -- Supabase Storage path
  caption TEXT,
  is_approved BOOLEAN NOT NULL DEFAULT FALSE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_mesa_photos_match ON mesa_abierta_photos(match_id);
CREATE INDEX idx_mesa_photos_month ON mesa_abierta_photos(month_id);
CREATE INDEX idx_mesa_photos_uploaded_by ON mesa_abierta_photos(uploaded_by);
CREATE INDEX idx_mesa_photos_approved ON mesa_abierta_photos(is_approved);
CREATE INDEX idx_mesa_photos_featured ON mesa_abierta_photos(is_featured);

-- -----------------------------------------------------
-- Testimonials Table
-- -----------------------------------------------------
CREATE TABLE mesa_abierta_testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month_id UUID NOT NULL REFERENCES mesa_abierta_months(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES mesa_abierta_participants(id) ON DELETE CASCADE,
  match_id UUID REFERENCES mesa_abierta_matches(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  testimonial_text TEXT,
  would_participate_again BOOLEAN NOT NULL,
  what_went_well TEXT,
  suggestions_for_improvement TEXT,
  is_approved BOOLEAN NOT NULL DEFAULT FALSE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  UNIQUE(participant_id, month_id)
);

CREATE INDEX idx_mesa_testimonials_month ON mesa_abierta_testimonials(month_id);
CREATE INDEX idx_mesa_testimonials_participant ON mesa_abierta_testimonials(participant_id);
CREATE INDEX idx_mesa_testimonials_rating ON mesa_abierta_testimonials(rating);
CREATE INDEX idx_mesa_testimonials_approved ON mesa_abierta_testimonials(is_approved);
CREATE INDEX idx_mesa_testimonials_featured ON mesa_abierta_testimonials(is_featured);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE mesa_abierta_admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesa_abierta_months ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesa_abierta_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesa_abierta_dietary_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesa_abierta_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesa_abierta_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesa_abierta_email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesa_abierta_whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesa_abierta_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesa_abierta_testimonials ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------
-- Helper Function: Check if user is admin
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION is_mesa_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM mesa_abierta_admin_roles
    WHERE user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------
-- Admin Roles Policies
-- -----------------------------------------------------
-- Only admins can view admin roles
CREATE POLICY "Admins can view admin roles"
  ON mesa_abierta_admin_roles FOR SELECT
  USING (is_mesa_admin(auth.uid()));

-- Only super admins can insert/update/delete admin roles
CREATE POLICY "Super admins can manage admin roles"
  ON mesa_abierta_admin_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM mesa_abierta_admin_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- -----------------------------------------------------
-- Months Policies
-- -----------------------------------------------------
-- Everyone can view months
CREATE POLICY "Anyone can view months"
  ON mesa_abierta_months FOR SELECT
  USING (true);

-- Only admins can insert/update/delete months
CREATE POLICY "Admins can manage months"
  ON mesa_abierta_months FOR ALL
  USING (is_mesa_admin(auth.uid()));

-- -----------------------------------------------------
-- Participants Policies
-- -----------------------------------------------------
-- Users can view their own participations
CREATE POLICY "Users can view own participations"
  ON mesa_abierta_participants FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all participations
CREATE POLICY "Admins can view all participations"
  ON mesa_abierta_participants FOR SELECT
  USING (is_mesa_admin(auth.uid()));

-- Users can insert their own participations
CREATE POLICY "Users can insert own participations"
  ON mesa_abierta_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own participations (before matching)
CREATE POLICY "Users can update own participations"
  ON mesa_abierta_participants FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending');

-- Admins can update all participations
CREATE POLICY "Admins can update all participations"
  ON mesa_abierta_participants FOR UPDATE
  USING (is_mesa_admin(auth.uid()));

-- Admins can delete participations
CREATE POLICY "Admins can delete participations"
  ON mesa_abierta_participants FOR DELETE
  USING (is_mesa_admin(auth.uid()));

-- -----------------------------------------------------
-- Dietary Restrictions Policies
-- -----------------------------------------------------
-- Users can view their own dietary restrictions
CREATE POLICY "Users can view own dietary restrictions"
  ON mesa_abierta_dietary_restrictions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM mesa_abierta_participants
      WHERE id = participant_id AND user_id = auth.uid()
    )
  );

-- Users can view dietary restrictions for their assigned dinner group
CREATE POLICY "Users can view group dietary restrictions"
  ON mesa_abierta_dietary_restrictions FOR SELECT
  USING (
    -- If user is a host, can see all restrictions for their guests
    EXISTS (
      SELECT 1 FROM mesa_abierta_matches m
      JOIN mesa_abierta_participants p ON p.id = m.host_participant_id
      JOIN mesa_abierta_assignments a ON a.match_id = m.id
      WHERE p.user_id = auth.uid()
        AND a.guest_participant_id = mesa_abierta_dietary_restrictions.participant_id
    )
    OR
    -- If user is a guest, can see all restrictions in their group
    EXISTS (
      SELECT 1 FROM mesa_abierta_assignments a
      JOIN mesa_abierta_matches m ON m.id = a.match_id
      JOIN mesa_abierta_participants my_p ON my_p.id = a.guest_participant_id
      JOIN mesa_abierta_assignments other_a ON other_a.match_id = m.id
      WHERE my_p.user_id = auth.uid()
        AND other_a.guest_participant_id = mesa_abierta_dietary_restrictions.participant_id
    )
  );

-- Admins can view all dietary restrictions
CREATE POLICY "Admins can view all dietary restrictions"
  ON mesa_abierta_dietary_restrictions FOR SELECT
  USING (is_mesa_admin(auth.uid()));

-- Users can insert their own dietary restrictions
CREATE POLICY "Users can insert own dietary restrictions"
  ON mesa_abierta_dietary_restrictions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mesa_abierta_participants
      WHERE id = participant_id AND user_id = auth.uid()
    )
  );

-- Users can update their own dietary restrictions
CREATE POLICY "Users can update own dietary restrictions"
  ON mesa_abierta_dietary_restrictions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM mesa_abierta_participants
      WHERE id = participant_id AND user_id = auth.uid()
    )
  );

-- Users can delete their own dietary restrictions
CREATE POLICY "Users can delete own dietary restrictions"
  ON mesa_abierta_dietary_restrictions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM mesa_abierta_participants
      WHERE id = participant_id AND user_id = auth.uid()
    )
  );

-- -----------------------------------------------------
-- Matches Policies
-- -----------------------------------------------------
-- Users can view matches they're part of (as host or guest)
CREATE POLICY "Users can view own matches"
  ON mesa_abierta_matches FOR SELECT
  USING (
    -- User is the host
    EXISTS (
      SELECT 1 FROM mesa_abierta_participants
      WHERE id = host_participant_id AND user_id = auth.uid()
    )
    OR
    -- User is a guest in this match
    EXISTS (
      SELECT 1 FROM mesa_abierta_assignments a
      JOIN mesa_abierta_participants p ON p.id = a.guest_participant_id
      WHERE a.match_id = mesa_abierta_matches.id AND p.user_id = auth.uid()
    )
  );

-- Admins can view all matches
CREATE POLICY "Admins can view all matches"
  ON mesa_abierta_matches FOR SELECT
  USING (is_mesa_admin(auth.uid()));

-- Only admins can insert/update/delete matches
CREATE POLICY "Admins can manage matches"
  ON mesa_abierta_matches FOR ALL
  USING (is_mesa_admin(auth.uid()));

-- -----------------------------------------------------
-- Assignments Policies
-- -----------------------------------------------------
-- Users can view their own assignments
CREATE POLICY "Users can view own assignments"
  ON mesa_abierta_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM mesa_abierta_participants
      WHERE id = guest_participant_id AND user_id = auth.uid()
    )
    OR
    -- Hosts can see assignments for their match
    EXISTS (
      SELECT 1 FROM mesa_abierta_matches m
      JOIN mesa_abierta_participants p ON p.id = m.host_participant_id
      WHERE m.id = match_id AND p.user_id = auth.uid()
    )
  );

-- Admins can view all assignments
CREATE POLICY "Admins can view all assignments"
  ON mesa_abierta_assignments FOR SELECT
  USING (is_mesa_admin(auth.uid()));

-- Only admins can insert/update/delete assignments
CREATE POLICY "Admins can manage assignments"
  ON mesa_abierta_assignments FOR ALL
  USING (is_mesa_admin(auth.uid()));

-- -----------------------------------------------------
-- Email Logs Policies
-- -----------------------------------------------------
-- Only admins can view email logs
CREATE POLICY "Admins can view email logs"
  ON mesa_abierta_email_logs FOR SELECT
  USING (is_mesa_admin(auth.uid()));

-- Only admins and system can insert email logs
CREATE POLICY "Admins can insert email logs"
  ON mesa_abierta_email_logs FOR INSERT
  WITH CHECK (is_mesa_admin(auth.uid()));

-- -----------------------------------------------------
-- WhatsApp Messages Policies
-- -----------------------------------------------------
-- Only admins can view WhatsApp messages
CREATE POLICY "Admins can view whatsapp messages"
  ON mesa_abierta_whatsapp_messages FOR SELECT
  USING (is_mesa_admin(auth.uid()));

-- Only admins and system can insert WhatsApp messages
CREATE POLICY "Admins can insert whatsapp messages"
  ON mesa_abierta_whatsapp_messages FOR INSERT
  WITH CHECK (is_mesa_admin(auth.uid()));

-- -----------------------------------------------------
-- Photos Policies
-- -----------------------------------------------------
-- Users can view approved photos
CREATE POLICY "Users can view approved photos"
  ON mesa_abierta_photos FOR SELECT
  USING (is_approved = true OR auth.uid() = uploaded_by);

-- Admins can view all photos
CREATE POLICY "Admins can view all photos"
  ON mesa_abierta_photos FOR SELECT
  USING (is_mesa_admin(auth.uid()));

-- Users can upload photos for their own matches
CREATE POLICY "Users can upload photos for own matches"
  ON mesa_abierta_photos FOR INSERT
  WITH CHECK (
    auth.uid() = uploaded_by
    AND
    (
      -- User is the host
      EXISTS (
        SELECT 1 FROM mesa_abierta_matches m
        JOIN mesa_abierta_participants p ON p.id = m.host_participant_id
        WHERE m.id = match_id AND p.user_id = auth.uid()
      )
      OR
      -- User is a guest
      EXISTS (
        SELECT 1 FROM mesa_abierta_assignments a
        JOIN mesa_abierta_participants p ON p.id = a.guest_participant_id
        WHERE a.match_id = match_id AND p.user_id = auth.uid()
      )
    )
  );

-- Users can delete their own photos
CREATE POLICY "Users can delete own photos"
  ON mesa_abierta_photos FOR DELETE
  USING (auth.uid() = uploaded_by);

-- Admins can update photos (approve, feature)
CREATE POLICY "Admins can update photos"
  ON mesa_abierta_photos FOR UPDATE
  USING (is_mesa_admin(auth.uid()));

-- Admins can delete photos
CREATE POLICY "Admins can delete photos"
  ON mesa_abierta_photos FOR DELETE
  USING (is_mesa_admin(auth.uid()));

-- -----------------------------------------------------
-- Testimonials Policies
-- -----------------------------------------------------
-- Users can view approved testimonials
CREATE POLICY "Users can view approved testimonials"
  ON mesa_abierta_testimonials FOR SELECT
  USING (is_approved = true);

-- Users can view their own testimonials
CREATE POLICY "Users can view own testimonials"
  ON mesa_abierta_testimonials FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM mesa_abierta_participants
      WHERE id = participant_id AND user_id = auth.uid()
    )
  );

-- Admins can view all testimonials
CREATE POLICY "Admins can view all testimonials"
  ON mesa_abierta_testimonials FOR SELECT
  USING (is_mesa_admin(auth.uid()));

-- Users can insert their own testimonials
CREATE POLICY "Users can insert own testimonials"
  ON mesa_abierta_testimonials FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mesa_abierta_participants
      WHERE id = participant_id AND user_id = auth.uid()
    )
  );

-- Users can update their own testimonials (if not approved yet)
CREATE POLICY "Users can update own testimonials"
  ON mesa_abierta_testimonials FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM mesa_abierta_participants
      WHERE id = participant_id AND user_id = auth.uid()
    )
    AND is_approved = false
  );

-- Admins can update testimonials (approve, feature)
CREATE POLICY "Admins can update testimonials"
  ON mesa_abierta_testimonials FOR UPDATE
  USING (is_mesa_admin(auth.uid()));

-- Admins can delete testimonials
CREATE POLICY "Admins can delete testimonials"
  ON mesa_abierta_testimonials FOR DELETE
  USING (is_mesa_admin(auth.uid()));

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_mesa_months_updated_at
  BEFORE UPDATE ON mesa_abierta_months
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mesa_participants_updated_at
  BEFORE UPDATE ON mesa_abierta_participants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mesa_matches_updated_at
  BEFORE UPDATE ON mesa_abierta_matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mesa_assignments_updated_at
  BEFORE UPDATE ON mesa_abierta_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SAMPLE DATA (Optional - for testing)
-- =====================================================

-- Create a sample month event
INSERT INTO mesa_abierta_months (month_date, registration_deadline, dinner_date, status)
VALUES (
  '2024-12-01',
  '2024-12-08 23:59:59',
  '2024-12-13',
  'open'
);

-- =====================================================
-- STORAGE BUCKET SETUP
-- Note: This needs to be run in Supabase dashboard or via API
-- =====================================================

-- SQL to create storage bucket (run separately if needed)
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('mesa-abierta-photos', 'mesa-abierta-photos', false);

-- Storage policies would be set up via Supabase dashboard:
-- - Allow authenticated users to upload to their own folders
-- - Allow public read access to approved photos
-- - Allow admins to manage all photos

-- =====================================================
-- COMPLETION
-- =====================================================

COMMENT ON SCHEMA public IS 'La Mesa Abierta database schema created successfully';
