import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { componentTagger } from "lovable-tagger";
import { supabaseBrowserEnvGuard } from "./scripts/security/vite-supabase-env-guard.ts";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    // Must stay first: aborts `vite dev` / `vite build` before any browser asset
    // is transformed or emitted when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
    // are missing, point at a project other than CASA, or hold a privileged key.
    supabaseBrowserEnvGuard(loadEnv(mode, process.cwd(), "VITE_")),
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
}));
