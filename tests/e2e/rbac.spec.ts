/**
 * RBAC E2E Tests — Role & Permission Editor
 *
 * Tests the /admin/roles page, role CRUD, permission matrix, and admin access controls.
 * Auth: Uses the app's login form with env vars TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD.
 * Test data: Prefixed with "test_" and cleaned up in afterAll.
 */

import { test, expect, type Page } from '@playwright/test';

const TEST_ROLE_PREFIX = 'test_e2e_';
const TEST_ROLE_DISPLAY = `${TEST_ROLE_PREFIX}Rol Prueba`;

// Helper: login via the app's own login form
async function loginAsAdmin(page: Page) {
  const email = process.env.TEST_ADMIN_EMAIL;
  const password = process.env.TEST_ADMIN_PASSWORD;

  if (!email || !password) {
    return false;
  }

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Look for the login button/link to open auth UI
  // The app may show a login form directly or require clicking a button first
  const emailInput = page.getByPlaceholder('tuemail@ejemplo.com');
  const passwordInput = page.getByPlaceholder('******');

  // Wait for inputs to appear (login form may need a moment)
  try {
    await emailInput.first().waitFor({ timeout: 5000 });
  } catch {
    // Try clicking a login/sign-in button first
    const loginBtn = page.getByRole('button', { name: /Iniciar Sesión|Ingresar|Login/i });
    if (await loginBtn.count() > 0) {
      await loginBtn.first().click();
      await emailInput.first().waitFor({ timeout: 5000 });
    } else {
      return false;
    }
  }

  await emailInput.first().fill(email);
  await passwordInput.first().fill(password);

  const submitBtn = page.getByRole('button', { name: /Iniciar Sesión/i });
  await submitBtn.first().click();

  // Wait for navigation/auth to complete
  await page.waitForLoadState('networkidle');
  // Give auth state a moment to propagate
  await page.waitForTimeout(1000);

  return true;
}

test.describe('RBAC - Unauthenticated', () => {
  test('/admin/roles redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForLoadState('networkidle');

    // Should redirect away from /admin/roles (to /admin or / with access denied)
    const url = page.url();
    expect(url).not.toContain('/admin/roles');
  });
});

