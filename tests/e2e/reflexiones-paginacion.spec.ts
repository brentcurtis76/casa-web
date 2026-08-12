/**
 * Paginación por keyset de `/reflexiones` — AUDIO / E3b, criterios E3b.2 y E3b.3.
 *
 * Es el único spec que necesita un lote propio de 13 filas, y por eso vive separado.
 *
 * DOS PATAS, a propósito:
 *   - `E3b.2` contra PostgREST DIRECTAMENTE, con salida cruda. Un test puro puede probar la
 *     aritmética del cursor; NO puede probar que PostgREST parsea el `.or()` anidado.
 *   - `E3b.3` a través de la aplicación real, que es donde muere la mutación de offset.
 *
 * CONTRATO DE LIMPIEZA — no se relaja. `playwright.config.ts` tiene `fullyParallel: true`,
 * así que este spec POSEE un bloque enumerado y borra ÚNICAMENTE esos `id`, uno a uno.
 * Jamás por rango ni por prefijo: un patrón sobre `8000` alcanzaría los fixtures de
 * `smoke-local.spec.ts` (`…0001`) y de `reflexiones.spec.ts` (`…0201`) en vivo.
 *
 * Las filas del BASELINE (rango `…-9000-…`) NO se tocan nunca.
 *
 * UN SOLO `test` con pasos, no varios `test`: con `fullyParallel` dos tests del mismo
 * fichero correrían a la vez y se destruirían el fixture mutuamente.
 */

import { test, expect, type Page } from '@playwright/test';
import { ALLOWED_SUPABASE_URLS } from './helpers/guard';

// ── Bloque de ids que este spec posee, enumerado ────────────────────────────
/** La fila que se inserta ENTRE peticiones (E3b.3b). Ordena antes del cursor. */
const ID_INTRUSA = '00000000-e2e0-4000-8000-000000000100';
/** Las 13 del fixture congelado, en orden ascendente conocido. */
const IDS_FIXTURE = [
  '00000000-e2e0-4000-8000-000000000101',
  '00000000-e2e0-4000-8000-000000000102',
  '00000000-e2e0-4000-8000-000000000103',
  '00000000-e2e0-4000-8000-000000000104',
  '00000000-e2e0-4000-8000-000000000105',
  '00000000-e2e0-4000-8000-000000000106',
  '00000000-e2e0-4000-8000-000000000107',
  '00000000-e2e0-4000-8000-000000000108',
  '00000000-e2e0-4000-8000-000000000109',
  '00000000-e2e0-4000-8000-000000000110',
  '00000000-e2e0-4000-8000-000000000111',
  '00000000-e2e0-4000-8000-000000000112',
  '00000000-e2e0-4000-8000-000000000113',
];
const IDS_PROPIOS = [ID_INTRUSA, ...IDS_FIXTURE];

const BASELINE_PUBLICADO = '00000000-e2e0-4000-9000-000000000010';
const TITULO_BASELINE = '[BASELINE] Reflexion publicada';

/** Título visible de una fila del fixture, derivado de su `id`. */
const tituloDe = (id: string) => `[PAG] ${id.slice(-3)}`;

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? '';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? '';

const TAMANO_LOTE = 13;
const TAMANO_PAGINA = 12;

interface Fila {
  id: string;
  published_at: string;
}

/** Cuarta comprobación de la lista blanca, ya dentro del worker (igual que el humo). */
function urlBase(): string {
  if (!ALLOWED_SUPABASE_URLS.includes(SUPABASE_URL)) {
    throw new Error(
      `[paginación] VITE_SUPABASE_URL = "${SUPABASE_URL}" no está en la lista blanca. ` +
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

/**
 * Lee como ANÓNIMO con el MISMO orden y límite que `construirConsultaPagina`.
 * Devuelve el estado y el cuerpo crudos, que es lo que E3b.2 exige enseñar.
 */
async function paginaComoAnonimo(
  cursor: Fila | null
): Promise<{ status: number; cuerpo: unknown; url: string }> {
  const params = new URLSearchParams({
    select: 'id,published_at,title',
    status: 'eq.published',
    order: 'published_at.desc,id.asc',
    limit: String(TAMANO_LOTE),
  });
  if (cursor) {
    // La MISMA gramática que emite `.or()` de supabase-js: `or=(a,and(b,c))`.
    params.set(
      'or',
      `(published_at.lt.${cursor.published_at},` +
        `and(published_at.eq.${cursor.published_at},id.gt.${cursor.id}))`
    );
  }

  const url = `${urlBase()}/rest/v1/church_podcast_episodes?${params.toString()}`;
  const res = await fetch(url, { headers: { apikey: ANON_KEY } });
  return { status: res.status, cuerpo: await res.json(), url };
}

async function insertar(
  token: string,
  id: string,
  publishedAt: string,
  episodeDate: string
): Promise<void> {
  const res = await fetch(`${urlBase()}/rest/v1/church_podcast_episodes`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      id,
      title: tituloDe(id),
      episode_date: episodeDate,
      guid: `e2e-pag-${id.slice(-3)}`,
      status: 'published',
      // Preferencia de slug EXPLÍCITA y distinta por fila.
      //
      // El trigger de E3a agota su presupuesto en cinco intentos (`sin sufijo`, `-2`…`-5`),
      // así que 13 filas que compartieran `episode_date` derivarían la misma base y la sexta
      // fallaría con `23514: no hay slug libre`. Medido. El fixture congelado fija el
      // `published_at` y los `id`; el slug lo aporta el test.
      slug: `e2e-pag-${id.slice(-3)}`,
      published_at: publishedAt,
      audio_url: `https://example.invalid/pag-${id.slice(-3)}.mp3`,
      audio_size_bytes: 1000,
      duration_seconds: 60,
    }),
  });
  const cuerpo = await res.json();
  expect(res.status, `INSERT ${id} devolvió ${res.status}: ${JSON.stringify(cuerpo)}`).toBe(201);
}

