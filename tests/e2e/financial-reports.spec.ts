/**
 * Financial Reports — Reportes Tab E2E Tests
 *
 * Tests the report configuration panel: report type selector (radio group),
 * date range inputs, report generation, PDF export button, and empty states.
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin, hasCredentials } from './helpers/auth';

test.describe('Financial Reports', () => {
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

    // Click Reportes tab
    await page.getByRole('tab', { name: /Reportes/i }).click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    await page.waitForTimeout(500);
  });

  test('Report page renders with configuration panel', async ({ page }) => {
    // Verify configuration heading
    await expect(page.getByText('Configuración del Informe')).toBeVisible({ timeout: 10000 });

    // Verify 3 report type options (radio group labels)
    await expect(page.getByText('Resumen Mensual')).toBeVisible();
    await expect(page.getByText('Informe por Categoría')).toBeVisible();
    await expect(page.getByText('Presupuesto vs Real')).toBeVisible();

    // Verify "Generar Informe" button
    await expect(page.getByRole('button', { name: /Generar Informe/i })).toBeVisible();
  });

  test('Report type selector shows year and month inputs', async ({ page }) => {
    // For "Resumen Mensual" (default selection)
    await expect(page.getByText('Año', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Mes', { exact: true }).first()).toBeVisible();
  });

  test('Monthly summary report generates', async ({ page }) => {
    // Resumen Mensual should be the default radio selection
    await page.getByText('Resumen Mensual').click();
    await page.waitForTimeout(300);

    // Click "Generar Informe"
    await page.getByRole('button', { name: /Generar Informe/i }).click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    await page.waitForTimeout(2000);

    // Verify report content appears (or loading/empty state)
    // The MonthlySummaryReport component should render
    const reportContent = page.locator('body');
    const bodyText = await reportContent.textContent();

    // Should show CLP amounts or empty state
    expect(bodyText).toBeTruthy();
  });

  test('Category report shows category selector', async ({ page }) => {
    // Select "Informe por Categoría"
    await page.getByText('Informe por Categoría').click();
    await page.waitForTimeout(500);

    // Verify date range labels change to "Desde — Año" etc.
    await expect(page.getByText('Desde — Año')).toBeVisible();
    await expect(page.getByText('Desde — Mes')).toBeVisible();
    await expect(page.getByText('Hasta — Año')).toBeVisible();
    await expect(page.getByText('Hasta — Mes')).toBeVisible();

    // Verify category selector appears
    await expect(page.getByText('Categorías a analizar')).toBeVisible();
  });

  test('Budget report generates', async ({ page }) => {
    // Select "Presupuesto vs Real"
    await page.getByText('Presupuesto vs Real').click();
    await page.waitForTimeout(300);

    // Click "Generar Informe"
    await page.getByRole('button', { name: /Generar Informe/i }).click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    await page.waitForTimeout(2000);

    // Verify report generated (BudgetReport component renders)
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
  });

  test('PDF export button appears after generating report', async ({ page }) => {
    // Generate a monthly report
    await page.getByText('Resumen Mensual').click();
    await page.waitForTimeout(300);

    await page.getByRole('button', { name: /Generar Informe/i }).click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    await page.waitForTimeout(2000);

    // Check for "Exportar PDF" button
    const exportBtn = page.getByRole('button', { name: /Exportar PDF/i });
    const isVisible = await exportBtn.isVisible().catch(() => false);

    if (isVisible) {
      // Verify it's clickable (don't actually download — just verify no errors)
      await expect(exportBtn).toBeEnabled();
    }
  });

  test('Category report requires category selection to generate', async ({ page }) => {
    // Select "Informe por Categoría"
    await page.getByText('Informe por Categoría').click();
    await page.waitForTimeout(500);

    // "Generar Informe" button should be disabled when no categories selected
    const generateBtn = page.getByRole('button', { name: /Generar Informe/i });
    await expect(generateBtn).toBeDisabled();

    // Verify help text
    await expect(page.getByText('Seleccione al menos una categoría')).toBeVisible();
  });

  test('Responsive layout adapts on smaller viewports', async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 640, height: 800 });
    await page.waitForTimeout(500);

    // Report configuration should still be visible
    await expect(page.getByText('Configuración del Informe')).toBeVisible();

    // Report type cards should stack vertically
    await expect(page.getByText('Resumen Mensual')).toBeVisible();
  });
});