test.describe('RBAC - Admin Role Management', () => {
  const hasCredentials = !!(process.env.TEST_ADMIN_EMAIL && process.env.TEST_ADMIN_PASSWORD);

  // Skip all authenticated tests if no credentials
  test.beforeEach(async ({ page }) => {
    if (!hasCredentials) {
      test.skip();
      return;
    }

    const loggedIn = await loginAsAdmin(page);
    if (!loggedIn) {
      test.skip();
    }
  });

  test('/admin/roles loads and displays seeded roles for admin user', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForLoadState('networkidle');

    // Page title should be visible
    await expect(page.getByRole('heading', { name: 'Gestión de Roles' })).toBeVisible();

    // Should show "Crear Rol" button
    await expect(page.getByRole('button', { name: /Crear Rol/i })).toBeVisible();

    // Should display the general_admin role
    await expect(page.getByText('general_admin')).toBeVisible();

    // Should show "Sistema" badge for system roles
    await expect(page.getByText('Sistema').first()).toBeVisible();
  });

  test('Admin can open "Crear Rol" dialog and create a custom role', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForLoadState('networkidle');

    // Click "Crear Rol"
    await page.getByRole('button', { name: /Crear Rol/i }).click();

    // Dialog should open
    await expect(page.getByRole('heading', { name: 'Crear Rol' })).toBeVisible();

    // Fill in the form
    await page.getByLabel('Nombre para mostrar *').fill(TEST_ROLE_DISPLAY);

    // The slug should auto-generate
    const slugInput = page.getByLabel('Identificador');
    await expect(slugInput).toHaveValue(/test_e2e_/);

    // Add a description
    await page.getByLabel('Descripción').fill('Rol de prueba E2E - se elimina automáticamente');

    // Submit
    await page.getByRole('button', { name: /Crear rol/i }).click();

    // Wait for toast confirmation
    await page.waitForLoadState('networkidle');

    // The new role should appear in the table (scope to table row to avoid matching toast)
    await expect(
      page.getByRole('row').filter({ hasText: TEST_ROLE_DISPLAY })
    ).toBeVisible({ timeout: 5000 });
  });

  test('Admin can edit a custom role', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForLoadState('networkidle');

    // Find the test role row and click "Editar"
    const roleRow = page.getByRole('row').filter({ hasText: TEST_ROLE_DISPLAY });

    // If the test role doesn't exist, skip
    if ((await roleRow.count()) === 0) {
      test.skip();
      return;
    }

    await roleRow.getByRole('button', { name: /Editar/i }).click();

    // Dialog should open in edit mode
    await expect(page.getByText('Editar Rol')).toBeVisible();

    // The slug field should be read-only
    const slugInput = page.getByLabel('Identificador');
    await expect(slugInput).toBeDisabled();

    // Close without saving
    await page.getByRole('button', { name: /Cancelar/i }).click();
  });

  test('Admin can open permission matrix', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForLoadState('networkidle');

    // Click "Permisos" on the first system role
    const firstRow = page.getByRole('row').filter({ hasText: 'Sistema' }).first();
    await firstRow.getByRole('button', { name: /Permisos/i }).click();

    // Permission matrix dialog should open
    await expect(page.getByText('Permisos:')).toBeVisible({ timeout: 5000 });

    // Scope checks to the permission matrix dialog
    const dialog = page.getByRole('dialog');

    // Should show resource names in Spanish
    await expect(dialog.getByText('Presentador', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Eventos', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Mesa Abierta', { exact: true })).toBeVisible();

    // Should show action column headers
    await expect(dialog.getByText('Leer')).toBeVisible();
    await expect(dialog.getByText('Escribir')).toBeVisible();
    await expect(dialog.getByText('Administrar')).toBeVisible();
  });

  test('System roles show "Sistema" badge and delete is disabled', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForLoadState('networkidle');

    // Find a system role row (general_admin)
    const adminRow = page.getByRole('row').filter({ hasText: 'general_admin' });
    await expect(adminRow).toBeVisible();

    // Should have "Sistema" badge
    await expect(adminRow.getByText('Sistema')).toBeVisible();

    // Delete button should be disabled
    const deleteBtn = adminRow.getByRole('button', { name: /Eliminar/i });
    await expect(deleteBtn).toBeDisabled();
  });

  test('Admin can delete a custom role with zero users', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForLoadState('networkidle');

    // Find the test role
    const roleRow = page.getByRole('row').filter({ hasText: TEST_ROLE_DISPLAY });

    if ((await roleRow.count()) === 0) {
      test.skip();
      return;
    }

    // Click "Eliminar"
    await roleRow.getByRole('button', { name: /Eliminar/i }).click();

    // Confirmation dialog should appear
    await expect(page.getByText('Confirmar eliminación')).toBeVisible();

    // Confirm deletion
    await page.getByRole('button', { name: /Eliminar rol/i }).click();

    // Wait for the role to disappear
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('row').filter({ hasText: TEST_ROLE_DISPLAY })).toHaveCount(0, {
      timeout: 5000,
    });
  });

  test('/admin/users loads and shows user list', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    // Should show the user management page
    await expect(page.getByRole('heading', { name: 'Gestión de Usuarios' })).toBeVisible();

    // Should have a search input
    await expect(page.getByPlaceholder(/Buscar por nombre/i)).toBeVisible();

    // Should show at least one user row
    const tableRows = page.getByRole('row');
    expect(await tableRows.count()).toBeGreaterThan(1); // header + at least 1 data row
  });
});

// Cleanup: delete any test roles that may have been left behind
test.describe('RBAC - Cleanup', () => {
  test.afterAll(async ({ browser }) => {
    // Only attempt cleanup if credentials are available
    if (!process.env.TEST_ADMIN_EMAIL || !process.env.TEST_ADMIN_PASSWORD) {
      return;
    }

    const page = await browser.newPage();
    try {
      const loggedIn = await loginAsAdmin(page);
      if (!loggedIn) return;

      await page.goto('/admin/roles');
      await page.waitForLoadState('networkidle');

      // Look for any remaining test roles and delete them
      let testRow = page.getByRole('row').filter({ hasText: TEST_ROLE_PREFIX });
      let attempts = 0;

      while ((await testRow.count()) > 0 && attempts < 5) {
        const deleteBtn = testRow.first().getByRole('button', { name: /Eliminar/i });
        if (await deleteBtn.isEnabled()) {
          await deleteBtn.click();
          // Confirm deletion
          const confirmBtn = page.getByRole('button', { name: /Eliminar rol/i });
          if (await confirmBtn.isVisible()) {
            await confirmBtn.click();
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(500);
          }
        } else {
          break;
        }
        testRow = page.getByRole('row').filter({ hasText: TEST_ROLE_PREFIX });
        attempts++;
      }
    } finally {
      await page.close();
    }
  });
});