/** Borra sólo los `id` de este spec, uno a uno. Idempotente. */
async function limpiar(token: string): Promise<void> {
  for (const id of IDS_PROPIOS) {
    await fetch(`${urlBase()}/rest/v1/church_podcast_episodes?id=eq.${id}`, {
      method: 'DELETE',
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
    });
  }
}

/** Lo que pinta la página mientras `cargando` es true. Es su señal de re-render. */
const TEXTO_CARGANDO = 'Cargando reflexiones…';

/**
 * Los títulos de las tarjetas del índice, en el orden en que se pintan.
 *
 * **Esperar al selector NO basta, y por eso este paso parpadeaba.** Mientras `cargando` es
 * true la página DESMONTA el `<ul>`. Entre la página 1 y la 2 el selector sigue existiendo
 * —es el de la página ANTERIOR—, así que `waitForSelector` volvía al instante y la lectura
 * caía en el hueco del re-render: `allTextContents()` devolvía `[]` y el paso 6 fallaba con
 * «página 2 = []». Intermitente, y sólo bajo la suite completa.
 *
 * Medido antes de tocarlo: **falla también en el árbol de la r4, sin una línea de la r5**, en
 * 2 de 4 corridas completas. No es contención de datos —cada spec borra sólo sus ids (D24)—,
 * es una espera que no espera a lo que cree.
 *
 * Se ancla en el indicador de carga de la propia página, que es su declaración de que el
 * re-render terminó, y no en el contenido esperado: si se esperase a lo que el test afirma,
 * la aserción no probaría nada y la mutación de offset moriría por timeout en vez de por su
 * propio mensaje.
 */
async function titulosEnPantalla(page: Page): Promise<string[]> {
  await expect(page.getByText(TEXTO_CARGANDO)).toBeHidden();

  const titulos = page.locator('main ul li h2');
  await expect(titulos.first()).toBeVisible();

  return titulos.allTextContents();
}

