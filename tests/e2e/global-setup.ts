/**
 * GUARDA ANTI-PRODUCCIÓN · CAPA 3 — comprobar el SERVIDOR REAL.
 *
 * Es la única capa que distingue «mis variables están bien» de «el servidor al
 * que apunto está bien». Playwright ejecuta `globalSetup` DESPUÉS de levantar
 * `webServer` y ANTES de cualquier test, que es exactamente la ventana que hace
 * falta (medido en §S5.3 de `docs/plan/audio/evidence/E-infra-spike.md`).
 *
 * CÓMO SE LEE LA URL HORNEADA, y por qué no de la forma obvia:
 *
 *   const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://…";
 *
 * Esa línea es TEXTO FUENTE. Sale idéntica apunte el servidor a donde apunte,
 * así que leerla no prueba nada — fue el error de la r1 del spike. Lo que sí
 * cambia es el objeto `import.meta.env` que Vite antepone al módulo servido:
 * contra el servidor de test trae `VITE_SUPABASE_URL`, y contra un servidor
 * arrancado sin las variables no la trae y el cliente cae al literal de
 * producción.
 */

import type { FullConfig } from '@playwright/test';
import {
  TEST_BASE_URL,
  exigirUrlLocal,
  exigirClavePresente,
} from './helpers/guard';

/** Módulo que importa el cliente de Supabase; es el que lleva la URL horneada. */
const MODULO_CLIENTE = '/src/integrations/supabase/client.ts';

/**
 * Extrae el objeto que Vite inyecta como `import.meta.env` en el módulo servido.
 *
 * Vite lo emite como una asignación literal al principio del módulo. Se acota la
 * captura a la primera llave de cierre seguida de `;` para no tragarse el resto
 * del fichero si hubiera más de una asignación.
 */
function extraerImportMetaEnv(fuente: string): Record<string, unknown> {
  const m = fuente.match(/import\.meta\.env\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (!m) {
    throw new Error(
      `[guarda e2e · capa 3] No se encontró la inyección de \`import.meta.env\` en ` +
        `${MODULO_CLIENTE}. Sin ella no se puede saber a qué base apunta el servidor, ` +
        `así que se aborta en vez de suponer que es local.`
    );
  }

  try {
    return JSON.parse(m[1]) as Record<string, unknown>;
  } catch (e) {
    throw new Error(
      `[guarda e2e · capa 3] La inyección de \`import.meta.env\` no es JSON válido: ` +
        `${(e as Error).message}. Se aborta.`
    );
  }
}

async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use?.baseURL ?? TEST_BASE_URL;
  const url = `${baseURL}${MODULO_CLIENTE}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `[guarda e2e · capa 3] GET ${url} devolvió HTTP ${res.status}. ` +
        `No se puede verificar a qué base apunta el servidor, así que se aborta.`
    );
  }

  const env = extraerImportMetaEnv(await res.text());
  const urlHorneada = env.VITE_SUPABASE_URL as string | undefined;
  const claveHorneada = env.VITE_SUPABASE_ANON_KEY as string | undefined;

  exigirUrlLocal(urlHorneada, 'capa 3 · servidor real');
  exigirClavePresente(claveHorneada, 'capa 3 · servidor real');

  console.log(`[guarda e2e · capa 3] servidor ${baseURL} responde HTTP ${res.status}`);
  console.log(`[guarda e2e · capa 3] VITE_SUPABASE_URL horneada = "${urlHorneada}"`);
  console.log(`[guarda e2e · capa 3] VITE_SUPABASE_ANON_KEY presente = true`);
}

export default globalSetup;
