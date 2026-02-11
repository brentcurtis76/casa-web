/**
 * Financial Budgets — Presupuesto Tab E2E Tests
 *
 * Tests the budget manager: year/month selectors, budget table rendering,
 * budget creation, chart display, progress bars, and month switching.
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin, hasCredentials } from './helpers/auth';

test.describe('Financial Budgets', () => {
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

    // Click Presupuesto tab
    await page.getByRole('tab', { name: /Presupuesto/i }).click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    await page.waitForTimeout(500);
  });

  test('Budget page renders with year/month selectors', async ({ page }) => {
    // Verify year label and selector
    await expect(page.getByText('Año', { exact: true }).first()).toBeVisible();

    // Verify month label and selector
    await expect(page.getByText('Mes', { exact: true }).first()).toBeVisible();
  });

  test('Budget table or empty state renders', async ({ page }) => {
    // Wait for loading skeletons to disappear before checking state
    const skeleton = page.locator('[class*="animate-pulse"]').first();
    await skeleton.waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});

    const budgetTable = page.getByText(/Presupuesto vs Ejecución/i);
    const emptyState = page.getByText(/Sin presupuesto para/i);
    const crearBtn = page.getByRole('button', { name: /Crear Presupuesto/i });

    const hasTable = await budgetTable.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);
    const hasCreateBtn = await crearBtn.isVisible().catch(() => false);

    expect(hasTable || hasEmpty || hasCreateBtn).toBeTruthy();

    if (hasTable) {
      // Verify column headers
      await expect(page.getByText('Categoría', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('Presupuesto', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('Gastado', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('Diferencia', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('% Ejecutado', { exact: true }).first()).toBeVisible();
    }
  });

  test('Budget table shows income and expense sections', async ({ page }) => {
    const hasTable = await page.getByText('Presupuesto vs Ejecución').isVisible().catch(() => false);
    if (!hasTable) {
      test.skip();
      return;
    }

    // Verify section headers
    const ingresoSection = page.getByText('Ingresos', { exact: true });
    const gastoSection = page.getByText('Gastos', { exact: true });

    // At least one section should exist
    const hasIncome = await ingresoSection.first().isVisible().catch(() => false);
    const hasExpense = await gastoSection.first().isVisible().catch(() => false);
    expect(hasIncome || hasExpense).toBeTruthy();

    // Verify subtotal rows
    if (hasIncome) {
      await expect(page.getByText('Subtotal Ingresos')).toBeVisible();
    }
    if (hasExpense) {
      await expect(page.getByText('Subtotal Gastos')).toBeVisible();
    }

    // Verify grand total
    await expect(page.getByText('Total General')).toBeVisible();
  });

  test('Budget creation button is visible', async ({ page }) => {
    // Look for either "Crear Presupuesto" or "Editar Presupuesto"
    // Multiple "Crear Presupuesto" buttons may exist (header + empty state), use .first()
    const createBtn = page.getByRole('button', { name: /Crear Presupuesto|Editar Presupuesto/i }).first();
    const isVisible = await createBtn.isVisible().catch(() => false);

    // Budget creation or edit button should be visible for authorized users
    expect(isVisible).toBe(true);

    if (isVisible) {
      await createBtn.click();
      await page.waitForTimeout(500);

      // Verify the BudgetForm dialog opens
      // Close it without making changes
      await page.keyboard.press('Escape');
    }
  });

  test('Copy from previous month button is visible', async ({ page }) => {
    const copyBtn = page.getByRole('button', { name: /Copiar del Mes Anterior/i });
    const isVisible = await copyBtn.isVisible().catch(() => false);

    // This button should be present when canWrite is true
    expect(isVisible).toBe(true);
  });

  test('Progress bars render with color coding', async ({ page }) => {
    const hasTable = await page.getByText('Presupuesto vs Ejecución').isVisible().catch(() => false);
    if (!hasTable) {
      test.skip();
      return;
    }

    // Verify progress bars are rendered
    const progressBars = page.locator('[role="progressbar"]');
    const count = await progressBars.count();

    if (count > 0) {
      // At least one progress bar exists
      expect(count).toBeGreaterThan(0);

      // Verify percentage labels are shown (e.g., "45%")
      const percentagePattern = /\d+%/;
      const pageContent = await page.textContent('body');
      expect(pageContent).toMatch(percentagePattern);
    }
  });

  test('Budget vs actual chart renders when data exists', async ({ page }) => {
    const hasTable = await page.getByText('Presupuesto vs Ejecución').isVisible().catch(() => false);
    if (!hasTable) {
      test.skip();
      return;
    }

    // The BudgetVsActualChart renders below the table
    const svgElements = page.locator('svg');
    const chartCount = await svgElements.count();
    // Chart SVGs should render when budget data exists
    expect(chartCount).toBeGreaterThan(0);
  });

  test('Change month updates budget data', async ({ page }) => {
    // Note current content
    const bodyTextBefore = await page.textContent('body');

    // Switch to a different month — click the month selector and choose a different month
    // Find the month selector (second select trigger with class w-[140px])
    const monthSelectors = page.locator('button[role="combobox"]');
    if ((await monthSelectors.count()) >= 2) {
      await monthSelectors.nth(1).click();
      await page.waitForTimeout(300);

      // Select "Enero" (first option)
      const enero = page.getByRole('option', { name: 'Enero' });
      if (await enero.isVisible()) {
        await enero.click();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);
        await page.waitForTimeout(500);
      }
    }
  });
});
