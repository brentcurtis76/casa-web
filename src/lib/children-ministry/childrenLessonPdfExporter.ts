/**
 * Children Lesson PDF Exporter — Genera un PDF de actividad infantil para voluntarios
 * Documento tamaño carta con diseño elegante siguiendo el Brand Kit CASA.
 *
 * Design language mirrors the Celebrante PDF:
 *   - Amber top/bottom bars
 *   - Double-frame cover (grayLight outer + amber inner)
 *   - Amber accent on section headers & decorative separators
 *   - CASA logo on the cover page
 *   - Consistent use of primary.black / secondary.grayDark / secondary.grayMedium
 *
 * Pattern: src/lib/liturgia/exportService.ts (celebrant PDF)
 */

import jsPDF from 'jspdf';
import { CASA_BRAND } from '@/lib/brand-kit';
import type { LessonPhase } from '@/types/childrenPublicationState';

// ─── Public Types ───────────────────────────────────────────────────────────

export interface ChildrenLessonPdfData {
  activityName: string;
  ageGroupLabel: string;
  materials: string[];
  sequence: LessonPhase[];
  adaptations?: {
    small: string;
    medium: string;
    large: string;
    mixed: string;
  };
  volunteerPlan?: {
    leader: string;
    support: string;
  };
  estimatedTotalMinutes: number;
  liturgyTitle?: string;
  liturgyDate?: string;
  storyTitle?: string;
}

// ─── Brand-derived design tokens ────────────────────────────────────────────

const PAGE_WIDTH = 215.9; // Letter width (mm)
const PAGE_HEIGHT = 279.4; // Letter height (mm)
const MARGIN = 20;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const CENTER_X = PAGE_WIDTH / 2;

// Colors — pulled directly from CASA_BRAND
const AMBER = CASA_BRAND.colors.primary.amber; // #D4A853
const AMBER_LIGHT = CASA_BRAND.colors.amber.light; // #E8C97A
const AMBER_DARK = CASA_BRAND.colors.amber.dark; // #B8923D
const BLACK = CASA_BRAND.colors.primary.black; // #1A1A1A
const WHITE = CASA_BRAND.colors.primary.white; // #F7F7F7
const CARBON = CASA_BRAND.colors.secondary.carbon; // #333333
const GRAY_DARK = CASA_BRAND.colors.secondary.grayDark; // #555555
const GRAY_MED = CASA_BRAND.colors.secondary.grayMedium; // #8A8A8A
const GRAY_LIGHT = CASA_BRAND.colors.secondary.grayLight; // #E5E5E5

