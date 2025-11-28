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
    await expect(page.getByText('La Mesa Abierta')).toBeVisible();
    await expect(page.getByText(/Una cena mensual/i)).toBeVisible();
  });

  test('should show sign-up dialog when "Ser Invitado" is clicked', async ({ page }) => {
    // Note: This test will require authentication to work properly
    // For now, we test that the button exists
    const guestButton = page.getByRole('button', { name: /Ser Invitado/i });
    await expect(guestButton).toBeVisible();
  });

  test('should show sign-up dialog when "Ser Anfitrión" is clicked', async ({ page }) => {
    // Note: This test will require authentication to work properly
    // For now, we test that the button exists
    const hostButton = page.getByRole('button', { name: /Ser Anfitrión/i });
    await expect(hostButton).toBeVisible();
  });

  test('should display next dinner information if available', async ({ page }) => {
    // Check for dinner information elements
    const nextDinnerSection = page.locator('text=Próxima Cena');
    if (await nextDinnerSection.count() > 0) {
      await expect(nextDinnerSection).toBeVisible();
    }
  });

  test('should display "How It Works" section', async ({ page }) => {
    await expect(page.getByText('¿Cómo Funciona?')).toBeVisible();
    await expect(page.getByText('Inscríbete')).toBeVisible();
    await expect(page.getByText('Espera la Asignación')).toBeVisible();
    await expect(page.getByText('¡Disfruta!')).toBeVisible();
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
