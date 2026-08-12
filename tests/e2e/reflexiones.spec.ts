/**
 * `/reflexiones` y `/reflexiones/:slug` ANÓNIMAS — AUDIO / E3b.
 *
 * Criterios E3b.7 (caso positivo del seed), E3b.8 (despublicado CON slug ⇒ la RLS lo tapa),
 * E3b.9 (slug inexistente), E3b.10 (URL canónica visible) y E3b.12 (español).
 *
 * NINGÚN test de este fichero inicia sesión en el navegador: si alguno pasara sólo con
 * sesión, no probaría lo que dice probar.
 *
 * CONTRATO DE LIMPIEZA — este spec POSEE un único id, `…8000-000000000201`, y lo borra por
 * `id` exacto. Nunca por rango ni por prefijo: `smoke-local.spec.ts` (`…0001`) y
 * `reflexiones-paginacion.spec.ts` (`…0100`–`…0113`) viven en el mismo rango `8000` y
 * `fullyParallel: true` los hace correr a la vez.
 */

import { test, expect } from '@playwright/test';
import { ALLOWED_SUPABASE_URLS } from './helpers/guard';

const ORIGEN_CANONICO = 'https://www.anglicanasanandres.cl';

/** Caso positivo: la fila publicada del seed. No se toca. */
const SLUG_BASELINE = 'reflexion-2026-01-04';
const TITULO_BASELINE = '[BASELINE] Reflexion publicada';

/** Fixture propio de E3b.8. */
const ID_DESPUBLICADO = '00000000-e2e0-4000-8000-000000000201';
const FECHA_DESPUBLICADO = '2020-01-01';
/**
 * Se publica en el pasado a propósito: así nunca entra en la página 1 del índice y no puede
 * perturbar las aserciones de orden de `reflexiones-paginacion.spec.ts`, que corre en
 * paralelo.
 */
const PUBLICADO_EN = '2020-01-01T00:00:00+00:00';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? '';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? '';

function urlBase(): string {
  if (!ALLOWED_SUPABASE_URLS.includes(SUPABASE_URL)) {
    throw new Error(
      `[reflexiones] VITE_SUPABASE_URL = "${SUPABASE_URL}" no está en la lista blanca. ` +
        `Se aborta antes de tocar la base.`
    );
  }
  return SUPABASE_URL;
}

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
  return cuerpo.access_token as string;
}

interface FilaEpisodio {
  id: string;
  slug: string | null;
  status: string;
}

