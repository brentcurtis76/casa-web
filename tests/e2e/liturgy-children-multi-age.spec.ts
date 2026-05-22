/**
 * Liturgy Children Activities — Multi-Age-Group E2E
 *
 * Exercises the full builder flow:
 *   1. Open a liturgy fixture that already has a completed cuentacuentos.
 *   2. Open the "Actividades de Niños" dialog from the ExportPanel.
 *   3. Select Pequeños + Medianos + Grandes.
 *   4. Click "Generar" — generate-children-lesson is mocked deterministically
 *      so the test never depends on Anthropic / network latency.
 *   5. Verify the results view reports "3 de 3 actividad(es) generada(s)" and
 *      lists all three groups (regression guard against the previous bug
 *      where only the last group survived).
 *   6. Close the dialog and click "Descargar Actividad PDF".
 *   7. Capture the download and assert it fires with a non-empty PDF.
 *
 * Environment requirements (test will skip cleanly if any are missing):
 *   - TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD — for app login (consumed by
 *     ./helpers/auth.ts)
 *   - E2E_LITURGY_CUENTACUENTOS_TITLE — title of a pre-existing liturgy
 *     in the dev DB whose cuentacuentos element is completed so the
 *     "Actividades de Niños" section is enabled.
 *
 * Note: per-group lesson persistence and the combined PDF rendering are
 * covered by unit tests (liturgyChildrenPublishService.test.ts,
 * childrenLessonPdfExporter.test.ts). This spec wires them together
 * through the real UI so the multi-group regression cannot reappear.
 */

import { test, expect, type Route, type Locator } from '@playwright/test';
import { loginAsAdmin, hasCredentials } from './helpers/auth';

const FIXTURE_LITURGY_TITLE = process.env.E2E_LITURGY_CUENTACUENTOS_TITLE;

const TARGET_AGE_GROUPS = ['Pequeños', 'Medianos', 'Grandes'] as const;

/**
 * Build a deterministic, schema-valid response for the generate-children-lesson
 * edge function. Each group gets a distinct activity name so we can confirm
 * the persisted multi-group output (not just the last one's content).
 */
function buildMockGenerationResponse(ageGroupLabel: string) {
  const tag = ageGroupLabel.toLowerCase();
  return {
    success: true,
    activityName: `Actividad E2E ${ageGroupLabel}`,
    materials: [`material-${tag}-1`, `material-${tag}-2`],
    sequence: [
      {
        phase: 'movimiento',
        title: `Movimiento ${ageGroupLabel}`,
        minutes: 10,
        description: `Movimiento para ${ageGroupLabel}`,
        activitySteps: [`Paso 1 ${tag}`, `Paso 2 ${tag}`],
      },
      {
        phase: 'expresion_conversacion',
        title: `Expresión ${ageGroupLabel}`,
        minutes: 10,
        description: `Expresión para ${ageGroupLabel}`,
        activitySteps: [`Hablar ${tag}`],
      },
      {
        phase: 'reflexion_metaprendizaje',
        title: `Reflexión ${ageGroupLabel}`,
        minutes: 10,
        description: `Reflexión para ${ageGroupLabel}`,
        activitySteps: [`Reflexionar ${tag}`],
      },
    ],
    adaptations: {
      smallGroup: `Adaptación grupo pequeño ${ageGroupLabel}`,
      largeGroup: `Adaptación grupo grande ${ageGroupLabel}`,
    },
    volunteerPlan: {
      teacher: `Voluntario líder ${ageGroupLabel}`,
      assistant: `Voluntario ayudante ${ageGroupLabel}`,
      preparation: `Preparación ${ageGroupLabel}`,
    },
    estimatedTotalMinutes: 30,
    requestId: `mock-${tag}`,
  };
}

/**
 * Intercept the generate-children-lesson edge function and reply with the
 * deterministic fixture above. Captures every (ageGroup, ageGroupLabel)
 * tuple so the test can assert all three groups actually invoked the EF.
 */
async function installGenerateLessonMock(
  route: Route,
  observed: Set<string>,
): Promise<void> {
  let body: { ageGroup?: string; ageGroupLabel?: string } = {};
  try {
    body = JSON.parse(route.request().postData() || '{}');
  } catch {
    // ignore — fall through with empty body
  }
  const label = body.ageGroupLabel ?? body.ageGroup ?? 'desconocido';
  observed.add(label);

  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(buildMockGenerationResponse(label)),
  });
}

/**
 * Toggle a checkbox in the dialog by its visible age-group label.
 * The dialog renders <Checkbox id={uuid}/> + <label htmlFor={uuid}>{name}</label>,
 * so clicking the label is the natural user gesture and the one Radix
 * forwards to the checkbox button.
 */
async function selectAgeGroupCheckbox(
  dialog: Locator,
  groupName: string,
): Promise<boolean> {
  const label = dialog.locator('label', { hasText: new RegExp(`^\\s*${groupName}\\s*$`) });
  if ((await label.count()) === 0) {
    return false;
  }
  await label.first().click();
  return true;
}

