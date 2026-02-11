/**
 * Shared auth helper for E2E tests.
 * Extracted from rbac.spec.ts — login via the app's own login form.
 */

import { type Page } from '@playwright/test';

export async function loginAsAdmin(page: Page): Promise<boolean> {
  const email = process.env.TEST_ADMIN_EMAIL;
  const password = process.env.TEST_ADMIN_PASSWORD;

  if (!email || !password) {
    return false;
  }

  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);

  const emailInput = page.getByPlaceholder('tuemail@ejemplo.com');
  const passwordInput = page.getByPlaceholder('******');

  try {
    await emailInput.first().waitFor({ timeout: 5000 });
  } catch {
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

  await page.waitForLoadState('domcontentloaded');

  await page.waitForTimeout(1000);

  return true;
}

export function hasCredentials(): boolean {
  return !!(process.env.TEST_ADMIN_EMAIL && process.env.TEST_ADMIN_PASSWORD);
}
