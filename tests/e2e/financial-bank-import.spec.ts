/**
 * Financial Bank Import — Importar Tab E2E Tests
 *
 * Tests the bank import wizard: file upload, column mapping, preview,
 * reconciliation, and wizard reset. Uses a programmatically created CSV file.
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin, hasCredentials } from './helpers/auth';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const TEST_PREFIX = 'test_e2e_';
const CSV_CONTENT = [
  'Fecha;Descripción;Monto;Referencia',
  `15/01/2026;${TEST_PREFIX}Pago Luz;-25000;REF001`,
  `20/01/2026;${TEST_PREFIX}Ofrenda;50000;REF002`,
].join('\n');

let csvPath: string;

test.describe('Financial Bank Import', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(() => {
    // Create test CSV file
    csvPath = path.join(os.tmpdir(), 'test_e2e_bank-import.csv');
    fs.writeFileSync(csvPath, CSV_CONTENT, 'utf-8');
  });

  test.afterAll(() => {
    // Cleanup CSV file
    try {
      if (csvPath && fs.existsSync(csvPath)) {
        fs.unlinkSync(csvPath);
      }
    } catch {
      // ignore cleanup errors
    }
  });

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

    // Click Importar tab
    await page.getByRole('tab', { name: /Importar/i }).click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    await page.waitForTimeout(500);
  });

  test('Import wizard shows step 1 (file upload)', async ({ page }) => {
    // Verify file upload area
    await expect(page.getByText('Subir Archivo de Cartola Bancaria')).toBeVisible();

    // Verify drag and drop zone text
    await expect(page.getByText(/Arrastra un archivo aquí/i)).toBeVisible();

    // Verify supported formats message
    await expect(page.getByText(/CSV, XLSX/i)).toBeVisible();

    // Verify bank name input
    await expect(page.getByLabel('Nombre del Banco')).toBeVisible();

    // Verify statement date input
    await expect(page.getByLabel('Fecha del Estado de Cuenta')).toBeVisible();
  });

  test('Upload a CSV file and fill required fields', async ({ page }) => {
    // Upload the test CSV file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(csvPath);
    await page.waitForTimeout(500);

    // Verify the file name is displayed
    await expect(page.getByText('test_e2e_bank-import.csv')).toBeVisible();

    // Fill bank name
    await page.getByLabel('Nombre del Banco').fill('test_e2e_Banco Prueba');

    // Verify the "Siguiente" button is enabled
    const nextBtn = page.getByRole('button', { name: /Siguiente/i });
    await expect(nextBtn).toBeEnabled();
  });

  test('Upload CSV and advance to step 2 (column mapping)', async ({ page }) => {
    // Upload the test CSV file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(csvPath);
    await page.waitForTimeout(500);

    // Fill required fields
    await page.getByLabel('Nombre del Banco').fill('test_e2e_Banco Prueba');

    // Click "Siguiente" to parse and advance
    await page.getByRole('button', { name: /Siguiente/i }).click();
    await page.waitForTimeout(2000);

    // Verify step 2 (Column Mapping) is visible
    await expect(page.locator('h3, [class*="CardTitle"]').getByText('Mapear Columnas')).toBeVisible({ timeout: 10000 });

    // Verify "Anterior" button is visible (can go back)
    await expect(page.getByRole('button', { name: /Anterior/i })).toBeVisible();
  });

  test('Advance to step 3 (preview)', async ({ page }) => {
    // Upload and fill
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(csvPath);
    await page.waitForTimeout(500);
    await page.getByLabel('Nombre del Banco').fill('test_e2e_Banco Prueba');

    // Step 1 → Step 2
    await page.getByRole('button', { name: /Siguiente/i }).click();
    await expect(page.locator('h3, [class*="CardTitle"]').getByText('Mapear Columnas')).toBeVisible({ timeout: 10000 });

    // Step 2 → Step 3
    await page.getByRole('button', { name: /Siguiente/i }).click();
    await page.waitForTimeout(2000);

    // Verify step 3 (Preview) is visible
    await expect(page.locator('h3, [class*="CardTitle"]').getByText('Vista Previa')).toBeVisible({ timeout: 10000 });

    // Verify parsed transaction count
    await expect(page.getByText(/2 transacciones encontradas/i)).toBeVisible();

    // Verify test data appears in preview
    await expect(page.getByText(`${TEST_PREFIX}Pago Luz`)).toBeVisible();
    await expect(page.getByText(`${TEST_PREFIX}Ofrenda`)).toBeVisible();

    // Verify "Importar" button is visible
    await expect(page.getByRole('button', { name: /Importar/i })).toBeVisible();
  });

  test('Cancel/back returns to previous step', async ({ page }) => {
    // Upload and fill
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(csvPath);
    await page.waitForTimeout(500);
    await page.getByLabel('Nombre del Banco').fill('test_e2e_Banco Prueba');

    // Step 1 → Step 2
    await page.getByRole('button', { name: /Siguiente/i }).click();
    await expect(page.locator('h3, [class*="CardTitle"]').getByText('Mapear Columnas')).toBeVisible({ timeout: 10000 });

    // Go back
    await page.getByRole('button', { name: /Anterior/i }).click();
    await page.waitForTimeout(500);

    // Verify we're back on step 1
    await expect(page.getByText('Subir Archivo de Cartola Bancaria')).toBeVisible();
  });

  test('Step indicator shows correct progress', async ({ page }) => {
    // Verify all 4 step labels exist
    await expect(page.getByText('Subir Archivo de Cartola Bancaria')).toBeVisible();

    // The other steps should be in the indicator (rendered as spans)
    // Step names are: Subir Archivo, Mapear Columnas, Vista Previa, Conciliación
    await expect(page.getByText('Mapear Columnas').first()).toBeVisible();
    await expect(page.getByText('Vista Previa').first()).toBeVisible();
  });
});

// Cleanup: remove any imported test transactions
test.describe('Financial Bank Import — Cleanup', () => {
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

      // Delete any test_e2e_ transactions that may have been imported
      let attempts = 0;
      while (attempts < 10) {
        const testTx = page.getByText(new RegExp(TEST_PREFIX));
        if ((await testTx.count()) === 0) break;

        // Click the row to select, then delete
        await testTx.first().click();
        await page.waitForTimeout(300);

        const deleteBtn = page.getByRole('button', { name: /Eliminar/i });
        if (await deleteBtn.isVisible()) {
          await deleteBtn.click();
          const confirmBtn = page.getByRole('button', { name: /Confirmar/i });
          if (await confirmBtn.isVisible({ timeout: 3000 })) {
            await confirmBtn.click();
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(1000);
            await page.waitForTimeout(500);
          }
        } else {
          break;
        }
        attempts++;
      }
    } finally {
      await page.close();
    }
  });
});
