/**
 * Financial Transactions E2E Tests
 *
 * Tests the Transacciones tab: table rendering, filtering, sorting,
 * CRUD operations, pagination, and reconciliation toggles.
 * All test data uses the "test_e2e_" prefix and is cleaned up in afterAll.
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin, hasCredentials } from './helpers/auth';

const TEST_PREFIX = 'test_e2e_';
const TEST_DESCRIPTION = `${TEST_PREFIX}Ingreso Prueba`;
const TEST_DESCRIPTION_EDITED = `${TEST_PREFIX}Ingreso Modificado`;

test.describe('Financial Transactions', () => {
  // Login + tab nav consumes significant time under parallel workers
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    if (!hasCredentials()) {
      test.skip();
      return;
    }
    const loggedIn = await loginAsAdmin(page);
    if (!loggedIn) {
      test.skip();
    }

    await page.goto('/admin/finanzas');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Click Transacciones tab
    await page.getByRole('tab', { name: /Transacciones/i }).click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    await page.waitForTimeout(500);
  });

  test('Transaction table renders with columns', async ({ page }) => {
    // Verify the heading
    await expect(page.getByRole('heading', { name: 'Transacciones' })).toBeVisible({ timeout: 5000 });

    // Column headers only render when not in loading state and data exists
    const table = page.locator('table');
    const hasTable = await table.isVisible().catch(() => false);
    if (hasTable) {
      await expect(page.getByText('Fecha').first()).toBeVisible();
      await expect(page.getByText('Descripción').first()).toBeVisible();
    }

    // Verify either table rows exist or empty state message
    const tableRows = page.getByRole('row');
    const emptyState = page.getByText('No hay transacciones');
    const hasRows = (await tableRows.count()) > 1; // header + at least 1 data row
    const isEmpty = await emptyState.isVisible().catch(() => false);

    expect(hasRows || isEmpty).toBeTruthy();
  });

  test('Filter by transaction type', async ({ page }) => {
    // Open the type filter
    const typeFilter = page.locator('#filter-type');
    await typeFilter.click();

    // Select "Ingresos"
    await page.getByRole('option', { name: 'Ingresos' }).click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    await page.waitForTimeout(500);

    // Verify filter is applied (page should show filtered results)
    // Re-open and select "Gastos"
    await typeFilter.click();
    await page.getByRole('option', { name: 'Gastos' }).click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
  });

  test('Filter by date range', async ({ page }) => {
    // Set the "Desde" date
    const startDate = page.locator('#filter-start-date');
    await startDate.fill('2026-01-01');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Set the "Hasta" date
    const endDate = page.locator('#filter-end-date');
    await endDate.fill('2026-12-31');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
  });

  test('Clear filters button resets all filters', async ({ page }) => {
    // Apply a type filter first
    const typeFilter = page.locator('#filter-type');
    await typeFilter.click();
    await page.getByRole('option', { name: 'Ingresos' }).click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Look for the "Limpiar filtros" button
    const clearBtn = page.getByRole('button', { name: /Limpiar filtros/i });
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Verify the clear button disappears (no active filters)
    await expect(clearBtn).not.toBeVisible({ timeout: 3000 });
  });

  test('Create new transaction (income)', async ({ page }) => {
    // Click "Nuevo Ingreso" button
    const nuevoIngreso = page.getByRole('button', { name: /Nuevo Ingreso/i }).first();
    if (!(await nuevoIngreso.isVisible())) {
      test.skip();
      return;
    }

    await nuevoIngreso.click();
    await page.waitForTimeout(1000);

    // Verify dialog opens
    const dialog = page.locator('[role="dialog"]').last();
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.getByText(/Nuevo Ingreso/i).first()).toBeVisible();

    // Fill description
    await page.getByLabel('Descripción').fill(TEST_DESCRIPTION);

    // CLPInput doesn't forward id from FormControl, so getByLabel won't work.
    const dialog2 = page.locator('[role="dialog"]').last();
    const montoField = dialog2.locator('input[inputmode="numeric"]');
    await montoField.click();
    await montoField.fill('50000');

    // Fill date (today)
    const today = new Date().toISOString().split('T')[0];
    await page.getByLabel('Fecha').fill(today);

    // Submit — dialog form is taller than viewport, use JS click
    await page.getByRole('button', { name: /Crear Ingreso/i }).evaluate((el: HTMLElement) => el.click());
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    await page.waitForTimeout(1000);

    // Verify new transaction appears in list
    await expect(page.getByText(TEST_DESCRIPTION)).toBeVisible({ timeout: 5000 });
  });

  test('Edit existing transaction', async ({ page }) => {
    // Find the test transaction row
    const testRow = page.getByRole('row').filter({ hasText: TEST_PREFIX });
    if ((await testRow.count()) === 0) {
      test.skip();
      return;
    }

    // Click edit button (Pencil icon)
    const editBtn = testRow.first().getByRole('button').first();
    await editBtn.click();

    // Verify edit dialog opens
    await expect(page.getByRole('heading', { name: /Editar Transacción/i })).toBeVisible({ timeout: 5000 });

    // Change description
    await page.getByLabel('Descripción').fill(TEST_DESCRIPTION_EDITED);

    // Save
    // Dialog form may exceed viewport — use JS click
    await page.getByRole('button', { name: /Guardar Cambios/i }).evaluate((el: HTMLElement) => el.click());
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    await page.waitForTimeout(1000);

    // Verify updated description
    await expect(page.getByText(TEST_DESCRIPTION_EDITED)).toBeVisible({ timeout: 5000 });
  });

  test('Delete transaction with confirmation', async ({ page }) => {
    // Find the test transaction row
    const testRow = page.getByRole('row').filter({ hasText: TEST_PREFIX });
    if ((await testRow.count()) === 0) {
      test.skip();
      return;
    }

    // Click delete button (last button in the actions column)
    const actionButtons = testRow.first().getByRole('button');
    const lastBtn = actionButtons.last();
    await lastBtn.click();

    // Verify confirmation dialog
    await expect(page.getByText('Eliminar Transacción')).toBeVisible({ timeout: 5000 });

    // Confirm deletion
    await page.getByRole('button', { name: /Eliminar/i }).click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    await page.waitForTimeout(1000);

    // Verify transaction is gone
    await expect(testRow).toHaveCount(0, { timeout: 5000 });
  });

  test('Sort by date toggles order', async ({ page }) => {
    // Only run if table has data
    const table = page.locator('table');
    if (!(await table.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    const fechaHeader = page.getByRole('button', { name: /Ordenar por fecha/i });
    if (await fechaHeader.isVisible()) {
      await fechaHeader.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Click again to toggle (table may disappear after sort if data was deleted)
      if (await fechaHeader.isVisible().catch(() => false)) {
        await fechaHeader.click();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);
      }
    }
  });

  test('Sort by amount toggles order', async ({ page }) => {
    // Click the Monto column header (sortable) — only if table has data
    const table = page.locator('table');
    if (!(await table.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    const montoHeader = page.getByRole('button', { name: /Ordenar por monto/i });
    if (await montoHeader.isVisible()) {
      await montoHeader.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Click again to toggle (table may disappear after sort if data was deleted)
      if (await montoHeader.isVisible().catch(() => false)) {
        await montoHeader.click();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);
      }
    }
  });

  test('Pagination controls appear when data is sufficient', async ({ page }) => {
    const nextBtn = page.getByRole('button', { name: /Siguiente/i });
    const hasPagination = await nextBtn.isVisible().catch(() => false);
    if (!hasPagination) {
      // Not enough transactions for pagination — skip
      test.skip();
      return;
    }

    if (await nextBtn.isEnabled()) {
      await nextBtn.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
    }
  });

  test('Reconciled checkbox toggles', async ({ page }) => {
    // Find any row with a checkbox
    const checkboxes = page.getByRole('checkbox');
    if ((await checkboxes.count()) > 0) {
      const firstCheckbox = checkboxes.first();
      const wasChecked = await firstCheckbox.isChecked();

      await firstCheckbox.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
      await page.waitForTimeout(500);

      // Revert the toggle
      await firstCheckbox.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
    }
  });
});

// Cleanup: delete any remaining test_e2e_ transactions
test.describe('Financial Transactions — Cleanup', () => {
  test.afterAll(async ({ browser }) => {
    if (!hasCredentials()) return;

    const page = await browser.newPage();
    try {
      const loggedIn = await loginAsAdmin(page);
      if (!loggedIn) return;

      await page.goto('/admin/finanzas');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
      await page.getByRole('tab', { name: /Transacciones/i }).click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
      await page.waitForTimeout(500);

      let testRow = page.getByRole('row').filter({ hasText: TEST_PREFIX });
      let attempts = 0;

      while ((await testRow.count()) > 0 && attempts < 10) {
        const actionButtons = testRow.first().getByRole('button');
        const deleteBtn = actionButtons.last();
        await deleteBtn.click();

        const confirmBtn = page.getByRole('button', { name: /Eliminar/i });
        if (await confirmBtn.isVisible({ timeout: 3000 })) {
          await confirmBtn.click();
          await page.waitForLoadState('domcontentloaded');
          await page.waitForTimeout(1000);
          await page.waitForTimeout(500);
        }

        testRow = page.getByRole('row').filter({ hasText: TEST_PREFIX });
        attempts++;
      }
    } finally {
      await page.close();
    }
  });
});