/** Lee la fila con el token que se le pase. Con `ANON_KEY` es la mirada del público. */
async function leerFila(token: string, id: string): Promise<FilaEpisodio[]> {
  const res = await fetch(
    `${urlBase()}/rest/v1/church_podcast_episodes?select=id,slug,status&id=eq.${id}`,
    { headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` } }
  );
  return (await res.json()) as FilaEpisodio[];
}

async function borrarFixture(token: string): Promise<void> {
  await fetch(`${urlBase()}/rest/v1/church_podcast_episodes?id=eq.${ID_DESPUBLICADO}`, {
    method: 'DELETE',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
  });
}

test.describe('Páginas públicas de reflexiones', () => {
  // SIN `afterAll` de describe, y es deliberado: con `fullyParallel: true` Playwright
  // reparte los tests de un mismo fichero entre varios workers, y CADA worker ejecuta el
  // `afterAll` del describe que le tocó. Un `afterAll` que borrase el fixture de E3b.8
  // se dispararía al acabar E3b.7 en otro worker y se lo llevaría por delante en vivo
  // — medido: `admin ve []` en la primera corrida. La limpieza vive dentro del test que
  // posee el id.

  test('E3b.7 · el índice y el episodio del seed cargan SIN sesión', async ({ page }) => {
    await page.goto('/reflexiones');

    await expect(page.getByRole('heading', { name: 'Reflexiones', level: 1 })).toBeVisible();
    // El índice pinta tarjetas. NO se afirma que la fila del seed esté en la PÁGINA 1:
    // `reflexiones-paginacion.spec.ts` corre en paralelo y publica 13 filas más nuevas que
    // legítimamente la empujan a la siguiente página. El caso positivo del seed se prueba
    // donde E3b.7 lo pide: en su propia URL, justo debajo.
    await expect(page.locator('main ul li h2').first()).toBeVisible();

    await page.goto(`/reflexiones/${SLUG_BASELINE}`);
    await expect(page.getByRole('heading', { name: TITULO_BASELINE, level: 1 })).toBeVisible();

    // Reproductor y descarga (E3b.6).
    await expect(page.locator('audio')).toHaveCount(1);
    await expect(page.getByRole('link', { name: /Descargar el audio/ })).toBeVisible();

    // La fila del seed no trae `speaker` NI `cover_url`: los dos fallbacks, en vivo.
    await expect(page.getByText(/Anónimo/i)).toHaveCount(0);
    await expect(
      page.getByRole('img', { name: /CASA — Comunidad Anglicana San Andrés/ }).first()
    ).toBeVisible();
  });

  test('E3b.10 · la URL canónica es visible y copiable, literal', async ({ page }) => {
    await page.goto(`/reflexiones/${SLUG_BASELINE}`);

    const campo = page.getByLabel('Comparte esta reflexión');
    await expect(campo).toBeVisible();
    // LITERAL. Cambiar `CANONICAL_ORIGIN` por otra cadena pone este test rojo.
    await expect(campo).toHaveValue(`${ORIGEN_CANONICO}/reflexiones/${SLUG_BASELINE}`);
    await expect(page.getByRole('button', { name: 'Copiar enlace' })).toBeVisible();
  });

  test('E3b.9 · un slug inexistente muestra «no encontrado» en español', async ({ page }) => {
    await page.goto('/reflexiones/no-existe-este-slug');

    await expect(
      page.getByRole('heading', { name: 'No encontramos esta reflexión' })
    ).toBeVisible();
    // El HTTP sigue siendo 200 hasta la ola 3; no se finge un 404, y el catch-all en
    // inglés de `NotFound.tsx` no se usa.
    await expect(page.getByText(/Oops! Page not found/i)).toHaveCount(0);
  });

  test('E3b.8 · despublicado CON slug: la RLS lo tapa, pero la fila sigue ahí', async ({
    page,
  }) => {
    const token = await tokenDeAdmin();
    await borrarFixture(token);

    try {
      await ejercerFixtureDespublicado(page, token);
    } finally {
      // La limpieza es de este test, no del describe: es quien posee el id.
      await borrarFixture(token);
    }
  });
});

/**
 * El cuerpo de E3b.8, extraído para que la limpieza del `finally` no dependa de que cada
 * aserción intermedia haya pasado.
 */
async function ejercerFixtureDespublicado(
  page: import('@playwright/test').Page,
  token: string
): Promise<void> {
  {
    // 1 · se PUBLICA sin aportar slug: lo asigna el trigger de E3a.
    const alta = await fetch(`${urlBase()}/rest/v1/church_podcast_episodes`, {
      method: 'POST',
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        id: ID_DESPUBLICADO,
        title: '[TEST] Reflexion despublicada',
        episode_date: FECHA_DESPUBLICADO,
        guid: 'e2e-guid-8201',
        status: 'published',
        published_at: PUBLICADO_EN,
        audio_url: 'https://example.invalid/e2e-guid-8201.mp3',
        audio_size_bytes: 2345678,
        duration_seconds: 300,
      }),
    });
    const creada = (await alta.json()) as FilaEpisodio[];
    expect(alta.status, `INSERT devolvió ${alta.status}: ${JSON.stringify(creada)}`).toBe(201);

    const slug = creada[0].slug;
    console.log(`[E3b.8] el trigger asignó slug = ${slug}`);
    expect(slug, 'el trigger de E3a tiene que haber asignado un slug al publicar').toBeTruthy();

    // 2 · se DESPUBLICA. D12: el slug se conserva.
    const baja = await fetch(
      `${urlBase()}/rest/v1/church_podcast_episodes?id=eq.${ID_DESPUBLICADO}`,
      {
        method: 'PATCH',
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ status: 'draft' }),
      }
    );
    const trasBaja = (await baja.json()) as FilaEpisodio[];
    console.log(`[E3b.8] tras despublicar: ${JSON.stringify(trasBaja)}`);
    expect(baja.status, `PATCH devolvió ${baja.status}: ${JSON.stringify(trasBaja)}`).toBe(200);
    expect(trasBaja[0].status).toBe('draft');
    expect(trasBaja[0].slug, 'D12: despublicar NO borra el slug').toBe(slug);

    // 3 · se pide ANÓNIMAMENTE por ese slug conocido.
    await page.goto(`/reflexiones/${slug}`);
    await expect(
      page.getByRole('heading', { name: 'No encontramos esta reflexión' })
    ).toBeVisible();

    // Tampoco asoma en el índice.
    await page.goto('/reflexiones');
    await expect(page.getByText('[TEST] Reflexion despublicada')).toHaveCount(0);

    // 4 · el control de admin demuestra que la fila NO se borró: es la RLS quien la tapa.
    // Sin esto el test sólo probaría «no existe ese slug», que es otra cosa.
    const comoAnonimo = await leerFila(ANON_KEY, ID_DESPUBLICADO);
    const comoAdmin = await leerFila(token, ID_DESPUBLICADO);
    console.log(`[E3b.8] anon ve ${JSON.stringify(comoAnonimo)}`);
    console.log(`[E3b.8] admin ve ${JSON.stringify(comoAdmin)}`);

    expect(comoAnonimo, 'anon no puede ver un borrador').toHaveLength(0);
    expect(comoAdmin, 'admin SÍ ve la fila: sigue existiendo').toHaveLength(1);
    expect(comoAdmin[0].slug).toBe(slug);
  }
}
