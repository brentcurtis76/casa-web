/**
 * Component-level regression guard for Portadas refine integration.
 *
 * Locks down the body shape sent to `generate-illustration` when the user
 * triggers a refine on either cover. Specifically guards against the
 * "naked refine call" regression where prompt context (jsonPrompt /
 * customPrompt) was missing and Gemini drifted off-subject (the original
 * Día de la Madre / church-with-crosses bug).
 *
 * NOT a UX test — it asserts payload shape only, not visual behavior.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Portadas from '../Portadas';
import type { LiturgyContext } from '@/types/shared/liturgy';

// Captures every call to supabase.functions.invoke so we can assert body
// shape on whichever invocation corresponds to each refine.
const invokeMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    // The Portadas useEffect hits site_config.select(...).eq(...).single()
    // to look up the liturgical season. Returning { data: null } makes the
    // component fall back to fallbackSeason — exactly the path we want for a
    // deterministic test.
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
  },
}));

vi.mock('@/lib/covers/useCasaLogo', () => ({
  useCasaLogo: () => ({
    // Magic-byte-shaped fake so any downstream `isValidImageBase64` check
    // (not actually hit in this test, but defensive) passes.
    logoBase64: 'iVBORw0KGgoFAKE_LOGO',
    failed: false,
    retry: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// Fake base64 payloads with PNG magic bytes (`iVBORw0KGgo`) so any incidental
// validation downstream accepts them. The strings are otherwise arbitrary.
const FAKE_MAIN_1 = 'iVBORw0KGgoMAIN_1';
const FAKE_MAIN_2 = 'iVBORw0KGgoMAIN_2';
const FAKE_MAIN_3 = 'iVBORw0KGgoMAIN_3';
const FAKE_MAIN_4 = 'iVBORw0KGgoMAIN_4';
const FAKE_REFLECTION = 'iVBORw0KGgoREFL_1';
const FAKE_REFINED = 'iVBORw0KGgoREFINED';

const baseContext: LiturgyContext = {
  id: 'test-liturgy',
  date: new Date('2026-05-10'),
  title: 'Día de la Madre',
  readings: [],
  summary: '',
  preacher: 'Pastor Test',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
};

beforeEach(() => {
  invokeMock.mockReset();
});

/** Helper: click "Generar Portadas" and wait until the 4 variations render. */
async function generateAndSelectFirstMain() {
  // 1st invocation = main generation → returns 4 variations.
  invokeMock.mockImplementationOnce(() =>
    Promise.resolve({
      data: { illustrations: [FAKE_MAIN_1, FAKE_MAIN_2, FAKE_MAIN_3, FAKE_MAIN_4] },
      error: null,
    }),
  );
  // 2nd invocation = auto-triggered reflection generation → returns 1 image.
  invokeMock.mockImplementationOnce(() =>
    Promise.resolve({
      data: { illustrations: [FAKE_REFLECTION] },
      error: null,
    }),
  );

  render(<Portadas context={baseContext} />);

  // Trigger main generation.
  const genBtn = await screen.findByRole('button', { name: /generar portadas/i });
  fireEvent.click(genBtn);

  // Wait for the four selectable variation tiles to render.
  const variations = await screen.findAllByRole('button', {
    name: /seleccionar portada opción/i,
  });
  expect(variations).toHaveLength(4);

  // Selecting the first variation auto-fires the reflection generation
  // (the 2nd queued mock above).
  fireEvent.click(variations[0]);

  // Wait until both calls have landed so we know we're past auto-reflection.
  await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(2));

  return { variations };
}

