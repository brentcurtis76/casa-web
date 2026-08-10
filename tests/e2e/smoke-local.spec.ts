/**
 * Humo del entorno de pruebas LOCAL — AUDIO / E-infra-impl.
 *
 * No prueba una funcionalidad de producto: prueba que el arnés existe y es
 * correcto. Si este spec pasa, entonces el stack local está arriba, el seed se
 * aplicó, la app habla con la base LOCAL (no con la compartida con Life OS), el
 * usuario sintético inicia sesión y llega a una ruta de admin, y el ciclo
 * sembrar → asegurar → limpiar deja la tabla exactamente como la encontró.
 *
 * El viaje de siete pasos está congelado en §S7 de
 * `docs/plan/audio/evidence/E-infra-spike.md` (rama `docs/plan-audio`).
 *
 * CONTRATO DE LIMPIEZA — no se relaja:
 *   Este test borra ÚNICAMENTE filas cuyo `id` cae en el rango
 *   `00000000-e2e0-4000-8000-…`. Las filas del BASELINE (rango `…-9000-…`) NO se
 *   borran nunca: ni al final, ni en un `afterAll`, ni en un cleanup de
 *   emergencia. Restaurar el baseline es tarea de `supabase db reset`.
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';
import { ALLOWED_SUPABASE_URLS } from './helpers/guard';

// ── Identidades del contrato de rangos (§S7) ────────────────────────────────
const BASELINE_PUBLICADO = '00000000-e2e0-4000-9000-000000000010';
const BASELINE_BORRADOR = '00000000-e2e0-4000-9000-000000000011';
const FIXTURE_DEL_TEST = '00000000-e2e0-4000-8000-000000000001';
const FIXTURE_GUID = 'e2e-guid-8001';

/**
 * Los ÚNICOS `id` sobre los que este spec puede afirmar (E3b, D24).
 *
 * `playwright.config.ts` tiene `fullyParallel: true`: mientras el humo corre, otros specs
 * tienen sembradas sus propias filas publicadas, visibles para `anon`. Una aserción sobre
 * la tabla ENTERA es por construcción incompatible con eso — no falla por un entorno sucio,
 * falla por un vecino legítimo. Los pasos 1 y 7 se acotan a este bloque; el resto del viaje,
 * la guarda y el contrato de limpieza no cambian.
 */
const IDS_QUE_POSEE = [FIXTURE_DEL_TEST, BASELINE_PUBLICADO, BASELINE_BORRADOR];

/** Los `id` propios presentes en una lectura, en el orden en que llegaron. */
const soloLosPropios = (filas: Episodio[]): string[] =>
  filas.map((f) => f.id).filter((id) => IDS_QUE_POSEE.includes(id));

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? '';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? '';

interface Episodio {
  id: string;
  status: string;
}

/**
 * Cuarta comprobación de la lista blanca, ya dentro del worker de test.
 *
 * Las capas 1 y 3 corren en el proceso principal de Playwright. Este spec habla
 * con PostgREST por su cuenta, así que valida su propia URL antes de emitir la
 * primera petición: una escritura contra la base equivocada no es un test rojo,
 * es datos en producción.
 */
function urlBase(): string {
  if (!ALLOWED_SUPABASE_URLS.includes(SUPABASE_URL)) {
    throw new Error(
      `[humo] VITE_SUPABASE_URL = "${SUPABASE_URL}" no está en la lista blanca. ` +
        `Se aborta antes de tocar la base.`
    );
  }
  return SUPABASE_URL;
}

/** Token de acceso del admin sintético, vía GoTrue (contraseña). */
async function tokenDeAdmin(): Promise<string> {
  const res = await fetch(`${urlBase()}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.TEST_ADMIN_EMAIL,
      password: process.env.TEST_ADMIN_PASSWORD,
    }),
  });

  const cuerpo = await res.json();
  expect(res.status, `GoTrue devolvió ${res.status}: ${JSON.stringify(cuerpo)}`).toBe(200);
  expect(cuerpo.access_token, 'GoTrue no devolvió access_token').toBeTruthy();
  return cuerpo.access_token as string;
}

/** Lee `church_podcast_episodes` con el token que se le pase (anon o admin). */
async function leerEpisodios(token: string): Promise<Episodio[]> {
  const res = await fetch(
    `${urlBase()}/rest/v1/church_podcast_episodes?select=id,status&order=id`,
    { headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` } }
  );
  const cuerpo = await res.json();
  expect(res.status, `PostgREST devolvió ${res.status}: ${JSON.stringify(cuerpo)}`).toBe(200);
  return cuerpo as Episodio[];
}

/**
 * Borra el fixture del test. Sólo el rango `8000`, y por `id` exacto.
 *
 * Nunca un DELETE sin `where`, nunca un `like` sobre el prefijo: un patrón mal
 * escrito que alcanzara el rango `9000` destruiría el baseline en silencio.
 */