// Phase accent colors — softer palette that pairs with amber brand
const PHASE_ACCENT: Record<string, { bg: string; fg: string; label: string }> = {
  movimiento: {
    bg: '#E8F4FD',
    fg: '#2563EB',
    label: 'Movimiento',
  },
  expresion_conversacion: {
    bg: '#ECFDF5',
    fg: '#059669',
    label: 'Expresión y Conversación',
  },
  reflexion_metaprendizaje: {
    bg: '#F3F0FF',
    fg: '#7C3AED',
    label: 'Reflexión y Meta-aprendizaje',
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Hex string → {r, g, b} */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

// ─── Main Export Function ───────────────────────────────────────────────────

/**
 * Exports one or more children's lesson activities to a single PDF.
 * Each lesson starts on its own cover page.
 */
export async function exportChildrenLessonToPDF(
  lessons: ChildrenLessonPdfData[],
  onProgress?: (progress: number, message: string) => void,
): Promise<Blob> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  for (let li = 0; li < lessons.length; li++) {
    const lesson = lessons[li];
    const progress = Math.round(((li + 1) / lessons.length) * 100);
    onProgress?.(progress, `Generando ${lesson.ageGroupLabel}...`);

    if (li > 0) pdf.addPage();

    // ── Cover page ──────────────────────────────────────────────────────
    await renderCoverPage(pdf, lesson);

    // ── Content pages ───────────────────────────────────────────────────
    pdf.addPage();
    let y = MARGIN;

    const checkNewPage = (needed: number): void => {
      if (y + needed > PAGE_HEIGHT - MARGIN - 10) {
        renderPageFooter(pdf, lesson.ageGroupLabel);
        pdf.addPage();
        y = MARGIN;
        // Thin amber rule at top of continuation pages
        pdf.setDrawColor(AMBER);
        pdf.setLineWidth(0.5);
        pdf.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
        y += 6;
      }
    };

    // ── Materials ────────────────────────────────────────────────────────
    y = renderMaterialsSection(pdf, lesson.materials, y, checkNewPage);

    // ── Phases ───────────────────────────────────────────────────────────
    y += 6;
    checkNewPage(25);
    y = renderPhasesSection(pdf, lesson.sequence, y, checkNewPage);

    // ── Adaptations ─────────────────────────────────────────────────────
    if (lesson.adaptations) {
      y += 4;
      checkNewPage(30);
      y = renderAdaptationsSection(pdf, lesson.adaptations, y, checkNewPage);
    }

    // ── Volunteer Plan ──────────────────────────────────────────────────
    if (lesson.volunteerPlan) {
      y += 4;
      checkNewPage(30);
      y = renderVolunteerPlanSection(pdf, lesson.volunteerPlan, y, checkNewPage);
    }

    // Final page footer
    renderPageFooter(pdf, lesson.ageGroupLabel);
  }

  onProgress?.(100, '¡PDF listo!');
  return pdf.output('blob');
}

// ─── Cover Page ─────────────────────────────────────────────────────────────

async function renderCoverPage(pdf: jsPDF, lesson: ChildrenLessonPdfData): Promise<void> {
  // Full-page off-white background
  pdf.setFillColor(WHITE);
  pdf.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F');

  // Top amber bar (matches Celebrante)
  pdf.setFillColor(AMBER);
  pdf.rect(0, 0, PAGE_WIDTH, 6, 'F');

  // Outer decorative frame (gray) — mirrors Celebrante cover
  pdf.setDrawColor(GRAY_LIGHT);
  pdf.setLineWidth(0.3);
  pdf.rect(MARGIN - 5, MARGIN + 5, CONTENT_WIDTH + 10, PAGE_HEIGHT - MARGIN * 2 - 10);

  // Inner decorative frame (amber) — mirrors Celebrante cover
  pdf.setDrawColor(AMBER);
  pdf.setLineWidth(0.5);
  pdf.rect(MARGIN, MARGIN + 10, CONTENT_WIDTH, PAGE_HEIGHT - MARGIN * 2 - 20);

  // ── CASA logo ─────────────────────────────────────────────────────────
  try {
    const logoUrl = '/lovable-uploads/47301834-0831-465c-ae5e-47a978038312.png';
    const logoResponse = await fetch(logoUrl);
    if (logoResponse.ok) {
      const logoBlob = await logoResponse.blob();
      const logoBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(logoBlob);
      });
      pdf.addImage(logoBase64, 'PNG', CENTER_X - 12, 42, 24, 24);
    }
  } catch {
    // Continue without logo
  }

  let y = 78;

  // Document type label
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(GRAY_MED);
  pdf.text('ACTIVIDAD INFANTIL', CENTER_X, y, { align: 'center' });
  y += 14;

  // Activity name — large centered title
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(24);
  pdf.setTextColor(BLACK);
  const titleLines = pdf.splitTextToSize(lesson.activityName, CONTENT_WIDTH - 40);
  for (const line of titleLines) {
    pdf.text(line, CENTER_X, y, { align: 'center' });
    y += 10;
  }
  y += 4;

  // Decorative separator: ── ● ── (matches Celebrante style)
  pdf.setDrawColor(GRAY_LIGHT);
  pdf.setLineWidth(0.5);
  pdf.line(CENTER_X - 45, y, CENTER_X - 6, y);
  pdf.line(CENTER_X + 6, y, CENTER_X + 45, y);
  pdf.setFillColor(AMBER);
  pdf.circle(CENTER_X, y, 2.5, 'F');
  y += 12;

  // Age group badge
  const badgeText = lesson.ageGroupLabel.toUpperCase();
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  const badgeTextWidth = pdf.getTextWidth(badgeText);
  const badgePadding = 8;
  const badgeW = badgeTextWidth + badgePadding * 2;
  const badgeH = 9;
  pdf.setFillColor(AMBER);
  pdf.roundedRect(CENTER_X - badgeW / 2, y - 1, badgeW, badgeH, 2, 2, 'F');
  pdf.setTextColor(WHITE);
  pdf.text(badgeText, CENTER_X, y + 5.5, { align: 'center' });
  y += badgeH + 12;

  // ── Info box (similar to Celebrante celebrant/preacher box) ───────────
  const infoBoxX = MARGIN + 25;
  const infoBoxW = CONTENT_WIDTH - 50;
  const infoBoxY = y;
  const infoBoxH = 36;
  pdf.setFillColor('#FAFAFA');
  pdf.setDrawColor(GRAY_LIGHT);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(infoBoxX, infoBoxY, infoBoxW, infoBoxH, 3, 3, 'FD');

  let infoY = infoBoxY + 11;

  // Duration · phases · materials
  const metaParts: string[] = [];
  if (lesson.estimatedTotalMinutes) metaParts.push(`${lesson.estimatedTotalMinutes} minutos`);
  if (lesson.sequence?.length) metaParts.push(`${lesson.sequence.length} fases`);
  if (lesson.materials?.length) metaParts.push(`${lesson.materials.length} materiales`);

  if (metaParts.length > 0) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(GRAY_DARK);
    pdf.text(metaParts.join('  ·  '), CENTER_X, infoY, { align: 'center' });
    infoY += 8;
  }

  // Liturgy context
  if (lesson.liturgyTitle || lesson.liturgyDate) {
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(9);
    pdf.setTextColor(GRAY_MED);
    const ctx: string[] = [];
    if (lesson.liturgyTitle) ctx.push(lesson.liturgyTitle);
    if (lesson.liturgyDate) ctx.push(lesson.liturgyDate);
    pdf.text(ctx.join(' · '), CENTER_X, infoY, { align: 'center' });
    infoY += 7;
  }

  // Story reference
  if (lesson.storyTitle) {
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(9);
    pdf.setTextColor(AMBER_DARK);
    pdf.text(`Basado en: "${lesson.storyTitle}"`, CENTER_X, infoY, { align: 'center' });
  }

  // Bottom amber bar
  pdf.setFillColor(AMBER);
  pdf.rect(0, PAGE_HEIGHT - 6, PAGE_WIDTH, 6, 'F');

  // CASA identifier above bottom bar
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(GRAY_MED);
  pdf.text('CASA · Comunidad Anglicana San Andrés', CENTER_X, PAGE_HEIGHT - 14, {
    align: 'center',
  });
}