test.describe('Liturgia → Actividades de Niños — multi grupo + export PDF', () => {
  test.beforeEach(async ({ page }) => {
    if (!hasCredentials() || !FIXTURE_LITURGY_TITLE) {
      test.skip(
        true,
        'Requiere TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD y E2E_LITURGY_CUENTACUENTOS_TITLE apuntando a una liturgia con cuentacuentos completado.',
      );
      return;
    }

    const loggedIn = await loginAsAdmin(page);
    if (!loggedIn) {
      test.skip(true, 'No se pudo iniciar sesión con las credenciales provistas.');
      return;
    }
  });

  test('genera Pequeños + Medianos + Grandes y descarga PDF combinado', async ({ page }) => {
    const observedGroups = new Set<string>();
    await page.route('**/functions/v1/generate-children-lesson', (route) =>
      installGenerateLessonMock(route, observedGroups),
    );

    // 1) Abrir constructor + cargar la liturgia fixture.
    await page.goto('/admin/liturgia/constructor');
    await page.waitForLoadState('domcontentloaded');

    const liturgyLink = page
      .getByText(FIXTURE_LITURGY_TITLE!, { exact: false })
      .first();
    await liturgyLink.waitFor({ timeout: 15000 });
    await liturgyLink.click();
    await page.waitForLoadState('domcontentloaded');

    // 2) Llegar al ExportPanel — algunos layouts lo tienen detrás de una pestaña
    //    "Exportar"; otros lo muestran inline. Manejar ambas situaciones.
    const exportTab = page
      .getByRole('tab', { name: /Exportar|Export/i })
      .or(page.getByRole('button', { name: /^Exportar$/i }));
    if (await exportTab.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await exportTab.first().click();
    }

    await expect(
      page.getByRole('heading', { name: 'Actividades de Niños' }).or(
        page.getByText('Actividades de Niños', { exact: true }),
      ),
    ).toBeVisible({ timeout: 20000 });

    // 3) Abrir el diálogo de actividades.
    await page
      .getByRole('button', { name: /Generar Actividades de Niños/i })
      .first()
      .click();

    const dialog = page.getByRole('dialog');
    await expect(
      dialog.getByRole('heading', { name: /Actividades de Niños/i }),
    ).toBeVisible({ timeout: 5000 });

    // Esperar a que termine la carga de grupos de edad existentes.
    await expect(
      dialog.getByText(/Cargando actividades existentes/i),
    ).toBeHidden({ timeout: 15000 });

    // 4) Seleccionar los tres grupos de edad — todos deben estar disponibles
    //    (la liturgia fixture parte sin actividades previas).
    for (const groupName of TARGET_AGE_GROUPS) {
      const selected = await selectAgeGroupCheckbox(dialog, groupName);
      expect(
        selected,
        `Esperaba ver el checkbox para ${groupName}. ¿La liturgia fixture ya tenía esta actividad generada?`,
      ).toBe(true);
    }

    // 5) Click en "Generar" y esperar el view de resultados.
    await dialog.getByRole('button', { name: /^Generar$/i }).click();

    // El indicador resumen "X de Y actividad(es) generada(s) y guardada(s)"
    // sólo aparece en el view 'results'. Esperarlo asegura que la corrida
    // multi-grupo realmente terminó.
    await expect(
      dialog.getByText(/\bde\s+3\s+actividad\(es\)\s+generada\(s\)/i),
    ).toBeVisible({ timeout: 30000 });

    // Regresión clave: deben ser 3 de 3, no "1 de 3" (que era el bug).
    await expect(
      dialog.getByText(/^3\s+de\s+3\s+actividad\(es\)/i),
    ).toBeVisible({ timeout: 5000 });

    // El detalle por grupo debe listar los tres labels.
    const detailRegion = dialog.getByRole('region', {
      name: /Resultados de actividades/i,
    }).or(dialog.locator('[aria-label="Resultados de actividades"]'));
    for (const groupName of TARGET_AGE_GROUPS) {
      await expect(detailRegion.getByText(groupName, { exact: false })).toBeVisible();
    }

    // Y la EF mock debe haberse invocado una vez por grupo.
    expect(
      observedGroups.size,
      `La edge function se invocó para grupos: ${[...observedGroups].join(', ')}`,
    ).toBeGreaterThanOrEqual(TARGET_AGE_GROUPS.length);

    // 6) Cerrar el diálogo desde el view de resultados.
    await dialog.getByRole('button', { name: /^Cerrar$/i }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });

    // 7) Descargar el PDF combinado.
    const pdfButton = page.getByRole('button', {
      name: /Descargar Actividad PDF/i,
    });
    await expect(pdfButton).toBeVisible({ timeout: 15000 });

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60000 }),
      pdfButton.click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);

    // Validar que el archivo descargado no esté vacío — prueba de humo de
    // que jsPDF efectivamente compuso el PDF combinado de los 3 grupos.
    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    if (downloadPath) {
      const { stat } = await import('node:fs/promises');
      const stats = await stat(downloadPath);
      expect(stats.size).toBeGreaterThan(1024); // >1KB = real PDF, no shim
    }
  });
});
