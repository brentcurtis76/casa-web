# Playwright CLI Skill

> Interactive browser automation via `playwright-cli` for E2E test generation and exploratory testing.

## When to Use This Skill

**Use Playwright CLI** when you need to:
- Explore an unfamiliar UI flow before writing a test
- Capture element references (refs) from a live app to generate selectors
- Take screenshots at specific UI states for documentation or debugging
- Verify a feature works end-to-end in a running dev server

**Use the standard Playwright test runner** (`npm run test:e2e` / `npm run e2e`) when you need to:
- Run the full regression suite
- Run CI quality gates
- Execute existing `.spec.ts` files

---

## CLI Command Reference

All commands use the `playwright-cli` binary (installed globally via `npm i -g @playwright/cli`).

| Command | Description |
|---|---|
| `playwright-cli open <url>` | Open browser and navigate to URL |
| `playwright-cli goto <url>` | Navigate to a URL in the open browser |
| `playwright-cli snapshot` | Output YAML accessibility snapshot of current page |
| `playwright-cli snapshot --filename <file>` | Save snapshot YAML to a file |
| `playwright-cli click <ref>` | Click element by ref (e.g. `e21`) |
| `playwright-cli fill <ref> <value>` | Fill input field by ref |
| `playwright-cli type <ref> <value>` | Type keystroke-by-keystroke into element |
| `playwright-cli screenshot --filename <file>` | Save screenshot to file |
| `playwright-cli close` | Close the browser session |

---

## YAML Snapshot Format

`playwright-cli snapshot` outputs an accessibility tree in YAML. Elements with interactive roles get an `ref` field you can use with `click`, `fill`, etc.

```yaml
- role: document
  name: Dashboard
  children:
    - role: navigation
      children:
        - role: link
          name: Usuarios
          ref: e12
        - role: link
          name: Clases
          ref: e15
    - role: main
      children:
        - role: heading
          name: Dashboard
          level: 1
        - role: textbox
          name: Email
          ref: e21
          value: ""
        - role: textbox
          name: Contraseña
          ref: e24
          value: ""
        - role: button
          name: Iniciar Sesión
          ref: e35
```

**Key fields:**
- `ref` — the handle to pass to `click`, `fill`, `type` (only on interactive elements)
- `role` — ARIA role (button, textbox, link, heading, checkbox, etc.)
- `name` — accessible name (label text, button text, aria-label)
- `value` — current value of inputs
- `level` — heading level (h1=1, h2=2, ...)

---

## Python Wrapper

`~/SecondBrain/pipeline/agents/tools/playwright_cli.py` wraps these commands for the QA agent.

```python
from playwright_cli import open_app, goto, snapshot, click, fill, screenshot, close, find_ref

# Open the app
open_app("http://localhost:8080")

# Snapshot → get element refs
s = snapshot()
# s["elements"] = list of dicts: {ref, role, name, ...}
# s["refs"]     = dict: {"e21": {role, name}, ...}

# Find a ref by role/name/placeholder
email_ref = find_ref(s["elements"], role="textbox", name="email")
btn_ref   = find_ref(s["elements"], role="button",  name="iniciar")

# Interact
fill(email_ref, "admin@example.com")
click(btn_ref)

# Take a screenshot
screenshot("/tmp/after-login.png")

# Navigate
goto("/admin/users")

# Done
close()
```

---

## CASA Integration

- **Base URL:** `http://localhost:8080`
- **Auth:** Use `loginAsAdmin()` from `tests/e2e/helpers/auth.ts`
- **UI language:** Spanish — match Spanish labels in `find_ref` calls
- **Test data:** Prefix with `test_e2e_` (e.g. `test_e2e_user@test.com`)
- **Cleanup:** `afterAll()` must delete all `test_e2e_` records

**Typical EXPLORE flow for CASA:**
```python
open_app("http://localhost:8080")

# Login
s = snapshot()
fill(find_ref(s["elements"], placeholder="tuemail"), "admin@casa.cl")
fill(find_ref(s["elements"], placeholder="******"), os.environ["TEST_ADMIN_PASSWORD"])
click(find_ref(s["elements"], role="button", name="Iniciar"))

# Navigate to feature
goto("/mesa-abierta")
s2 = snapshot()
screenshot("/tmp/mesa-abierta.png")

# Inspect elements to discover refs for the spec
for el in s2["elements"]:
    print(el)

close()
```

**Generated spec pattern:**
```typescript
import { test, expect } from '@playwright/test';
import { loginAsAdmin, hasCredentials } from '../helpers/auth';

test.describe('Mesa Abierta', () => {
  test.beforeEach(async ({ page }) => {
    if (!hasCredentials()) test.skip();
    await loginAsAdmin(page);
  });

  test('shows signup form', async ({ page }) => {
    await page.goto('/mesa-abierta');
    await expect(page.getByRole('heading', { name: 'Mesa Abierta' })).toBeVisible();
    await expect(page.getByRole('button', { name: /inscribirse/i })).toBeVisible();
  });

  test.afterAll(async () => {
    // Clean up test_e2e_ data
  });
});
```

---

## GENERA Integration

- **Base URL:** `http://localhost:3000`
- **Dev server:** `npm run dev:unsafe` (auto-started by `playwright.config.ts`)
- **Tests location:** `tests/e2e/`
- **Auth:** Unauthenticated requests redirect to `/login`
- **Session reuse:** Use `storageState` for tests that need an authenticated session

**Typical EXPLORE flow for GENERA:**
```python
open_app("http://localhost:3000")

# Check auth redirect
goto("/dashboard")
s = snapshot()
# Should see login form if not authenticated

fill(find_ref(s["elements"], role="textbox", name="email"), "docente@fne.cl")
fill(find_ref(s["elements"], role="textbox", name="contraseña"), os.environ["TEST_PASSWORD"])
click(find_ref(s["elements"], role="button", name="ingresar"))

goto("/cursos")
s2 = snapshot()
screenshot("/tmp/cursos-list.png")

for el in s2["elements"]:
    print(el)

close()
```

**Generated spec pattern:**
```typescript
import { test, expect } from '@playwright/test';

test.describe('Cursos', () => {
  test('unauthenticated redirects to login', async ({ page }) => {
    await page.goto('/cursos');
    await expect(page).toHaveURL(/\/login/);
  });

  test('docente can view their courses', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('textbox', { name: /email/i }).fill(process.env.TEST_EMAIL!);
    await page.getByRole('textbox', { name: /contraseña/i }).fill(process.env.TEST_PASSWORD!);
    await page.getByRole('button', { name: /ingresar/i }).click();
    await page.goto('/cursos');
    await expect(page.getByRole('heading', { name: 'Mis Cursos' })).toBeVisible();
  });
});
```

---

## Selector Priority (both projects)

Always prefer selectors in this order:

1. `page.getByRole('button', { name: 'Submit' })` — most resilient, uses ARIA
2. `page.getByText('Texto visible')` — for non-interactive text assertions
3. `page.getByPlaceholder('tuemail@ejemplo.com')` — for inputs with placeholder text
4. `page.getByLabel('Campo')` — for inputs with associated labels
5. `page.locator('[data-testid="foo"]')` — only if `data-testid` already exists in source

**Never** use `nth-child` selectors or CSS class selectors — they break on refactors.
