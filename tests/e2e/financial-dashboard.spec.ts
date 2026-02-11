/**
 * Financial Dashboard — Resumen Tab E2E Tests
 *
 * Tests the dashboard summary cards, charts, "Ver todas" navigation,
 * and quick-add transaction buttons on the Resumen tab at /admin/finanzas.
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin, hasCredentials } from './helpers/auth';

test.describe('Financial Dashboard — Resumen Tab', () => {
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
  });

  test('Dashboard renders summary cards', async ({ page }) => {
    // Verify Resumen tab is active (default tab)
    const resumenTab = page.getByRole('tab', { name: /Resumen/i });
    await expect(resumenTab).toBeVisible();

    // Verify summary card titles are present
    await expect(page.getByText('Ingresos del Mes')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Gastos del Mes')).toBeVisible();
    await expect(page.getByText('Balance')).toBeVisible();
    await expect(page.getByText('Presupuesto Restante')).toBeVisible();

    // Verify CLP-formatted amounts are visible (match pattern $X.XXX)
    const clpPattern = /\$[\d.]+/;
    const pageContent = await page.textContent('body');
    expect(pageContent).toMatch(clpPattern);
  });

  test('Dashboard shows charts', async ({ page }) => {
    // Wait for chart content to load
    await page.waitForTimeout(2000);

    // Bar chart heading
    await expect(page.getByText('Ingresos vs Gastos (6 meses)')).toBeVisible({ timeout: 10000 });

    // Pie chart heading
    const pieHeading = page.getByText('Desglose de Gastos');
    await expect(pieHeading).toBeVisible();

    // Verify at least one SVG element is rendered (Recharts output)
    const svgElements = page.locator('svg');
    expect(await svgElements.count()).toBeGreaterThan(0);
  });

  test('"Ver todas" link navigates to Transacciones tab', async ({ page }) => {
    // Wait for recent transactions section
    await expect(page.getByText('Transacciones Recientes', { exact: true })).toBeVisible({ timeout: 10000 });

    // Click "Ver todas" button
    const verTodasBtn = page.getByRole('button', { name: /Ver todas/i });
    await expect(verTodasBtn).toBeVisible();
    await verTodasBtn.click();

    // Verify Transacciones tab becomes active
    const transaccionesTab = page.getByRole('tab', { name: /Transacciones/i });
    await expect(transaccionesTab).toHaveAttribute('data-state', 'active', { timeout: 5000 });
  });

  test('Quick-add income button opens transaction form', async ({ page }) => {
    // Look for the "Nuevo Ingreso" button on the dashboard
    const nuevoIngresoBtn = page.getByRole('button', { name: /Nuevo Ingreso/i }).first();

    // If the button is visible (canWrite), click it
    if (await nuevoIngresoBtn.isVisible()) {
      await nuevoIngresoBtn.click();
      await page.waitForTimeout(1000);

      // Verify TransactionForm dialog opens
      const dialog = page.locator('[role="dialog"]').last();
      await expect(dialog).toBeVisible({ timeout: 5000 });
      await expect(dialog.getByText(/Nuevo Ingreso/i).first()).toBeVisible();

      // Close dialog — button may be outside viewport in tall form
      await page.keyboard.press('Escape');
    }
  });

  test('Quick-add expense button opens transaction form', async ({ page }) => {
    // Look for the "Nuevo Gasto" button on the dashboard
    const nuevoGastoBtn = page.getByRole('button', { name: /Nuevo Gasto/i }).first();

    // If the button is visible (canWrite), click it
    if (await nuevoGastoBtn.isVisible()) {
      await nuevoGastoBtn.click();
      await page.waitForTimeout(1000);

      // Verify TransactionForm dialog opens
      const dialog = page.locator('[role="dialog"]').last();
      await expect(dialog).toBeVisible({ timeout: 5000 });
      await expect(dialog.getByText(/Nuevo Gasto/i).first()).toBeVisible();

      // Close dialog — button may be outside viewport in tall form
      await page.keyboard.press('Escape');
    }
  });
});
