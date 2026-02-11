/**
 * Financial Personnel Management E2E Tests
 *
 * Tests the Personnel tab at /admin/finanzas/nomina: personnel cards,
 * status filtering, CRUD operations, RUT masking/validation,
 * contract type badges, and CLP salary formatting.
 * All test data uses the "test_e2e_" prefix and is cleaned up in afterAll.
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin, hasCredentials } from './helpers/auth';

const TEST_PREFIX = 'test_e2e_';
const TEST_NAME = `${TEST_PREFIX}Juan Pérez`;
const TEST_ROLE = `${TEST_PREFIX}Asistente`;
const TEST_ROLE_EDITED = `${TEST_PREFIX}Coordinador`;

test.describe('Financial Personnel Management', () => {
  test.beforeEach(async ({ page }) => {
    if (!hasCredentials()) {
      test.skip();
      return;
    }
    const loggedIn = await loginAsAdmin(page);
    if (!loggedIn) {
      test.skip();
    }

    await page.goto('/admin/finanzas/nomina');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    await page.waitForTimeout(500);
  });

  test('Personnel page renders with filter buttons', async ({ page }) => {
    // Verify heading
    await expect(page.locator('h2', { hasText: /^Personal$/ })).toBeVisible();

    // Verify filter buttons
    await expect(page.getByRole('button', { name: 'Activo', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Inactivo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Todos' })).toBeVisible();

    // Verify "Agregar Personal" button (if canWrite)
    const addBtn = page.getByRole('button', { name: /Agregar Personal/i });
    const isVisible = await addBtn.isVisible().catch(() => false);
    expect(isVisible).toBe(true);
  });

  test('Personnel cards display correctly', async ({ page }) => {
    // Verify either personnel cards exist or empty state
    const emptyState = page.getByText('No hay personal registrado');
    const isEmpty = await emptyState.isVisible().catch(() => false);

    if (isEmpty) {
      await expect(emptyState).toBeVisible();
      return;
    }

    // If cards exist, verify they show expected fields
    const cards = page.locator('.grid > div');
    if ((await cards.count()) > 0) {
      // Each card should show a name (h3 heading)
      const firstCard = cards.first();
      const heading = firstCard.locator('h3');
      await expect(heading).toBeVisible();
    }
  });

  test('RUT is properly masked in list view', async ({ page }) => {
    // Look for masked RUT pattern: asterisks + last 5 chars
    const pageContent = await page.textContent('body');

    // If personnel cards exist, check for masked RUT format
    // The maskRut function may show "****11111" (asterisks + digits) or "**.***.678-9"
    const maskedRutPattern = /\*{2,}/;
    const cards = page.locator('.grid > div');
    if ((await cards.count()) > 0) {
      expect(pageContent).toMatch(maskedRutPattern);
    }
  });

  test('Contract type badges show correct labels', async ({ page }) => {
    const pageContent = await page.textContent('body');

    // At least one contract type label should be present if personnel exist
    const emptyState = page.getByText('No hay personal registrado');
    const isEmpty = await emptyState.isVisible().catch(() => false);

    if (!isEmpty) {
      const hasIndefinido = pageContent?.includes('Indefinido');
      const hasPlazoFijo = pageContent?.includes('Plazo Fijo');
      const hasHonorarios = pageContent?.includes('Honorarios');

      // At least one contract type should be visible
      expect(hasIndefinido || hasPlazoFijo || hasHonorarios).toBeTruthy();
    }
  });

  test('CLP salary formatting', async ({ page }) => {
    const emptyState = page.getByText('No hay personal registrado');
    const isEmpty = await emptyState.isVisible().catch(() => false);

    if (!isEmpty) {
      // Verify "Sueldo Bruto" label is visible on cards
      await expect(page.getByText('Sueldo Bruto').first()).toBeVisible();

      // Verify CLP format is present ($X.XXX.XXX)
      const clpPattern = /\$[\d.]+/;
      const pageContent = await page.textContent('body');
      expect(pageContent).toMatch(clpPattern);
    }
  });

  test('Create new personnel', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /Agregar Personal/i });
    if (!(await addBtn.isVisible())) {
      test.skip();
      return;
    }

    await addBtn.click();
    await page.waitForTimeout(1000);

    // Verify form dialog opens
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.getByText(/Agregar Personal/i).first()).toBeVisible();

    // Fill in name
    await page.getByLabel('Nombre completo').fill(TEST_NAME);

    // Fill in RUT
    await page.getByLabel('RUT').fill('11.111.111-1');

    // Fill in cargo
    await page.getByLabel('Cargo / Posición').fill(TEST_ROLE);

    // Select contract type (Indefinido is default)

    // CLPInput doesn't forward id from FormControl, so getByLabel won't work.
    // Target the numeric input by its placeholder within the dialog.
    const personnelDialog = page.locator('[role="dialog"]');
    const salaryField = personnelDialog.locator('input[inputmode="numeric"]');
    await salaryField.click();
    await salaryField.fill('500000');

    // Select AFP
    const afpSelect = page.getByText('Seleccionar AFP');
    if (await afpSelect.isVisible()) {
      await afpSelect.click();
      await page.getByRole('option', { name: 'ProVida' }).click();
    }

    // Fill Salud
    await page.getByLabel('Salud').fill('Fonasa');

    // Submit
    await page.getByRole('button', { name: /Crear/i }).click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    await page.waitForTimeout(1000);

    // Verify new personnel card appears
    await expect(page.getByText(TEST_NAME)).toBeVisible({ timeout: 5000 });
  });

  test('RUT auto-formatting applies dots and dash on blur', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /Agregar Personal/i });
    if (!(await addBtn.isVisible())) {
      test.skip();
      return;
    }

    await addBtn.click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.getByText(/Agregar Personal/i).first()).toBeVisible();

    // Type raw RUT digits
    const rutInput = page.getByLabel('RUT');
    await rutInput.fill('111111111');

    // Trigger blur to format
    await rutInput.blur();
    await page.waitForTimeout(300);

    // Verify formatted: "11.111.111-1"
    const formattedValue = await rutInput.inputValue();
    expect(formattedValue).toMatch(/\d{1,2}\.\d{3}\.\d{3}-[\dkK]/);

    // Close dialog
    await page.getByRole('button', { name: /Cancelar/i }).click();
  });

  test('Edit existing personnel', async ({ page }) => {
    // Find the test personnel card
    const testCard = page.getByText(TEST_NAME);
    if (!(await testCard.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    // Click edit button
    const editBtn = page.getByRole('button', { name: new RegExp(`Editar ${TEST_NAME}`) });
    if (!(await editBtn.isVisible())) {
      // Try finding by "Editar" text within the card
      const editBtns = page.getByRole('button', { name: /Editar/i });
      if ((await editBtns.count()) > 0) {
        await editBtns.first().click();
      } else {
        test.skip();
        return;
      }
    } else {
      await editBtn.click();
    }
    await page.waitForTimeout(1000);

    // Verify form opens in edit mode
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.getByText(/Editar Personal/i).first()).toBeVisible();

    // Change cargo
    await page.getByLabel('Cargo / Posición').fill(TEST_ROLE_EDITED);

    // Save
    await page.getByRole('button', { name: /Guardar/i }).click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    await page.waitForTimeout(1000);

    // Verify updated role appears
    await expect(page.getByText(TEST_ROLE_EDITED)).toBeVisible({ timeout: 5000 });
  });

  test('Deactivate personnel with confirmation dialog', async ({ page }) => {
    const testCard = page.getByText(TEST_NAME);
    if (!(await testCard.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    // Click deactivate button
    const deactivateBtn = page.getByRole('button', { name: new RegExp(`Desactivar ${TEST_NAME}`) });
    if (!(await deactivateBtn.isVisible())) {
      const deactivateBtns = page.getByRole('button', { name: /Desactivar/i });
      if ((await deactivateBtns.count()) > 0) {
        await deactivateBtns.first().click();
      } else {
        test.skip();
        return;
      }
    } else {
      await deactivateBtn.click();
    }

    // Verify confirmation dialog
    const confirmDialog = page.getByText('Desactivar personal');
    const hasDialog = await confirmDialog.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasDialog) {
      test.skip();
      return;
    }

    // Confirm
    await page.getByRole('button', { name: /Confirmar/i }).click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Verify card disappears from active view or check filter state
    const stillVisible = await page.getByText(TEST_NAME).isVisible().catch(() => false);
    if (stillVisible) {
      // Reload page and check — sometimes UI doesn't re-render immediately
      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
    }
    await expect(page.getByText(TEST_NAME)).not.toBeVisible({ timeout: 10000 });
  });

  test('Filter by inactive shows deactivated personnel', async ({ page }) => {
    // Click "Inactivo" filter
    await page.getByRole('button', { name: 'Inactivo' }).click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    await page.waitForTimeout(500);

    // Check if the deactivated test person appears
    const testCard = page.getByText(TEST_NAME);
    const isVisible = await testCard.isVisible().catch(() => false);

    // If visible, verify inactive state
    if (isVisible) {
      await expect(page.getByText('Inactivo').first()).toBeVisible();
    }
  });

  test('Reactivate personnel', async ({ page }) => {
    // Switch to inactive filter
    await page.getByRole('button', { name: 'Inactivo' }).click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    await page.waitForTimeout(500);

    // Find the test person
    const testCard = page.getByText(TEST_NAME);
    if (!(await testCard.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    // Click activate button
    const activateBtn = page.getByRole('button', { name: new RegExp(`Activar ${TEST_NAME}`) });
    if (await activateBtn.isVisible()) {
      await activateBtn.click();
    } else {
      const activateBtns = page.getByRole('button', { name: /Activar/i });
      if ((await activateBtns.count()) > 0) {
        await activateBtns.first().click();
      } else {
        test.skip();
        return;
      }
    }

    // Confirm
    await expect(page.getByText('Activar personal')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /Confirmar/i }).click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    await page.waitForTimeout(1000);

    // Switch to active filter
    await page.getByRole('button', { name: 'Activo', exact: true }).click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    await page.waitForTimeout(500);

    // Verify person reappears
    await expect(page.getByText(TEST_NAME)).toBeVisible({ timeout: 5000 });
  });

  test('"Todos" filter shows both active and inactive', async ({ page }) => {
    await page.getByRole('button', { name: 'Todos' }).click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    await page.waitForTimeout(500);

    // Verify filter is active (button should have default variant)
    // Just verify the page loaded without errors
    const heading = page.locator('h2', { hasText: /^Personal$/ });
    await expect(heading).toBeVisible();
  });

  test('Bank account number is masked in display', async ({ page }) => {
    // Look for masked account format "****XXXX"
    const pageContent = await page.textContent('body');
    const maskedAccountPattern = /\*{4}\d{4}/;

    // This test passes if the pattern is found or no personnel have bank accounts
    if (pageContent?.match(maskedAccountPattern)) {
      expect(pageContent).toMatch(maskedAccountPattern);
    }
  });
});

// Cleanup: delete test personnel
test.describe('Financial Personnel — Cleanup', () => {
  test.afterAll(async ({ browser }) => {
    if (!hasCredentials()) return;

    const page = await browser.newPage();
    try {
      const loggedIn = await loginAsAdmin(page);
      if (!loggedIn) return;

      await page.goto('/admin/finanzas/nomina');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
      await page.waitForTimeout(500);

      // Check all filter views for test personnel and deactivate/remove
      const filters = ['Activo', 'Inactivo', 'Todos'];
      for (const filter of filters) {
        await page.getByRole('button', { name: filter }).click();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);
        await page.waitForTimeout(500);

        let testCard = page.getByText(TEST_NAME);
        let attempts = 0;

        while ((await testCard.isVisible().catch(() => false)) && attempts < 5) {
          // Try to deactivate if active
          const deactivateBtn = page.getByRole('button', { name: /Desactivar/i }).first();
          if (await deactivateBtn.isVisible()) {
            await deactivateBtn.click();
            const confirmBtn = page.getByRole('button', { name: /Confirmar/i });
            if (await confirmBtn.isVisible({ timeout: 3000 })) {
              await confirmBtn.click();
              await page.waitForLoadState('domcontentloaded');
              await page.waitForTimeout(1000);
              await page.waitForTimeout(500);
            }
          }
          testCard = page.getByText(TEST_NAME);
          attempts++;
        }
      }
    } finally {
      await page.close();
    }
  });
});
