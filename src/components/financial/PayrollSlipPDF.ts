/**
 * Payroll Slip PDF Generator
 *
 * Utility function (NOT a React component) for generating pay stub PDFs.
 * Uses jsPDF + jspdf-autotable with CASA branding.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCLP, MONTH_LABELS_FULL } from '@/types/financial';
import type { PayrollCalculation } from '@/lib/financial/payrollCalculator';

// ─── Constants (CASA branding) ──────────────────────────────────────────────

const AMBER_R = 212;
const AMBER_G = 168;
const AMBER_B = 83;
const MARGIN = 20;

// ─── Types ──────────────────────────────────────────────────────────────────

interface EmployeeInfo {
  name: string;
  rut: string;
  position: string;
  contractType: string;
}

interface PayrollPeriod {
  year: number;
  month: number;
}

// ─── Local Helpers ──────────────────────────────────────────────────────────

function addPdfHeader(doc: jsPDF, period: PayrollPeriod): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const monthName = MONTH_LABELS_FULL[period.month - 1];

  // Organization name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(AMBER_R, AMBER_G, AMBER_B);
  doc.text('COMUNIDAD ANGLICANA SAN ANDRÉS', pageWidth / 2, MARGIN, { align: 'center' });

  // Document title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 30);
  doc.text('LIQUIDACIÓN DE REMUNERACIONES', pageWidth / 2, MARGIN + 8, { align: 'center' });

  // Period
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`Período: ${monthName} ${period.year}`, pageWidth / 2, MARGIN + 15, { align: 'center' });

  // Separator line
  doc.setDrawColor(AMBER_R, AMBER_G, AMBER_B);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, MARGIN + 19, pageWidth - MARGIN, MARGIN + 19);

  return MARGIN + 25;
}

function addEmployeeInfo(doc: jsPDF, employee: EmployeeInfo, y: number): number {
  const contractLabels: Record<string, string> = {
    indefinido: 'Indefinido',
    plazo_fijo: 'Plazo Fijo',
    honorarios: 'Honorarios',
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);

  const leftX = MARGIN;
  const rightX = 110;

  doc.text('Nombre:', leftX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(employee.name, leftX + 25, y);

  doc.setFont('helvetica', 'bold');
  doc.text('RUT:', rightX, y);
  doc.setFont('helvetica', 'normal');
  const maskedRut = employee.rut.length > 5
    ? '*'.repeat(employee.rut.length - 5) + employee.rut.slice(-5)
    : employee.rut;
  doc.text(maskedRut, rightX + 15, y);

  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Cargo:', leftX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(employee.position, leftX + 25, y);

  doc.setFont('helvetica', 'bold');
  doc.text('Contrato:', rightX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(contractLabels[employee.contractType] ?? employee.contractType, rightX + 25, y);

  return y + 10;
}

function addPdfFooter(doc: jsPDF): void {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(
    'Este documento es informativo y no constituye liquidación oficial de sueldo.',
    pageWidth / 2,
    pageHeight - 12,
    { align: 'center' }
  );

  const now = new Date();
  const timestamp = `Generado: ${now.toLocaleDateString('es-CL')} ${now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`;
  doc.text(timestamp, pageWidth / 2, pageHeight - 8, { align: 'center' });
}

// ─── Main Generator ─────────────────────────────────────────────────────────

/**
 * Generate a payroll slip PDF for one employee.
 * Downloads the file directly.
 */
