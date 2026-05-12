-- church_signup_settings: per-form-type closure/capacity controls for the
-- public signup edge function (grupos_casa, club_lectura, apoyo_psicoemocional).

CREATE TABLE IF NOT EXISTS public.church_signup_settings (
  form_type      TEXT PRIMARY KEY
                   CHECK (form_type IN ('grupos_casa', 'club_lectura', 'apoyo_psicoemocional')),
  is_open        BOOLEAN NOT NULL DEFAULT true,
  cutoff_at      TIMESTAMPTZ,
  max_capacity   INTEGER,
  closed_message TEXT,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by     UUID
);

ALTER TABLE public.church_signup_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "church_signup_settings_select_anon"          ON public.church_signup_settings;
DROP POLICY IF EXISTS "church_signup_settings_select_authenticated" ON public.church_signup_settings;
DROP POLICY IF EXISTS "church_signup_settings_admin_insert"         ON public.church_signup_settings;
DROP POLICY IF EXISTS "church_signup_settings_admin_update"         ON public.church_signup_settings;
DROP POLICY IF EXISTS "church_signup_settings_admin_delete"         ON public.church_signup_settings;

CREATE POLICY "church_signup_settings_select_anon"
  ON public.church_signup_settings FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "church_signup_settings_select_authenticated"
  ON public.church_signup_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "church_signup_settings_admin_insert"
  ON public.church_signup_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "church_signup_settings_admin_update"
  ON public.church_signup_settings FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "church_signup_settings_admin_delete"
  ON public.church_signup_settings FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

INSERT INTO public.church_signup_settings (form_type)
VALUES ('grupos_casa'), ('club_lectura'), ('apoyo_psicoemocional')
ON CONFLICT (form_type) DO NOTHING;