// ─── Page Footer ────────────────────────────────────────────────────────────

function renderPageFooter(pdf: jsPDF, ageGroupLabel: string): void {
  // Thin amber rule
  pdf.setDrawColor(AMBER);
  pdf.setLineWidth(0.3);
  pdf.line(MARGIN, PAGE_HEIGHT - MARGIN + 2, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - MARGIN + 2);

  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(7);
  pdf.setTextColor(GRAY_MED);
  pdf.text(
    `CASA · Actividad Infantil · ${ageGroupLabel}`,
    CENTER_X,
    PAGE_HEIGHT - MARGIN + 7,
    { align: 'center' },
  );
}

// ─── Section Header ─────────────────────────────────────────────────────────

function renderSectionHeader(pdf: jsPDF, title: string, y: number): number {
  // Amber accent bar (small left stripe)
  pdf.setFillColor(AMBER);
  pdf.rect(MARGIN, y - 1, 3, 6, 'F');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.setTextColor(BLACK);
  pdf.text(title.toUpperCase(), MARGIN + 6, y + 3);
  y += 8;

  // Subtle amber underline
  pdf.setDrawColor(AMBER_LIGHT);
  pdf.setLineWidth(0.4);
  pdf.line(MARGIN, y, MARGIN + 55, y);
  y += 5;

  return y;
}

// ─── Materials Section ──────────────────────────────────────────────────────

function renderMaterialsSection(
  pdf: jsPDF,
  materials: string[],
  startY: number,
  checkNewPage: (n: number) => void,
): number {
  let y = renderSectionHeader(pdf, 'Materiales', startY);

  if (!materials || materials.length === 0) {
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(10);
    pdf.setTextColor(GRAY_MED);
    pdf.text('Sin materiales requeridos', MARGIN + 4, y);
    return y + 6;
  }

  // Light background card for materials list
  const rowHeight = 6;
  const rows = Math.ceil(materials.length / 2);
  const boxHeight = rows * rowHeight + 8;
  checkNewPage(boxHeight + 4);

  pdf.setFillColor('#FAFAFA');
  pdf.setDrawColor(GRAY_LIGHT);
  pdf.setLineWidth(0.2);
  pdf.roundedRect(MARGIN, y - 2, CONTENT_WIDTH, boxHeight, 2, 2, 'FD');

  const colWidth = (CONTENT_WIDTH - 14) / 2;
  const leftX = MARGIN + 6;
  const rightX = MARGIN + 8 + colWidth;

  let colY = y + 3;

  for (let i = 0; i < materials.length; i++) {
    const x = i % 2 === 0 ? leftX : rightX;

    if (i % 2 === 0 && i > 0) {
      colY += rowHeight;
    }

    // Amber bullet dot
    pdf.setFillColor(AMBER);
    pdf.circle(x + 1.2, colY - 0.8, 0.8, 'F');

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(CARBON);
    const matText = pdf.splitTextToSize(materials[i], colWidth - 6);
    pdf.text(matText[0], x + 4, colY);
  }

  y += boxHeight + 2;
  return y;
}

// ─── Phases Section ─────────────────────────────────────────────────────────