export function generatePayrollSlipPDF(
  employee: EmployeeInfo,
  payroll: PayrollCalculation,
  period: PayrollPeriod
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  let y = addPdfHeader(doc, period);
  y = addEmployeeInfo(doc, employee, y);

  // ── HABERES (Earnings) ─────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text('HABERES', MARGIN, y);

  autoTable(doc, {
    startY: y + 2,
    head: [['Concepto', 'Monto']],
    body: [
      ['Sueldo Base', formatCLP(payroll.gross)],
    ],
    theme: 'striped',
    headStyles: {
      fillColor: [AMBER_R, AMBER_G, AMBER_B],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: { fontSize: 8, textColor: [50, 50, 50] },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: MARGIN, right: MARGIN },
  });

  y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20;
  y += 5;

  // ── DESCUENTOS (Deductions) ────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text('DESCUENTOS', MARGIN, y);

  const deductionRows: string[][] = [];

  if (payroll.contractType === 'honorarios') {
    deductionRows.push([
      `Retención Honorarios (${(payroll.afpRate || 13.75).toFixed(2)}%)`,
      formatCLP(payroll.impuestoUnico),
    ]);
  } else {
    if (payroll.afpDeduction > 0) {
      deductionRows.push([
        `AFP ${payroll.afpName} (${(payroll.afpRate * 100).toFixed(2)}%)`,
        formatCLP(payroll.afpDeduction),
      ]);
    }
    if (payroll.healthDeduction > 0) {
      deductionRows.push([
        'Salud (7,00%)',
        formatCLP(payroll.healthDeduction),
      ]);
    }
    if (payroll.impuestoUnico > 0) {
      deductionRows.push([
        `Impuesto Único (${payroll.taxBracketApplied})`,
        formatCLP(payroll.impuestoUnico),
      ]);
    }
  }

  if (payroll.otherDeductions > 0) {
    deductionRows.push([
      'Otros Descuentos',
      formatCLP(payroll.otherDeductions),
    ]);
  }

  deductionRows.push([
    'Total Descuentos',
    formatCLP(payroll.totalDeductions),
  ]);

  autoTable(doc, {
    startY: y + 2,
    head: [['Concepto', 'Monto']],
    body: deductionRows,
    theme: 'striped',
    headStyles: {
      fillColor: [AMBER_R, AMBER_G, AMBER_B],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: { fontSize: 8, textColor: [50, 50, 50] },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: MARGIN, right: MARGIN },
    didParseCell: (data) => {
      // Bold the total row
      if (data.row.index === deductionRows.length - 1) {
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 30;
  y += 8;

  // ── NET PAY (highlighted) ──────────────────────────────────────────────
  const pageWidth = doc.internal.pageSize.getWidth();
  const boxWidth = pageWidth - MARGIN * 2;

  doc.setFillColor(245, 240, 225);
  doc.roundedRect(MARGIN, y, boxWidth, 14, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text('SUELDO LÍQUIDO', MARGIN + 5, y + 9);

  doc.setFontSize(12);
  doc.setTextColor(AMBER_R, AMBER_G, AMBER_B);
  doc.text(formatCLP(payroll.net), pageWidth - MARGIN - 5, y + 9, { align: 'right' });

  y += 22;

  // ── EMPLOYER COSTS (informational) ─────────────────────────────────────
  if (payroll.contractType !== 'honorarios') {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('COSTO EMPLEADOR (Informativo)', MARGIN, y);

    const employerRows: string[][] = [
      ['AFC (Seguro de Cesantía)', formatCLP(payroll.employerAfc)],
      ['SIS (Seguro Invalidez y Sobrevivencia)', formatCLP(payroll.employerSis)],
      ['Mutual de Seguridad', formatCLP(payroll.employerMutual)],
      ['Costo Total Empleador', formatCLP(payroll.totalEmployerCost)],
    ];

    autoTable(doc, {
      startY: y + 2,
      head: [['Concepto', 'Monto']],
      body: employerRows,
      theme: 'striped',
      headStyles: {
        fillColor: [180, 180, 180],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
      },
      bodyStyles: { fontSize: 7, textColor: [100, 100, 100] },
      columnStyles: { 1: { halign: 'right' } },
      margin: { left: MARGIN, right: MARGIN },
      didParseCell: (data) => {
        if (data.row.index === employerRows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
  }

  addPdfFooter(doc);

  // Download
  const monthStr = String(period.month).padStart(2, '0');
  const safeName = employee.name.replace(/\s+/g, '_');
  const filename = `CASA_Liquidación_${safeName}_${period.year}_${monthStr}.pdf`;
  doc.save(filename);
}