test.describe('Paginación por keyset de /reflexiones', () => {
  test.afterAll(async () => {
    try {
      await limpiar(await tokenDeAdmin());
    } catch {
      // El propio test ya habrá fallado con el error real; no lo tapamos.
    }
  });

  test('E3b.2 y E3b.3 — el cursor no solapa ni salta', async ({ page }) => {
    const token = await tokenDeAdmin();
    await limpiar(token); // por si una corrida anterior murió a medias

    let publishedAtFixture = '';

    await test.step('1 · sembrar 13 filas, la que ordena ÚLTIMA primero', async () => {
      // Todas comparten `published_at`, así que el orden depende SÓLO del desempate por
      // `id`. Y se pinchan por encima del baseline para que las 12 de la página 1 sean
      // exactamente las del fixture.
      const anon = await paginaComoAnonimo(null);
      const baseline = (anon.cuerpo as Fila[]).find((f) => f.id === BASELINE_PUBLICADO);
      expect(baseline, 'el baseline publicado tiene que existir; corre `supabase db reset`').toBeTruthy();

      publishedAtFixture = new Date(
        Date.parse(baseline!.published_at) + 3600_000
      ).toISOString();

      // `…0113` PRIMERO: así el orden físico de inserción NO coincide con el de `id`, y
      // una consulta sin desempate puede devolverlas en el orden equivocado.
      const ordenDeInsercion = [IDS_FIXTURE[12], ...IDS_FIXTURE.slice(0, 12)];
      for (const id of ordenDeInsercion) {
        await insertar(token, id, publishedAtFixture, '2026-03-01');
      }
    });

    let cursor: Fila | null = null;

    await test.step('2 · E3b.2 · la consulta REAL contra PostgREST — página 1', async () => {
      const { status, cuerpo, url } = await paginaComoAnonimo(null);
      console.log(`[E3b.2] GET ${url}`);
      console.log(`[E3b.2] status=${status} cuerpo=${JSON.stringify(cuerpo)}`);

      expect(status).toBe(200);
      const filas = cuerpo as Fila[];
      // Se piden 13 y llegan 13: las 12 que se muestran más el centinela.
      expect(filas).toHaveLength(TAMANO_LOTE);
      expect(filas.slice(0, TAMANO_PAGINA).map((f) => f.id)).toEqual(
        IDS_FIXTURE.slice(0, 12)
      );

      cursor = filas[TAMANO_PAGINA - 1];
      console.log(`[E3b.2] cursor = ${JSON.stringify(cursor)}`);
    });

    await test.step('3 · E3b.2 · el `.or()` anidado — página 2', async () => {
      const { status, cuerpo, url } = await paginaComoAnonimo(cursor);
      console.log(`[E3b.2] GET ${url}`);
      console.log(`[E3b.2] status=${status} cuerpo=${JSON.stringify(cuerpo)}`);

      // Si el `.or()` anidado no se comporta, la unidad reporta FINDINGS y para.
      // NO se cae al offset en silencio.
      expect(status, 'PostgREST no aceptó el `.or()` anidado ⇒ FINDINGS, no offset').toBe(200);

      const filas = cuerpo as Fila[];
      const propias = filas.map((f) => f.id).filter((id) => IDS_FIXTURE.includes(id));
      expect(propias, 'la 13.ª y sólo la 13.ª').toEqual([IDS_FIXTURE[12]]);
    });

    await test.step('4 · E3b.3a · la página 1 de la APP, en orden exacto', async () => {
      await page.goto('/reflexiones');
      // Pertenencia Y ORDEN exactos. No «cada id aparece una vez»: eso es justo lo que
      // dejaba sobrevivir a la mutación del desempate.
      expect(await titulosEnPantalla(page)).toEqual(
        IDS_FIXTURE.slice(0, 12).map(tituloDe)
      );
    });

    await test.step('5 · E3b.3b · se publica algo que ordena ANTES del cursor', async () => {
      // Mismo `published_at`, `id` menor que todos: ordena la primera de todas. Si ordenara
      // DESPUÉS del cursor el offset sobreviviría, y por eso el fixture está congelado.
      await insertar(token, ID_INTRUSA, publishedAtFixture, '2026-03-02');
    });

    await test.step('6 · E3b.3c · la página 2 no repite ni salta', async () => {
      // Se engancha la respuesta ANTES del clic: así la lectura no puede ocurrir mientras la
      // consulta de la página 2 sigue en vuelo. Se filtra sólo por tabla, no por `or=`, para
      // que la mutación de offset —que pide por rango, sin `or=`— siga muriendo por su propia
      // aserción y no por un timeout.
      const respuestaPagina2 = page.waitForResponse((r) =>
        r.url().includes('church_podcast_episodes')
      );
      await page.getByRole('button', { name: 'Más antiguas' }).click();
      await respuestaPagina2;

      const titulos = await titulosEnPantalla(page);
      console.log(`[E3b.3] página 2 = ${JSON.stringify(titulos)}`);

      // Con OFFSET, la fila intrusa desplaza todo y `…0112` volvería a salir aquí.
      for (const id of IDS_FIXTURE.slice(0, 12)) {
        expect(titulos, `${tituloDe(id)} se repite ⇒ la paginación es por offset`).not.toContain(
          tituloDe(id)
        );
      }
      // Ni se salta la 13.ª, ni se cuela la intrusa en el recorrido en curso.
      expect(titulos.slice(0, 2)).toEqual([tituloDe(IDS_FIXTURE[12]), TITULO_BASELINE]);
      expect(titulos).not.toContain(tituloDe(ID_INTRUSA));
    });

    await test.step('7 · E3b.3d · la fila nueva aparece AL RECARGAR, no antes', async () => {
      await page.goto('/reflexiones');
      const titulos = await titulosEnPantalla(page);
      expect(titulos[0]).toBe(tituloDe(ID_INTRUSA));
    });

    await test.step('8 · limpieza exacta: sólo los ids de este spec', async () => {
      await limpiar(token);

      const { cuerpo } = await paginaComoAnonimo(null);
      const restantes = (cuerpo as Fila[]).map((f) => f.id);
      for (const id of IDS_PROPIOS) expect(restantes).not.toContain(id);
      // El baseline sigue intacto: restaurarlo es tarea de `supabase db reset`, no nuestra.
      expect(restantes).toContain(BASELINE_PUBLICADO);
    });
  });
});
