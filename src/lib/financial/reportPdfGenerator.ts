/**
 * Financial Report PDF Generator
 *
 * Generates professional PDF reports using jsPDF + jspdf-autotable.
 * Uses CASA branding: amber headers (#D4A853), formatted tables, CLP amounts.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCLP, MONTH_LABELS_FULL } from '@/types/financial';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ReportConfig {
  year: number;
  month: number;
  endYear?: number;
  endMonth?: number;
}

interface SummaryMetric {
  label: string;
  value: string;
}

interface TableSection {
  title: string;
  headers: string[];
  rows: string[][];
  rightAlignColumns?: number[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const CASA_AMBER_R = 212;
const CASA_AMBER_G = 168;
const CASA_AMBER_B = 83;
const PAGE_MARGIN = 20;
const HEADER_HEIGHT = 45;

// ─── PDF Generation ─────────────────────────────────────────────────────────

function createBasePdf(): jsPDF {
  return new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });
}

function addHeader(doc: jsPDF, title: string, dateRange: string): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Organization name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(CASA_AMBER_R, CASA_AMBER_G, CASA_AMBER_B);
  doc.text('Comunidad Anglicana San Andrés', pageWidth / 2, PAGE_MARGIN, { align: 'center' });

  // Report title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 30);
  doc.text(title, pageWidth / 2, PAGE_MARGIN + 8, { align: 'center' });

  // Date range
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(dateRange, pageWidth / 2, PAGE_MARGIN + 14, { align: 'center' });

  // Generated timestamp
  const now = new Date();
  const timestamp = `Generado: ${now.toLocaleDateString('es-CL')} ${now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`;
  doc.text(timestamp, pageWidth / 2, PAGE_MARGIN + 19, { align: 'center' });

  // Separator line
  doc.setDrawColor(CASA_AMBER_R, CASA_AMBER_G, CASA_AMBER_B);
  doc.setLineWidth(0.5);
  doc.line(PAGE_MARGIN, PAGE_MARGIN + 23, pageWidth - PAGE_MARGIN, PAGE_MARGIN + 23);

  return PAGE_MARGIN + 28;
}

function addFooter(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      'CASA — Informe Financiero — Uso Interno',
      PAGE_MARGIN,
      pageHeight - 10
    );
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth - PAGE_MARGIN,
      pageHeight - 10,
      { align: 'right' }
    );
  }
}

function addSummaryBox(
  doc: jsPDF,
  metrics: SummaryMetric[],
  startY: number
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const boxWidth = pageWidth - PAGE_MARGIN * 2;
  const boxHeight = 16;

  // Light background box
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(PAGE_MARGIN, startY, boxWidth, boxHeight, 2, 2, 'F');

  // Metrics inside the box
  const colWidth = boxWidth / metrics.length;
  doc.setFont('helvetica', 'normal');

  metrics.forEach((metric, i) => {
    const x = PAGE_MARGIN + colWidth * i + colWidth / 2;

    // Label
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(metric.label, x, startY + 5, { align: 'center' });

    // Value
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(metric.value, x, startY + 12, { align: 'center' });
    doc.setFont('helvetica', 'normal');
  });

  return startY + boxHeight + 5;
}

function addTable(
  doc: jsPDF,
  section: TableSection,
  startY: number
): number {
  // Section title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text(section.title, PAGE_MARGIN, startY);

  const columnStyles: Record<number, { halign: 'left' | 'right' | 'center' }> = {};
  if (section.rightAlignColumns) {
    for (const col of section.rightAlignColumns) {
      columnStyles[col] = { halign: 'right' };
    }
  }

  autoTable(doc, {
    startY: startY + 2,
    head: [section.headers],
    body: section.rows,
    theme: 'striped',
    headStyles: {
      fillColor: [CASA_AMBER_R, CASA_AMBER_G, CASA_AMBER_B],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [50, 50, 50],
    },
    alternateRowStyles: {
      fillColor: [248, 248, 248],
    },
    columnStyles,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
  });

  // Get the final Y position after the table
  return (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY + 30;
}

// ─── Report Generators ──────────────────────────────────────────────────────

interface MonthlySummaryData {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  incomeBreakdown: Array<{ category_name: string; total: number; percentage: number }>;
  expenseBreakdown: Array<{ category_name: string; total: number; percentage: number }>;
  previousMonth?: {
    incomeBreakdown: Array<{ category_name: string; total: number }>;
    expenseBreakdown: Array<{ category_name: string; total: number }>;
  };
}

interface CategoryReportData {
  categories: Array<{
    name: string;
    monthlyData: Array<{ month: string; amount: number; change: number }>;
    average: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  }>;
}

interface BudgetReportData {
  totalBudget: number;
  totalActual: number;
  totalDifference: number;
  totalPercentage: number;
  items: Array<{
    categoryName: string;
    budgeted: number;
    actual: number;
    difference: number;
    percentage: number;
  }>;
  notes: string[];
}

interface AnnualReportData {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  monthlyData: Array<{ month: number; label: string; income: number; expenses: number; balance: number }>;
  topIncomeCategories: Array<{ category_id: string; category_name: string; total: number; percentage: number }>;
  topExpenseCategories: Array<{ category_id: string; category_name: string; total: number; percentage: number }>;
  isPartialYear: boolean;
  lastMonthWithData: number;
  budgetComparison: {
    totalBudget: number;
    totalActual: number;
    totalDifference: number;
    totalPercentage: number;
    items: Array<{
      category_id: string;
      categoryName: string;
      budgeted: number;
      actual: number;
      difference: number;
      percentage: number;
    }>;
  } | null;
  notes: string[];
}

function generateMonthlySummaryPdf(data: MonthlySummaryData, config: ReportConfig): jsPDF {
  const doc = createBasePdf();
  const monthName = MONTH_LABELS_FULL[config.month - 1];
  const title = `Informe Financiero Mensual — ${monthName} ${config.year}`;

  let y = addHeader(doc, title, `${monthName} ${config.year}`);

  y = addSummaryBox(doc, [
    { label: 'Total Ingresos', value: formatCLP(data.totalIncome) },
    { label: 'Total Gastos', value: formatCLP(data.totalExpenses) },
    { label: 'Balance', value: formatCLP(data.balance) },
  ], y);

  // Income breakdown
  if (data.incomeBreakdown.length > 0) {
    y = addTable(doc, {
      title: 'Desglose de Ingresos',
      headers: ['Categoría', 'Monto', '% del Total'],
      rows: data.incomeBreakdown.map((item) => [
        item.category_name,
        formatCLP(item.total),
        `${item.percentage}%`,
      ]),
      rightAlignColumns: [1, 2],
    }, y + 5);
  }

  // Expense breakdown
  if (data.expenseBreakdown.length > 0) {
    y = addTable(doc, {
      title: 'Desglose de Gastos',
      headers: ['Categoría', 'Monto', '% del Total'],
      rows: data.expenseBreakdown.map((item) => [
        item.category_name,
        formatCLP(item.total),
        `${item.percentage}%`,
      ]),
      rightAlignColumns: [1, 2],
    }, y + 5);
  }

  addFooter(doc);
  return doc;
}

function generateCategoryReportPdf(data: CategoryReportData, config: ReportConfig): jsPDF {
  const doc = createBasePdf();
  const startMonth = MONTH_LABELS_FULL[config.month - 1];
  const endMonth = config.endMonth ? MONTH_LABELS_FULL[config.endMonth - 1] : startMonth;
  const dateRange = config.endYear
    ? `${startMonth} ${config.year} — ${endMonth} ${config.endYear}`
    : `${startMonth} ${config.year}`;

  let y = addHeader(doc, 'Informe por Categoría', dateRange);

  for (const cat of data.categories) {
    // Check for page break
    if (y > 230) {
      doc.addPage();
      y = PAGE_MARGIN + 10;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(CASA_AMBER_R, CASA_AMBER_G, CASA_AMBER_B);
    doc.text(cat.name, PAGE_MARGIN, y);

    const trendText =
      cat.trend === 'increasing' ? '▲ En aumento' :
      cat.trend === 'decreasing' ? '▼ En disminución' :
      '● Estable';

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`Promedio mensual: ${formatCLP(cat.average)} | Tendencia: ${trendText}`, PAGE_MARGIN, y + 5);

    y = addTable(doc, {
      title: '',
      headers: ['Mes', 'Monto', 'Cambio vs Anterior'],
      rows: cat.monthlyData.map((m) => [
        m.month,
        formatCLP(m.amount),
        m.change === 0 ? '—' : `${m.change > 0 ? '▲' : '▼'} ${Math.abs(m.change)}%`,
      ]),
      rightAlignColumns: [1, 2],
    }, y + 8);

    y += 5;
  }

  addFooter(doc);
  return doc;
}

function generateBudgetReportPdf(data: BudgetReportData, config: ReportConfig): jsPDF {
  const doc = createBasePdf();
  const monthName = MONTH_LABELS_FULL[config.month - 1];
  const title = `Informe Presupuesto vs Real — ${monthName} ${config.year}`;

  let y = addHeader(doc, title, `${monthName} ${config.year}`);

  y = addSummaryBox(doc, [
    { label: 'Total Presupuesto', value: formatCLP(data.totalBudget) },
    { label: 'Total Ejecutado', value: formatCLP(data.totalActual) },
    { label: 'Diferencia', value: formatCLP(data.totalDifference) },
    { label: '% Ejecutado', value: `${data.totalPercentage}%` },
  ], y);

  // Main table
  y = addTable(doc, {
    title: 'Detalle por Categoría',
    headers: ['Categoría', 'Presupuestado', 'Ejecutado', 'Diferencia', '%'],
    rows: data.items.map((item) => [
      item.categoryName,
      formatCLP(item.budgeted),
      formatCLP(item.actual),
      formatCLP(item.difference),
      `${item.percentage}%`,
    ]),
    rightAlignColumns: [1, 2, 3, 4],
  }, y + 5);

  // Notes section
  if (data.notes.length > 0) {
    y += 8;
    if (y > 240) {
      doc.addPage();
      y = PAGE_MARGIN + 10;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);
    doc.text('Observaciones', PAGE_MARGIN, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);

    y += 5;
    for (const note of data.notes) {
      if (y > 260) {
        doc.addPage();
        y = PAGE_MARGIN + 10;
      }
      doc.text(`• ${note}`, PAGE_MARGIN + 2, y);
      y += 4;
    }
  }

  addFooter(doc);
  return doc;
}

function generateAnnualReportPdf(data: AnnualReportData, config: ReportConfig): jsPDF {
  const doc = createBasePdf();
  const title = `Informe Financiero Anual — ${config.year}`;
  const dateRange = data.isPartialYear
    ? `Enero — ${MONTH_LABELS_FULL[data.lastMonthWithData - 1]} (parcial)`
    : 'Enero — Diciembre';

  let y = addHeader(doc, title, dateRange);

  y = addSummaryBox(doc, [
    { label: 'Total Ingresos', value: formatCLP(data.totalIncome) },
    { label: 'Total Gastos', value: formatCLP(data.totalExpenses) },
    { label: 'Balance', value: formatCLP(data.balance) },
  ], y);

  // Monthly breakdown table
  y = addTable(doc, {
    title: 'Desglose Mensual',
    headers: ['Mes', 'Ingresos', 'Gastos', 'Balance'],
    rows: data.monthlyData.map((item) => [
      MONTH_LABELS_FULL[item.month - 1],
      formatCLP(item.income),
      formatCLP(item.expenses),
      formatCLP(item.balance),
    ]),
    rightAlignColumns: [1, 2, 3],
  }, y + 5);

  // Top income categories
  if (data.topIncomeCategories.length > 0) {
    y += 8;
    if (y > 240) {
      doc.addPage();
      y = PAGE_MARGIN + 10;
    }

    y = addTable(doc, {
      title: 'Top 10 Categorías de Ingresos',
      headers: ['Categoría', 'Total Anual', '% del Total'],
      rows: data.topIncomeCategories.map((item) => [
        item.category_name,
        formatCLP(item.total),
        `${item.percentage}%`,
      ]),
      rightAlignColumns: [1, 2],
    }, y);
  }

  // Top expense categories
  if (data.topExpenseCategories.length > 0) {
    y += 8;
    if (y > 240) {
      doc.addPage();
      y = PAGE_MARGIN + 10;
    }

    y = addTable(doc, {
      title: 'Top 10 Categorías de Gastos',
      headers: ['Categoría', 'Total Anual', '% del Total'],
      rows: data.topExpenseCategories.map((item) => [
        item.category_name,
        formatCLP(item.total),
        `${item.percentage}%`,
      ]),
      rightAlignColumns: [1, 2],
    }, y);
  }

  // Budget comparison (if available)
  if (data.budgetComparison) {
    y += 8;
    if (y > 240) {
      doc.addPage();
      y = PAGE_MARGIN + 10;
    }

    // Budget summary metrics
    y = addSummaryBox(doc, [
      { label: 'Presupuesto Anual', value: formatCLP(data.budgetComparison.totalBudget) },
      { label: 'Ejecutado', value: formatCLP(data.budgetComparison.totalActual) },
      { label: '% Ejecutado', value: `${data.budgetComparison.totalPercentage}%` },
    ], y);

    y = addTable(doc, {
      title: 'Comparación Presupuesto vs Ejecutado',
      headers: ['Categoría', 'Presupuestado', 'Ejecutado', '% Ejecutado'],
      rows: data.budgetComparison.items.map((item) => [
        item.categoryName,
        formatCLP(item.budgeted),
        formatCLP(item.actual),
        `${item.percentage}%`,
      ]),
      rightAlignColumns: [1, 2, 3],
    }, y + 5);
  }

  // Notes section
  if (data.notes.length > 0) {
    y += 8;
    if (y > 240) {
      doc.addPage();
      y = PAGE_MARGIN + 10;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);
    doc.text('Observaciones', PAGE_MARGIN, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);

    y += 5;
    for (const note of data.notes) {
      if (y > 260) {
        doc.addPage();
        y = PAGE_MARGIN + 10;
      }
      doc.text(`• ${note}`, PAGE_MARGIN + 2, y);
      y += 4;
    }
  }

  addFooter(doc);
  return doc;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export type ReportData = MonthlySummaryData | CategoryReportData | BudgetReportData | AnnualReportData;

export function generateFinancialPDF(
  reportType: 'monthly' | 'category' | 'budget' | 'annual',
  data: ReportData,
  config: ReportConfig
): jsPDF {
  switch (reportType) {
    case 'monthly':
      return generateMonthlySummaryPdf(data as MonthlySummaryData, config);
    case 'category':
      return generateCategoryReportPdf(data as CategoryReportData, config);
    case 'budget':
      return generateBudgetReportPdf(data as BudgetReportData, config);
    case 'annual':
      return generateAnnualReportPdf(data as AnnualReportData, config);
  }
}

export function downloadFinancialPDF(
  reportType: 'monthly' | 'category' | 'budget' | 'annual',
  data: ReportData,
  config: ReportConfig
): void {
  const doc = generateFinancialPDF(reportType, data, config);

  const typeNames: Record<string, string> = {
    monthly: 'Resumen_Mensual',
    category: 'Informe_Categoria',
    budget: 'Presupuesto_vs_Real',
    annual: 'Informe_Anual',
  };

  let filename: string;
  if (reportType === 'annual') {
    filename = `CASA_${typeNames[reportType]}_${config.year}.pdf`;
  } else {
    const monthStr = String(config.month).padStart(2, '0');
    filename = `CASA_${typeNames[reportType]}_${config.year}_${monthStr}.pdf`;
  }

  doc.save(filename);
}

export type { MonthlySummaryData, CategoryReportData, BudgetReportData, AnnualReportData };
