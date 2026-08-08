-- =====================================================
-- Seed del stack LOCAL de pruebas — AUDIO / E-infra-impl
--
-- Lo ejecuta `supabase db reset` (y `supabase start`) DESPUÉS de aplicar las
-- migraciones. NO se aplica nunca contra el proyecto alojado: es un fichero de
-- entorno local y sólo el CLI local lo lee.
--
-- Contiene tres cosas, y cada una responde a algo MEDIDO en
-- `docs/plan/audio/evidence/E-infra-spike.md` (rama `docs/plan-audio`):
--
--   1. Los GRANT de tabla (hallazgo F2). Sin esto toda lectura por PostgREST
--      devuelve 401 `42501` aunque la RLS sea correcta.
--   2. El usuario admin sintético (hallazgo F4 + enmienda 1).
--   3. El conjunto BASELINE de filas, en el rango de UUID `…-9000-…`.
--
-- CONTRATO DE RANGOS DE UUID (§S7 de la evidencia) — no se cambia sin cambiar
-- el plan:
--   `00000000-e2e0-4000-9000-…`  BASELINE. Lo crea este fichero. NINGÚN test lo
--                                borra, ni en un afterAll ni en un cleanup de
--                                emergencia. Restaurarlo es tarea de
--                                `supabase db reset`, no de los tests.
--   `00000000-e2e0-4000-8000-…`  PROPIEDAD DEL TEST. Lo crea y lo borra el
--                                propio test, y sólo él.
-- =====================================================


-- =====================================================
-- 1. GRANTs de tabla — hallazgo F2
--
-- Las migraciones corren como `postgres`, cuyos privilegios por defecto en este
-- esquema conceden a `anon` y `authenticated` sólo TRUNCATE/REFERENCES/TRIGGER,
-- sin SELECT. En el proyecto alojado las tablas las crea `supabase_admin`, que
-- sí concede `arwdDxt`; el stack local no reproduce ese estado ambiente y el
-- repo no lo declara en ninguna parte. Medido en §F2.
-- =====================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- `ON ALL TABLES` sólo alcanza a las tablas que existen en este instante
-- (medido en §S3 de la evidencia). `db reset` corre las migraciones ANTES que
-- este seed, así que el caso completo queda cubierto; esto de aquí cubre además
-- la migración incremental aplicada después de un seed, que era el caso roto.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;


-- =====================================================
-- 2. Usuario admin sintético — hallazgo F4 + enmienda 1
--
-- F4: un INSERT en `auth.users` con los campos de token a NULL produce un
-- usuario que NO puede iniciar sesión — GoTrue devuelve HTTP 500 con
-- `converting NULL to string is unsupported` sobre `confirmation_token`. Los
-- cuatro campos van a '' (cadena vacía), y con eso el login devuelve
-- `access_token`. No hace falta fila en `auth.identities`.
--
-- La contraseña es sintética y pública a propósito: este usuario sólo existe en
-- la base local efímera.
-- =====================================================

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin,
  confirmation_token, recovery_token, email_change, email_change_token_new
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-e2e0-4000-9000-000000000001',
  'authenticated', 'authenticated', 'admin@e2e.local',
  extensions.crypt('e2e-local-synthetic', extensions.gen_salt('bf')),
  NOW(), NOW(), NOW(),
  '{"provider":"email","providers":["email"]}', '{}', false,
  '', '', '', ''
) ON CONFLICT (id) DO NOTHING;

-- 2.1 Rol de Mesa Abierta — sin esta fila el usuario inicia sesión pero
-- `is_liturgia_admin()` devuelve `f` y las políticas de admin de `liturgias`,
-- `liturgia_elementos` y `church_podcast_episodes` lo tratan como anónimo.
-- Medido en §S7/B3: `f` → `t`. `user_id` es UNIQUE, así que hay una sola fila.
INSERT INTO public.mesa_abierta_admin_roles (id, user_id, role) VALUES (
  '00000000-e2e0-4000-9000-000000000002',
  '00000000-e2e0-4000-9000-000000000001',
  'super_admin'
) ON CONFLICT (user_id) DO NOTHING;

-- 2.2 Rol `general_admin` del RBAC de CASA — ENMIENDA 1, salida (a).
--
-- `mesa_abierta_admin_roles` y `church_user_roles` son sistemas DISTINTOS.
-- `src/appRoutes.tsx:55` protege `/admin/roles` con `requires={{ role:
-- 'general_admin' }}`, y ese rol se resuelve en `AuthContext` vía la RPC
-- `get_user_roles`, que lee `church_user_roles JOIN church_roles`
-- (`20260209000000_casa_rbac_schema.sql`). Sembrar sólo Mesa Abierta da un
-- usuario que entra a la app y NO llega a esa ruta.
--
-- El `role_id` se resuelve por nombre: la migración crea la fila con
-- `gen_random_uuid()`, así que su id no es fijo y no puede escribirse a mano.
INSERT INTO public.church_user_roles (id, user_id, role_id)
SELECT
  '00000000-e2e0-4000-9000-000000000003',
  '00000000-e2e0-4000-9000-000000000001',
  cr.id
FROM public.church_roles cr
WHERE cr.name = 'general_admin'
ON CONFLICT (user_id, role_id) DO NOTHING;


-- =====================================================
-- 3. Conjunto BASELINE — rango `…-9000-…`
--
-- Es el pre-estado que el test de humo asegura en su paso 1 y el post-estado
-- que asegura en su paso 7. Ningún test lo modifica.
-- =====================================================

-- Dos episodios: uno `published` (visible para `anon`) y uno `draft` (que
-- `anon` NO debe ver). El `published` lleva los cuatro campos que exige el
-- CHECK `published_episode_complete`.
INSERT INTO public.church_podcast_episodes
  (id, title, episode_date, guid, status, published_at, audio_url, audio_size_bytes, duration_seconds)
VALUES
  ('00000000-e2e0-4000-9000-000000000010', '[BASELINE] Reflexion publicada', '2026-01-04',
   'e2e-baseline-0010', 'published', NOW(),
   'https://example.invalid/e2e-baseline-0010.mp3', 1234567, 600),
  ('00000000-e2e0-4000-9000-000000000011', '[BASELINE] Reflexion borrador', '2026-01-11',
   'e2e-baseline-0011', 'draft', NULL, NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- `created_by`, no `user_id`.
INSERT INTO public.liturgias (id, fecha, titulo, created_by) VALUES (
  '00000000-e2e0-4000-9000-000000000020', '2026-01-04', '[BASELINE] Liturgia',
  '00000000-e2e0-4000-9000-000000000001'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.liturgia_elementos (id, liturgia_id, tipo, orden) VALUES (
  '00000000-e2e0-4000-9000-000000000030',
  '00000000-e2e0-4000-9000-000000000020',
  'canto', 1
) ON CONFLICT (id) DO NOTHING;
