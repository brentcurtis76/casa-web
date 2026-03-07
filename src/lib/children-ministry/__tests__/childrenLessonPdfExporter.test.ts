/**
 * Children Lesson PDF Exporter — Unit Tests
 *
 * Tests the PDF generation for children's activity guides.
 * Uses jsPDF mocking to verify correct PDF construction without
 * creating actual PDF files (jsPDF is not fully functional in jsdom).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChildrenLessonPdfData } from '../childrenLessonPdfExporter';

// ─── jsPDF mock ─────────────────────────────────────────────────────────────

const mockPdfInstance = {
  setFont: vi.fn(),
  setFontSize: vi.fn(),
  setTextColor: vi.fn(),
  setFillColor: vi.fn(),
  setDrawColor: vi.fn(),
  setLineWidth: vi.fn(),
  text: vi.fn(),
  rect: vi.fn(),
  roundedRect: vi.fn(),
  line: vi.fn(),
  circle: vi.fn(),
  addPage: vi.fn(),
  addImage: vi.fn(),
  splitTextToSize: vi.fn((text: string, _width: number) => [text]),
  getTextWidth: vi.fn((_text: string) => 30),
  output: vi.fn(() => new Blob(['fake-pdf'], { type: 'application/pdf' })),
};

vi.mock('jspdf', () => {
  class MockJsPDF {
    constructor() {
      return mockPdfInstance;
    }
  }
  return {
    default: MockJsPDF,
    jsPDF: MockJsPDF,
  };
});

// Mock fetch for logo loading (cover page tries to fetch CASA logo)
const originalFetch = globalThis.fetch;
beforeEach(() => {
  globalThis.fetch = vi.fn().mockRejectedValue(new Error('no network in test'));
});

// ─── Test fixtures ──────────────────────────────────────────────────────────

function buildSampleLesson(overrides?: Partial<ChildrenLessonPdfData>): ChildrenLessonPdfData {
  return {
    activityName: 'Parabola del Sembrador',
    ageGroupLabel: 'Pequeños',
    materials: ['semillas', 'tierra', 'macetas', 'regadera'],
    sequence: [
      {
        phase: 'movimiento',
        title: 'Sembradores en movimiento',
        description: 'Los ninos se desplazan por el espacio como si sembraran semillas',
        minutes: 8,
      },
      {
        phase: 'expresion_conversacion',
        title: 'Plantamos en macetas',
        description: 'Cada nino planta una semilla real en una maceta',
        minutes: 10,
      },
      {
        phase: 'reflexion_metaprendizaje',
        title: 'Reflexion: La semilla crece',
        description: 'Conversacion guiada sobre como la semilla representa nuestra fe',
        minutes: 8,
      },
    ],
    adaptations: {
      small: 'Grupos mas pequenos comparten una maceta entre dos',
      medium: 'Cada nino tiene su propia maceta',
      large: 'Dividir en dos grupos por rotacion',
      mixed: 'Los mayores ayudan a los pequenos a plantar',
    },
    volunteerPlan: {
      leader: 'Guia la actividad, explica los pasos, maneja tiempos',
      support: 'Ayuda a preparar materiales, asiste ninos con dificultades',
    },
    estimatedTotalMinutes: 26,
    liturgyTitle: 'Domingo de Ramos',
    liturgyDate: '30 de marzo de 2025',
    storyTitle: 'El Sembrador',
    ...overrides,
  };
}

/** Collect all text calls into a single searchable string */
function getAllRenderedText(): string {
  return mockPdfInstance.text.mock.calls
    .map((call: unknown[]) => String(call[0]))
    .join(' ');
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('childrenLessonPdfExporter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('no network'));
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  // ── Basic output ────────────────────────────────────────────────────────

  it('should export a single lesson to a PDF blob', async () => {
    const { exportChildrenLessonToPDF } = await import('../childrenLessonPdfExporter');
    const blob = await exportChildrenLessonToPDF([buildSampleLesson()]);

    expect(blob).toBeInstanceOf(Blob);
    expect(mockPdfInstance.output).toHaveBeenCalledWith('blob');
  });

  it('should call onProgress with 100% when complete', async () => {
    const { exportChildrenLessonToPDF } = await import('../childrenLessonPdfExporter');
    const onProgress = vi.fn();

    await exportChildrenLessonToPDF([buildSampleLesson()], onProgress);

    expect(onProgress).toHaveBeenCalled();
    const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1];
    expect(lastCall[0]).toBe(100);
    expect(lastCall[1]).toBe('¡PDF listo!');
  });

  // ── Pagination ──────────────────────────────────────────────────────────

  it('should create a cover page plus content page per lesson', async () => {
    const { exportChildrenLessonToPDF } = await import('../childrenLessonPdfExporter');

    await exportChildrenLessonToPDF([buildSampleLesson()]);

    // At minimum: 1 addPage for the content page after the cover
    expect(mockPdfInstance.addPage.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('should add pages for multiple lessons', async () => {
    const { exportChildrenLessonToPDF } = await import('../childrenLessonPdfExporter');

    await exportChildrenLessonToPDF([
      buildSampleLesson({ ageGroupLabel: 'Pequeños' }),
      buildSampleLesson({ ageGroupLabel: 'Medianos' }),
      buildSampleLesson({ ageGroupLabel: 'Grandes' }),
    ]);

    // 3 lessons × (1 cover-to-content addPage) + 2 inter-lesson addPages = ≥5
    expect(mockPdfInstance.addPage.mock.calls.length).toBeGreaterThanOrEqual(5);
  });

  // ── Cover page ──────────────────────────────────────────────────────────

  it('should render the activity name on the cover', async () => {
    const { exportChildrenLessonToPDF } = await import('../childrenLessonPdfExporter');
    await exportChildrenLessonToPDF([buildSampleLesson({ activityName: 'Mi Actividad Especial' })]);

    expect(getAllRenderedText()).toContain('Mi Actividad Especial');
  });

  it('should render the age group badge in uppercase', async () => {
    const { exportChildrenLessonToPDF } = await import('../childrenLessonPdfExporter');
    await exportChildrenLessonToPDF([buildSampleLesson({ ageGroupLabel: 'Grandes' })]);

    expect(getAllRenderedText()).toContain('GRANDES');
  });

  it('should render ACTIVIDAD INFANTIL label on cover', async () => {
    const { exportChildrenLessonToPDF } = await import('../childrenLessonPdfExporter');
    await exportChildrenLessonToPDF([buildSampleLesson()]);

    expect(getAllRenderedText()).toContain('ACTIVIDAD INFANTIL');
  });

  it('should render CASA community name on cover', async () => {
    const { exportChildrenLessonToPDF } = await import('../childrenLessonPdfExporter');
    await exportChildrenLessonToPDF([buildSampleLesson()]);

    expect(getAllRenderedText()).toContain('Comunidad Anglicana San Andrés');
  });

  it('should render the amber top bar on the cover', async () => {
    const { exportChildrenLessonToPDF } = await import('../childrenLessonPdfExporter');
    await exportChildrenLessonToPDF([buildSampleLesson()]);

    // Top bar is a filled rect at (0, 0) — white background first, then amber bar
    const rectCalls = mockPdfInstance.rect.mock.calls;
    const topBarDrawn = rectCalls.some(
      (call: unknown[]) => call[0] === 0 && call[1] === 0 && call[4] === 'F',
    );
    expect(topBarDrawn).toBe(true);
  });

  it('should render the amber bottom bar on the cover', async () => {
    const { exportChildrenLessonToPDF } = await import('../childrenLessonPdfExporter');
    await exportChildrenLessonToPDF([buildSampleLesson()]);

    const rectCalls = mockPdfInstance.rect.mock.calls;
    // Bottom bar is at y ≈ PAGE_HEIGHT - 6 = 273.4
    const bottomBarDrawn = rectCalls.some(
      (call: unknown[]) =>
        typeof call[1] === 'number' && call[1] > 270 && call[4] === 'F',
    );
    expect(bottomBarDrawn).toBe(true);
  });

  it('should render double decorative frame on cover', async () => {
    const { exportChildrenLessonToPDF } = await import('../childrenLessonPdfExporter');
    await exportChildrenLessonToPDF([buildSampleLesson()]);

    // setDrawColor is called with GRAY_LIGHT for outer frame and AMBER for inner frame
    const drawCalls = mockPdfInstance.setDrawColor.mock.calls;
    const hasGrayLight = drawCalls.some(
      (call: unknown[]) => call[0] === '#E5E5E5',
    );
    const hasAmber = drawCalls.some(
      (call: unknown[]) => call[0] === '#D4A853',
    );
    expect(hasGrayLight).toBe(true);
    expect(hasAmber).toBe(true);
  });

  it('should render liturgy context and story on cover', async () => {
    const { exportChildrenLessonToPDF } = await import('../childrenLessonPdfExporter');
    await exportChildrenLessonToPDF([
      buildSampleLesson({
        liturgyTitle: 'Domingo de Ramos',
        liturgyDate: '30 de marzo de 2025',
        storyTitle: 'El Sembrador',
      }),
    ]);

    const text = getAllRenderedText();
    expect(text).toContain('Domingo de Ramos');
    expect(text).toContain('El Sembrador');
  });

  // ── Materials section ───────────────────────────────────────────────────

  it('should render materials section header and items', async () => {
    const { exportChildrenLessonToPDF } = await import('../childrenLessonPdfExporter');
    await exportChildrenLessonToPDF([
      buildSampleLesson({ materials: ['cartulinas', 'crayones'] }),
    ]);

    const text = getAllRenderedText();
    expect(text).toContain('MATERIALES');
    expect(text).toContain('cartulinas');
    expect(text).toContain('crayones');
  });

  it('should handle empty materials gracefully', async () => {
    const { exportChildrenLessonToPDF } = await import('../childrenLessonPdfExporter');
    const blob = await exportChildrenLessonToPDF([buildSampleLesson({ materials: [] })]);

    expect(blob).toBeInstanceOf(Blob);
    expect(getAllRenderedText()).toContain('Sin materiales requeridos');
  });

  it('should render amber bullet dots for materials', async () => {
    const { exportChildrenLessonToPDF } = await import('../childrenLessonPdfExporter');
    await exportChildrenLessonToPDF([buildSampleLesson({ materials: ['papel', 'tijeras'] })]);

    // circle() is called for each material bullet
    expect(mockPdfInstance.circle.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  // ── Phases section ──────────────────────────────────────────────────────

  it('should render all three phase headers', async () => {
    const { exportChildrenLessonToPDF } = await import('../childrenLessonPdfExporter');
    await exportChildrenLessonToPDF([buildSampleLesson()]);

    const text = getAllRenderedText();
    expect(text).toContain('Fase 1');
    expect(text).toContain('Fase 2');
    expect(text).toContain('Fase 3');
  });

  it('should render phase duration badges', async () => {
    const { exportChildrenLessonToPDF } = await import('../childrenLessonPdfExporter');
    await exportChildrenLessonToPDF([buildSampleLesson()]);

    const text = getAllRenderedText();
    expect(text).toContain('8 min');
    expect(text).toContain('10 min');
  });

  it('should render phase titles and descriptions', async () => {
    const { exportChildrenLessonToPDF } = await import('../childrenLessonPdfExporter');
    await exportChildrenLessonToPDF([buildSampleLesson()]);

    const text = getAllRenderedText();
    expect(text).toContain('Sembradores en movimiento');
    expect(text).toContain('Plantamos en macetas');
  });

  it('should use color-coded phase accent colors', async () => {
    const { exportChildrenLessonToPDF } = await import('../childrenLessonPdfExporter');
    await exportChildrenLessonToPDF([buildSampleLesson()]);

    const fillCalls = mockPdfInstance.setFillColor.mock.calls;

    // Blue for movimiento: hex #2563EB → rgb(37, 99, 235)
    const hasBlue = fillCalls.some(
      (call: unknown[]) => call[0] === 37 && call[1] === 99 && call[2] === 235,
    );
    // Emerald for expresion: hex #059669 → rgb(5, 150, 105)
    const hasEmerald = fillCalls.some(
      (call: unknown[]) => call[0] === 5 && call[1] === 150 && call[2] === 105,
    );
    // Violet for reflexion: hex #7C3AED → rgb(124, 58, 237)
    const hasViolet = fillCalls.some(
      (call: unknown[]) => call[0] === 124 && call[1] === 58 && call[2] === 237,
    );

    expect(hasBlue).toBe(true);
    expect(hasEmerald).toBe(true);
    expect(hasViolet).toBe(true);
  });

  it('should handle empty sequence without crashing', async () => {
    const { exportChildrenLessonToPDF } = await import('../childrenLessonPdfExporter');
    const blob = await exportChildrenLessonToPDF([buildSampleLesson({ sequence: [] })]);
    expect(blob).toBeInstanceOf(Blob);
  });

  // ── Adaptations section ─────────────────────────────────────────────────

  it('should render adaptations section when present', async () => {
    const { exportChildrenLessonToPDF } = await import('../childrenLessonPdfExporter');
    await exportChildrenLessonToPDF([buildSampleLesson()]);

    const text = getAllRenderedText();
    expect(text).toContain('ADAPTACIONES POR GRUPO');
    expect(text).toContain('Grupo pequeño');
    expect(text).toContain('Grupo grande');
    expect(text).toContain('Grupo mixto');
  });

  it('should skip adaptations section when not provided', async () => {
    const { exportChildrenLessonToPDF } = await import('../childrenLessonPdfExporter');
    await exportChildrenLessonToPDF([buildSampleLesson({ adaptations: undefined })]);

    expect(getAllRenderedText()).not.toContain('ADAPTACIONES POR GRUPO');
  });

  // ── Volunteer plan section ──────────────────────────────────────────────

  it('should render volunteer plan section when present', async () => {
    const { exportChildrenLessonToPDF } = await import('../childrenLessonPdfExporter');
    await exportChildrenLessonToPDF([buildSampleLesson()]);

    const text = getAllRenderedText();
    expect(text).toContain('PLAN DE VOLUNTARIOS');
    expect(text).toContain('Líder:');
    expect(text).toContain('Apoyo:');
  });

  it('should skip volunteer plan section when not provided', async () => {
    const { exportChildrenLessonToPDF } = await import('../childrenLessonPdfExporter');
    await exportChildrenLessonToPDF([buildSampleLesson({ volunteerPlan: undefined })]);

    expect(getAllRenderedText()).not.toContain('PLAN DE VOLUNTARIOS');
  });

  // ── Page footer ─────────────────────────────────────────────────────────

  it('should render page footer with CASA branding', async () => {
    const { exportChildrenLessonToPDF } = await import('../childrenLessonPdfExporter');
    await exportChildrenLessonToPDF([buildSampleLesson()]);

    const footerRendered = mockPdfInstance.text.mock.calls.some(
      (call: unknown[]) =>
        typeof call[0] === 'string' &&
        call[0].includes('CASA') &&
        call[0].includes('Actividad Infantil'),
    );
    expect(footerRendered).toBe(true);
  });

  // ── Section header design ───────────────────────────────────────────────

  it('should render amber accent stripe on section headers', async () => {
    const { exportChildrenLessonToPDF } = await import('../childrenLessonPdfExporter');
    await exportChildrenLessonToPDF([buildSampleLesson()]);

    // Section headers use a small amber rect as a left-edge stripe
    const fillCalls = mockPdfInstance.setFillColor.mock.calls;
    const amberFills = fillCalls.filter(
      (call: unknown[]) => call[0] === '#D4A853',
    );
    // At least 3 section headers (Materials, Phases, Adaptations) + cover elements
    expect(amberFills.length).toBeGreaterThanOrEqual(3);
  });
});
