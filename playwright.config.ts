import { defineConfig, devices } from '@playwright/test';
import { resolve, dirname } from 'path';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import {
  TEST_PORT,
  TEST_BASE_URL,
  exigirUrlLocal,
  exigirClavePresente,
} from './tests/e2e/helpers/guard';

// Load .env.test so TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD are available
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = resolve(__dirname, '.env.test');
// `E2E_NO_ENV_FILE=1` salta esta carga. Existe para poder probar la guarda:
// con `.env.test` presente —que esta fase exige— un `env -u VITE_SUPABASE_URL`
// se rellena solo desde el fichero y el caso de mutación no puede fallar.
const saltarFicheroEnv = process.env.E2E_NO_ENV_FILE === '1';
if (!saltarFicheroEnv && existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GUARDA ANTI-PRODUCCIÓN · CAPA 1 — entorno del proceso
//
// Corre al cargar la configuración, o sea ANTES de que `webServer` lance nada y
// antes de que Playwright resuelva un solo test. Es necesaria y no suficiente:
// comprueba "mis variables están bien", no "el servidor al que apunto está
// bien". Eso lo hace la capa 3 en `tests/e2e/global-setup.ts`.
// ─────────────────────────────────────────────────────────────────────────────
exigirUrlLocal(process.env.VITE_SUPABASE_URL, 'capa 1');
exigirClavePresente(process.env.VITE_SUPABASE_ANON_KEY, 'capa 1');

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: TEST_BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // GUARDA ANTI-PRODUCCIÓN · CAPA 2 — cerrar la reutilización de servidor.
  //
  // `reuseExistingServer: false` SIEMPRE, no `!process.env.CI`: con el valor
  // anterior, un `npm run dev` productivo escuchando en el puerto se reutilizaba
  // en silencio y la suite corría contra producción sin avisar.
  //
  // `--strictPort` es obligatorio: `vite.config.ts` no lo declara, así que sin
  // él vite se muda al siguiente puerto libre sin decir nada y `webServer`
  // acabaría hablando con un servidor distinto del que arrancó.
  webServer: {
    command: `npm run dev -- --port ${TEST_PORT} --strictPort`,
    url: TEST_BASE_URL,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
