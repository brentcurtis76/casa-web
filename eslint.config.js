import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".claude/worktrees/**", "**/*\\ 2.ts", "**/*\\ 2.tsx"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // Date-suffixed Claude model IDs are time bombs: they keep working right
    // up until the model's retirement date, then start returning 404 with no
    // code change. claude-sonnet-4-20250514 took down process-reflexion-pdf
    // this way. Pin bare aliases so this fails the lint gate, not production.
    // Matches string literals only, so the explanatory comments citing the
    // retired IDs are unaffected.
    files: ["supabase/functions/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/^claude-.+-\\d{8}$/]",
          message:
            "Date-suffixed Claude model ID. Use the bare alias (e.g. 'claude-opus-5', 'claude-sonnet-5') — a dated ID 404s silently the day that model retires.",
        },
      ],
    },
  }
);
