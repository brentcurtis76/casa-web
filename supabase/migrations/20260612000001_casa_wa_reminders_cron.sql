-- =====================================================
-- Daily cron to invoke wa-reminders edge function.
-- Runs at 18:00 UTC (14:00 Chile during standard time).
-- Requires pg_cron + pg_net extensions and two app GUC settings:
--   app.wa_reminders_url    : full https://<project>.supabase.co/functions/v1/wa-reminders
--   app.wa_reminders_secret : bearer secret (matches WA_REMINDERS_CRON_SECRET on the function)
--
-- If either extension is missing in this environment, the DO block is a no-op
-- and Brent needs to run the cron registration SQL manually after enabling
-- the extensions (see comment block below).
-- =====================================================

DO $$
DECLARE
  has_pg_cron boolean;
  has_pg_net  boolean;
  fn_url      text;
  fn_secret   text;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') INTO has_pg_cron;
  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net')  INTO has_pg_net;

  IF NOT has_pg_cron OR NOT has_pg_net THEN
    RAISE NOTICE 'wa-reminders cron skipped: pg_cron=% pg_net=%', has_pg_cron, has_pg_net;
    RETURN;
  END IF;

  -- Read configuration from app settings; bail quietly if not set yet.
  BEGIN
    fn_url    := current_setting('app.wa_reminders_url',    true);
    fn_secret := current_setting('app.wa_reminders_secret', true);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'wa-reminders cron skipped: app.wa_reminders_* settings not configured';
    RETURN;
  END;

  IF fn_url IS NULL OR fn_url = '' OR fn_secret IS NULL OR fn_secret = '' THEN
    RAISE NOTICE 'wa-reminders cron skipped: app.wa_reminders_url / app.wa_reminders_secret are empty';
    RETURN;
  END IF;

  -- Drop any existing job so we can recreate idempotently.
  PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'wa_reminders_daily';

  PERFORM cron.schedule(
    'wa_reminders_daily',
    '0 18 * * *',
    format(
      $cron$
      SELECT net.http_post(
        url     := %L,
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || %L
        ),
        body    := '{}'::jsonb
      );
      $cron$,
      fn_url,
      fn_secret
    )
  );
END;
$$;

-- -----------------------------------------------------
-- Manual fallback (run as superuser if the DO block above was a no-op):
--
--   CREATE EXTENSION IF NOT EXISTS pg_cron;
--   CREATE EXTENSION IF NOT EXISTS pg_net;
--   ALTER DATABASE postgres SET app.wa_reminders_url    = 'https://<project>.supabase.co/functions/v1/wa-reminders';
--   ALTER DATABASE postgres SET app.wa_reminders_secret = '<WA_REMINDERS_CRON_SECRET>';
--   -- then re-run this migration, or call cron.schedule(...) manually.
-- -----------------------------------------------------
