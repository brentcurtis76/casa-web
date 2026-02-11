/**
 * FinancialReports — Report selector and configuration panel for the Reportes tab.
 *
 * Provides three report types with configurable date ranges and PDF export.
 */

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, FileDown, BarChart3, PieChart, Target } from 'lucide-react';
import { MONTH_LABELS_FULL } from '@/types/financial';
import {
  useMonthlySummaryReport,
  useCategoryReport,
  useBudgetReport,
  useActiveCategories,
} from '@/lib/financial/hooks';
import { downloadFinancialPDF } from '@/lib/financial/reportPdfGenerator';
import type { MonthlySummaryReportData, CategoryReportData, BudgetReportData } from '@/lib/financial/financialQueries';
import MonthlySummaryReport from './reports/MonthlySummaryReport';
import CategoryReport from './reports/CategoryReport';
import BudgetReport from './reports/BudgetReport';

type ReportType = 'monthly' | 'category' | 'budget';

interface FinancialReportsProps {
  canWrite: boolean;
}

const FinancialReports = ({ canWrite: _canWrite }: FinancialReportsProps) => {
  const now = new Date();
  const [reportType, setReportType] = useState<ReportType>('monthly');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [endYear, setEndYear] = useState(now.getFullYear());
  const [endMonth, setEndMonth] = useState(now.getMonth() + 1);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [generated, setGenerated] = useState(false);

  // Data hooks — only enabled when "generated" is true
  const monthlyReport = useMonthlySummaryReport(year, month, generated && reportType === 'monthly');
  const categoryReport = useCategoryReport(
    selectedCategories, year, month, endYear, endMonth,
    generated && reportType === 'category'
  );
  const budgetReport = useBudgetReport(year, month, generated && reportType === 'budget');

  // Categories list for the category report selector
  const { data: categories = [] } = useActiveCategories();

  const handleGenerate = useCallback(() => {
    setGenerated(true);
  }, []);

  const handleExportPdf = useCallback(() => {
    const config = { year, month, endYear, endMonth };

    if (reportType === 'monthly' && monthlyReport.data) {
      downloadFinancialPDF('monthly', monthlyReport.data, config);
    } else if (reportType === 'category' && categoryReport.data) {
      downloadFinancialPDF('category', categoryReport.data, config);
    } else if (reportType === 'budget' && budgetReport.data) {
      downloadFinancialPDF('budget', budgetReport.data, config);
    }
  }, [reportType, year, month, endYear, endMonth, monthlyReport.data, categoryReport.data, budgetReport.data]);

  const handleReportTypeChange = useCallback((value: string) => {
    setReportType(value as ReportType);
    setGenerated(false);
  }, []);

  const handleCategoryToggle = useCallback((categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
    setGenerated(false);
  }, []);

  const isLoading =
    (reportType === 'monthly' && monthlyReport.isLoading) ||
    (reportType === 'category' && categoryReport.isLoading) ||
    (reportType === 'budget' && budgetReport.isLoading);

  const hasData =
    (reportType === 'monthly' && monthlyReport.data) ||
    (reportType === 'category' && categoryReport.data) ||
    (reportType === 'budget' && budgetReport.data);

  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="space-y-6">
      {/* Report Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuración del Informe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Report Type Selector */}
          <RadioGroup
            value={reportType}
            onValueChange={handleReportTypeChange}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4"
          >
            <div>
              <RadioGroupItem value="monthly" id="monthly" className="peer sr-only" />
              <Label
                htmlFor="monthly"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <BarChart3 className="mb-3 h-6 w-6" />
                <span className="text-sm font-medium">Resumen Mensual</span>
              </Label>
            </div>

            <div>
              <RadioGroupItem value="category" id="category" className="peer sr-only" />
              <Label
                htmlFor="category"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <PieChart className="mb-3 h-6 w-6" />
                <span className="text-sm font-medium">Informe por Categoría</span>
              </Label>
            </div>

            <div>
              <RadioGroupItem value="budget" id="budget" className="peer sr-only" />
              <Label
                htmlFor="budget"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <Target className="mb-3 h-6 w-6" />
                <span className="text-sm font-medium">Presupuesto vs Real</span>
              </Label>
            </div>
          </RadioGroup>

          {/* Date Range Configuration */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label className="text-sm">{reportType === 'category' ? 'Desde — Año' : 'Año'}</Label>
              <Select value={String(year)} onValueChange={(v) => { setYear(Number(v)); setGenerated(false); }}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-sm">{reportType === 'category' ? 'Desde — Mes' : 'Mes'}</Label>
              <Select value={String(month)} onValueChange={(v) => { setMonth(Number(v)); setGenerated(false); }}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_LABELS_FULL.map((label, i) => (
                    <SelectItem key={i} value={String(i + 1)}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {reportType === 'category' && (
              <>
                <div className="space-y-1">
                  <Label className="text-sm">Hasta — Año</Label>
                  <Select value={String(endYear)} onValueChange={(v) => { setEndYear(Number(v)); setGenerated(false); }}>
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map((y) => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Hasta — Mes</Label>
                  <Select value={String(endMonth)} onValueChange={(v) => { setEndMonth(Number(v)); setGenerated(false); }}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTH_LABELS_FULL.map((label, i) => (
                        <SelectItem key={i} value={String(i + 1)}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          {/* Category Selector (for category report) */}
          {reportType === 'category' && (
            <div className="space-y-2">
              <Label className="text-sm">Categorías a analizar</Label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <Button
                    key={cat.id}
                    variant={selectedCategories.includes(cat.id) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleCategoryToggle(cat.id)}
                  >
                    {cat.name}
                  </Button>
                ))}
              </div>
              {selectedCategories.length === 0 && (
                <p className="text-sm text-gray-500">Seleccione al menos una categoría</p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleGenerate}
              disabled={isLoading || (reportType === 'category' && selectedCategories.length === 0)}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generar Informe
            </Button>

            {generated && hasData && (
              <Button variant="outline" onClick={handleExportPdf}>
                <FileDown className="mr-2 h-4 w-4" />
                Exportar PDF
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Report Content */}
      {generated && (
        <>
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          )}

          {reportType === 'monthly' && monthlyReport.data && (
            <MonthlySummaryReport
              data={monthlyReport.data}
              year={year}
              month={month}
            />
          )}

          {reportType === 'category' && categoryReport.data && (
            <CategoryReport
              data={categoryReport.data}
              dateRange={`${MONTH_LABELS_FULL[month - 1]} ${year} — ${MONTH_LABELS_FULL[endMonth - 1]} ${endYear}`}
            />
          )}

          {reportType === 'budget' && budgetReport.data && (
            <BudgetReport
              data={budgetReport.data as BudgetReportData}
              year={year}
              month={month}
            />
          )}
        </>
      )}
    </div>
  );
};

export default FinancialReports;