function renderPhasesSection(
  pdf: jsPDF,
  sequence: LessonPhase[],
  startY: number,
  checkNewPage: (n: number) => void,
): number {
  let y = renderSectionHeader(pdf, 'Secuencia de Actividades', startY);

  for (let i = 0; i < sequence.length; i++) {
    const phase = sequence[i];
    checkNewPage(40);

    const accent = PHASE_ACCENT[phase.phase] || {
      bg: '#F5F5F5',
      fg: GRAY_DARK,
      label: phase.phase,
    };
    const fgRgb = hexToRgb(accent.fg);
    const bgRgb = hexToRgb(accent.bg);

    // ── Phase card ──────────────────────────────────────────────────────

    // Colored left-edge stripe (3 px)
    pdf.setFillColor(fgRgb.r, fgRgb.g, fgRgb.b);
    pdf.rect(MARGIN, y, 2.5, 8, 'F');

    // Phase header background (light tinted)
    pdf.setFillColor(bgRgb.r, bgRgb.g, bgRgb.b);
    pdf.rect(MARGIN + 2.5, y, CONTENT_WIDTH - 2.5, 8, 'F');

    // Phase label
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(fgRgb.r, fgRgb.g, fgRgb.b);
    pdf.text(`Fase ${i + 1}: ${accent.label}`, MARGIN + 6, y + 5.5);

    // Duration badge (right-aligned, filled with phase color)
    const durationText = `${phase.minutes} min`;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    const durWidth = pdf.getTextWidth(durationText) + 5;
    const durX = PAGE_WIDTH - MARGIN - durWidth - 3;
    pdf.setFillColor(fgRgb.r, fgRgb.g, fgRgb.b);
    pdf.roundedRect(durX, y + 1.5, durWidth, 5, 1, 1, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.text(durationText, durX + durWidth / 2, y + 5, { align: 'center' });

    y += 12;

    // Phase title
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(BLACK);
    const titleLines = pdf.splitTextToSize(phase.title, CONTENT_WIDTH - 10);
    pdf.text(titleLines, MARGIN + 4, y);
    y += titleLines.length * 5 + 2;

    // Phase description — the main instructional text
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(GRAY_DARK);
    const descLines = pdf.splitTextToSize(phase.description, CONTENT_WIDTH - 10);

    for (const line of descLines) {
      checkNewPage(5);
      pdf.text(line, MARGIN + 4, y);
      y += 4.5;
    }

    y += 7;
  }

  return y;
}

// ─── Adaptations Section ────────────────────────────────────────────────────

function renderAdaptationsSection(
  pdf: jsPDF,
  adaptations: { small: string; medium: string; large: string; mixed: string },
  startY: number,
  checkNewPage: (n: number) => void,
): number {
  let y = renderSectionHeader(pdf, 'Adaptaciones por Grupo', startY);

  const entries: { label: string; count: string; text: string }[] = [
    { label: 'Grupo pequeño', count: '2–5 niños', text: adaptations.small },
    { label: 'Grupo mediano', count: '6–10 niños', text: adaptations.medium },
    { label: 'Grupo grande', count: '11–15 niños', text: adaptations.large },
    { label: 'Grupo mixto', count: 'todas las edades', text: adaptations.mixed },
  ];

  for (const entry of entries) {
    if (!entry.text) continue;
    checkNewPage(18);

    // Bold label with gray count
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(BLACK);
    pdf.text(entry.label, MARGIN + 2, y);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(GRAY_MED);
    const labelW = pdf.getTextWidth(`${entry.label}  `);
    pdf.text(`(${entry.count})`, MARGIN + 2 + labelW, y);
    y += 5;

    // Description
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    pdf.setTextColor(GRAY_DARK);
    const lines = pdf.splitTextToSize(entry.text, CONTENT_WIDTH - 8);
    for (const line of lines) {
      checkNewPage(5);
      pdf.text(line, MARGIN + 4, y);
      y += 4.5;
    }
    y += 5;
  }

  return y;
}

// ─── Volunteer Plan Section ─────────────────────────────────────────────────

function renderVolunteerPlanSection(
  pdf: jsPDF,
  plan: { leader: string; support: string },
  startY: number,
  checkNewPage: (n: number) => void,
): number {
  let y = renderSectionHeader(pdf, 'Plan de Voluntarios', startY);

  const roles = [
    plan.leader ? { role: 'Líder', text: plan.leader } : null,
    plan.support ? { role: 'Apoyo', text: plan.support } : null,
  ].filter(Boolean) as { role: string; text: string }[];

  for (const item of roles) {
    checkNewPage(18);

    // Amber-dark role label
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(AMBER_DARK);
    pdf.text(`${item.role}:`, MARGIN + 2, y);
    y += 5;

    // Description
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    pdf.setTextColor(CARBON);
    const lines = pdf.splitTextToSize(item.text, CONTENT_WIDTH - 8);
    for (const line of lines) {
      checkNewPage(5);
      pdf.text(line, MARGIN + 4, y);
      y += 4.5;
    }
    y += 5;
  }

  return y;
}
