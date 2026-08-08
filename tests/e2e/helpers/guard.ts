/**
 * Guarda anti-producción de los e2e — constantes y aserciones compartidas.
 *
 * La base de datos de CASA es COMPARTIDA con Life OS. Un e2e mal configurado no
 * falla: escribe en producción. Por eso la guarda no es una comodidad, es la
 * condición para poder correr la suite.
 *
 * Se comparte entre `playwright.config.ts` (capa 1, entorno del proceso) y
 * `tests/e2e/global-setup.ts` (capa 3, el servidor real) para que las dos capas
 * no puedan divergir en qué consideran "local".
 *
 * Contrato medido en `docs/plan/audio/evidence/E-infra-spike.md` §S5.3
 * (rama `docs/plan-audio`).
 */

/**
 * LISTA BLANCA, no lista negra: se enumera lo permitido y todo lo demás aborta.
 *
 * Una lista negra de `mulsqxfhxxdsadxsljss.supabase.co` dejaría pasar entera la
 * instancia local AJENA del puerto 54321, que está viva en esta máquina y
 * responde HTTP 200 igual que la nuestra (medido en §S5.4, caso E).
 */
export const ALLOWED_SUPABASE_URLS: readonly string[] = [
  'http://127.0.0.1:54331',
  'http://localhost:54331',
];

/**
 * Puerto dedicado de test, distinto del 8080 de `npm run dev`.
 *
 * Dos razones, las dos medidas: que un servidor de desarrollo productivo
 * abierto no pueda ser reutilizado por la suite, y no matar la sesión de
 * desarrollo de quien esté trabajando.
 */
export const TEST_PORT = 8111;

export const TEST_BASE_URL = `http://localhost:${TEST_PORT}`;

/**
 * Exige que una URL de Supabase esté en la lista blanca.
 *
 * @param valor   El valor a validar; `undefined` si la variable no está definida.
 * @param origen  De dónde salió el valor, para que el mensaje diga qué capa abortó.
 */
export function exigirUrlLocal(valor: string | undefined, origen: string): void {
  if (!valor) {
    throw new Error(
      `[guarda e2e · ${origen}] VITE_SUPABASE_URL no está definida. ` +
        `Sin ella el cliente cae al literal de PRODUCCIÓN de ` +
        `src/integrations/supabase/client.ts y los tests escribirían en la base ` +
        `compartida con Life OS. Copia .env.test.example a .env.test.`
    );
  }

  if (!ALLOWED_SUPABASE_URLS.includes(valor)) {
    throw new Error(
      `[guarda e2e · ${origen}] VITE_SUPABASE_URL = "${valor}" NO está en la ` +
        `lista blanca. Valores permitidos: ${ALLOWED_SUPABASE_URLS.join(', ')}. ` +
        `Se aborta antes de arrancar nada.`
    );
  }
}

/**
 * Exige que la clave anónima esté presente.
 *
 * Sin ella el cliente cae a la clave literal de producción, así que una URL
 * local con la clave ausente sigue siendo peligrosa.
 */
export function exigirClavePresente(valor: string | undefined, origen: string): void {
  if (!valor) {
    throw new Error(
      `[guarda e2e · ${origen}] VITE_SUPABASE_ANON_KEY no está definida. ` +
        `Sin ella el cliente usa la clave literal de PRODUCCIÓN. Se aborta.`
    );
  }
}