describe('Portadas refine integration', () => {
  it('sends jsonPrompt + refine body for MAIN cover refinement', async () => {
    await generateAndSelectFirstMain();

    // 3rd queued response = main refine.
    invokeMock.mockImplementationOnce(() =>
      Promise.resolve({
        data: { illustrations: [FAKE_REFINED] },
        error: null,
      }),
    );
    // 4th queued response = the auto-triggered reflection regen that fires
    // after a successful main refine. Not asserted here (see the dedicated
    // auto-regen test below), but queued so the call doesn't blow up the
    // handler with "destructure of undefined".
    invokeMock.mockImplementationOnce(() =>
      Promise.resolve({ data: { illustrations: ['iVBORw0KGgoNOOP'] }, error: null }),
    );

    // After main selection, exactly ONE refine box is on screen (the main
    // cover's). There is no separate reflection refine UI.
    const textareas = await screen.findAllByLabelText(/pide un cambio a la imagen/i);
    expect(textareas).toHaveLength(1);
    fireEvent.change(textareas[0], {
      target: { value: 'use less amber and add a mother with her son' },
    });

    fireEvent.click(screen.getByRole('button', { name: /enviar cambio/i }));

    // The main refine is invocation #3. Wait for at least that many — the
    // auto-regen may already have fired by the time this resolves.
    await waitFor(() =>
      expect(invokeMock.mock.calls.length).toBeGreaterThanOrEqual(3),
    );

    const [fnName, { body }] = invokeMock.mock.calls[2];
    expect(fnName).toBe('generate-illustration');
    expect(body).toMatchObject({
      jsonPrompt: expect.any(String),
      aspectRatio: '4:3',
      refine: {
        sourceImage: FAKE_MAIN_1,
        feedback: 'use less amber and add a mother with her son',
      },
    });

    // Mutual exclusivity guard: must NOT have customPrompt (the edge function
    // returns 400 if both are present, so this is also a contract check).
    expect(body).not.toHaveProperty('customPrompt');

    // The cached jsonPrompt should look like a real liturgy cover brief.
    expect(body.jsonPrompt).toContain('Día de la Madre');
  });

  it('only renders ONE refine box (main); reflection has no separate refine UI', async () => {
    await generateAndSelectFirstMain();

    // After generation + main selection, exactly one refine textarea should
    // exist on the page (the main cover's). The reflection cover is
    // image-to-image-recomposed from the main and shares its illustration —
    // refining belongs only at the main-cover level.
    const textareas = await screen.findAllByLabelText(/pide un cambio a la imagen/i);
    expect(textareas).toHaveLength(1);
  });

  it('auto-regenerates the REFLECTION cover after a main refine succeeds', async () => {
    await generateAndSelectFirstMain();

    // 3rd queued response = main refine output.
    invokeMock.mockImplementationOnce(() =>
      Promise.resolve({
        data: { illustrations: [FAKE_REFINED] },
        error: null,
      }),
    );
    // 4th queued response = auto-triggered reflection regen using the
    // refined main as the new reference image.
    const FAKE_REFLECTION_REGEN = 'iVBORw0KGgoREFL_REGEN';
    invokeMock.mockImplementationOnce(() =>
      Promise.resolve({
        data: { illustrations: [FAKE_REFLECTION_REGEN] },
        error: null,
      }),
    );

    const textarea = await screen.findByLabelText(/pide un cambio a la imagen/i);
    fireEvent.change(textarea, { target: { value: 'use less amber' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar cambio/i }));

    // 1: main generation, 2: initial reflection, 3: main refine, 4: reflection auto-regen
    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(4));

    // Invocation #4 must be a reflection generation seeded with the REFINED
    // main image (not the original selection), so the reflection inherits
    // the new illustration.
    const [reflectionFnName, { body: reflectionBody }] = invokeMock.mock.calls[3];
    expect(reflectionFnName).toBe('generate-illustration');
    expect(reflectionBody).toMatchObject({
      referenceImage: FAKE_REFINED,
      count: 1,
      aspectRatio: '4:3',
    });
    // Reflection regen is the standard image-to-image recomposition path —
    // must NOT carry a refine payload (this is generation, not editing).
    expect(reflectionBody).not.toHaveProperty('refine');
    // referencePrompt is the recomposition directive built from title + preacher.
    expect(reflectionBody.referencePrompt).toEqual(expect.any(String));
  });
});