async function borrarFixture(token: string): Promise<number> {
  const res = await fetch(
    `${urlBase()}/rest/v1/church_podcast_episodes?id=eq.${FIXTURE_DEL_TEST}`,
    {
      method: 'DELETE',
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${token}`,
        Prefer: 'return=representation',
      },
    }
  );
  const cuerpo = await res.json();
  expect(res.status, `DELETE devolvió ${res.status}: ${JSON.stringify(cuerpo)}`).toBe(200);
  return (cuerpo as Episodio[]).length;
}

test.describe('Humo del entorno local', () => {
  // Red de seguridad: si una aserción intermedia revienta, el fixture no puede
  // quedarse. Es idempotente (borrar dos veces el mismo `id` devuelve 0 filas) y
  // toca EXCLUSIVAMENTE el rango `8000`.
  test.afterAll(async () => {
    try {
      await borrarFixture(await tokenDeAdmin());
    } catch {
      // El propio test ya habrá fallado con el error real; no lo tapamos.
    }
  });

  test('siembra, asegura y limpia sin salirse del rango 8000', async ({ page }) => {
    const token = await tokenDeAdmin();

    await test.step('1 · pre-estado: exactamente el baseline publicado', async () => {
      const filas = await leerEpisodios(ANON_KEY);
      // De los tres ids que este spec posee, anon tiene que ver EXACTAMENTE uno: el
      // baseline publicado. Ni el borrador del baseline (ésa es la RLS) ni el fixture
      // propio, que todavía no se ha sembrado.
      expect(
        soloLosPropios(filas),
        'El entorno está sucio: de los ids del humo, anon debería ver sólo el baseline ' +
          'publicado. Corre `supabase db reset` antes de reintentar.'
      ).toEqual([BASELINE_PUBLICADO]);
    });

    await test.step('2 · sembrar el fixture propio (rango 8000)', async () => {
      const res = await fetch(`${urlBase()}/rest/v1/church_podcast_episodes`, {
        method: 'POST',
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          id: FIXTURE_DEL_TEST,
          title: '[TEST] Reflexion del humo',
          episode_date: '2026-02-01',
          guid: FIXTURE_GUID,
          status: 'published',
          // Los cuatro campos que exige el CHECK `published_episode_complete`.
          published_at: new Date('2026-02-01T12:00:00Z').toISOString(),
          audio_url: 'https://example.invalid/e2e-guid-8001.mp3',
          audio_size_bytes: 2345678,
          duration_seconds: 420,
        }),
      });
      const cuerpo = await res.json();
      expect(res.status, `INSERT devolvió ${res.status}: ${JSON.stringify(cuerpo)}`).toBe(201);
    });

    await test.step('3 · login del admin sintético en el navegador', async () => {
      const entro = await loginAsAdmin(page);
      expect(entro, 'loginAsAdmin() no encontró credenciales o formulario').toBe(true);
    });

    await test.step('4 · el admin sembrado llega a /admin/roles', async () => {
      // Enmienda 1, salida (a): la ruta exige `general_admin` del RBAC de CASA,
      // que el seed asigna en `church_user_roles`. Si esa fila faltara,
      // ProtectedRoute redirigiría a /admin y este paso fallaría.
      await page.goto('/admin/roles');
      await page.waitForLoadState('networkidle');

      await expect(page.getByRole('heading', { name: 'Gestión de Roles' })).toBeVisible();
      await expect(page.getByText('general_admin')).toBeVisible();
      expect(new URL(page.url()).pathname).toBe('/admin/roles');
    });

    await test.step('5 · anon ve los dos publicados y ningún borrador', async () => {
      const filas = await leerEpisodios(ANON_KEY);
      expect(filas.map((f) => f.id).sort()).toEqual(
        [FIXTURE_DEL_TEST, BASELINE_PUBLICADO].sort()
      );
      expect(filas.every((f) => f.status === 'published')).toBe(true);
      expect(filas.map((f) => f.id)).not.toContain(BASELINE_BORRADOR);
    });

    await test.step('6 · limpieza: sólo el rango 8000', async () => {
      expect(await borrarFixture(token)).toBe(1);
    });

    await test.step('7 · post-estado: la tabla es el baseline, ni más ni menos', async () => {
      // Con el token de admin, para ver también el borrador del baseline.
      const filas = await leerEpisodios(token);
      // De los tres ids propios quedan los dos del baseline y ninguno más: el fixture
      // se borró, y el borrado no se llevó por delante el baseline.
      expect(
        soloLosPropios(filas).sort(),
        'El humo tenía que dejar sus ids como los encontró: los dos del baseline, ' +
          'sin su fixture.'
      ).toEqual([BASELINE_PUBLICADO, BASELINE_BORRADOR].sort());
    });
  });
});
