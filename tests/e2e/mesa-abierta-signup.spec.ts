import { test, expect } from '@playwright/test';

test.describe('Mesa Abierta Sign-up Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the Mesa Abierta section
    await page.goto('/');
    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('should display Mesa Abierta section', async ({ page }) => {
    // Check that the Mesa Abierta section is visible
    await expect(page.getByRole('heading', { name: 'La Mesa Abierta', exact: true })).toBeVisible();
    await expect(page.getByText(/Una cena mensual/i)).toBeVisible();
  });

  test('should show the public sign-up call to action', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Inscríbete Aquí' })).toBeVisible();
  });

  test('should ask unauthenticated visitors to create an account', async ({ page }) => {
    await page.getByRole('button', { name: 'Inscríbete Aquí' }).click();
    await expect(page.getByRole('heading', { name: 'CREAR CUENTA' })).toBeVisible();
  });

  test('should display next dinner information if available', async ({ page }) => {
    // Check for dinner information elements
    const nextDinnerSection = page.locator('text=Próxima Cena');
    if (await nextDinnerSection.count() > 0) {
      await expect(nextDinnerSection).toBeVisible();
    }
  });

  test('should display "How It Works" section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '¿Cómo Funciona?' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Inscríbete', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Espera la Asignación' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '¡Disfruta!' })).toBeVisible();
  });

  // TODO: Add authenticated tests for full signup flow
  // These will require setting up Supabase test data and authentication
  test.skip('should complete guest signup flow', async ({ page }) => {
    // This test will be implemented once we have test authentication set up
  });

  test.skip('should complete host signup flow', async ({ page }) => {
    // This test will be implemented once we have test authentication set up
  });
});
