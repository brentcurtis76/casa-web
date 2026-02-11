/**
 * BudgetReport — Budget vs actual variance analysis with color-coded table.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { formatCLP, MONTH_LABELS_FULL } from '@/types/financial';
import BudgetVsActualChart from '@/components/financial/BudgetVsActualChart';
import type { BudgetReportData } from '@/lib/financial/financialQueries';

interface BudgetReportProps {
  data: BudgetReportData;
  year: number;
  month: number;
}

function getRowColor(percentage: number): string {
  if (percentage > 100) return 'bg-red-50';
  if (percentage >= 80) return 'bg-amber-50';
  return '';
}

function getProgressColor(percentage: number): string {
  if (percentage > 100) return 'bg-red-500';
  if (percentage >= 80) return 'bg-amber-500';
  return 'bg-green-500';
}

const BudgetReport = ({ data, year, month }: BudgetReportProps) => {
  const monthName = MONTH_LABELS_FULL[month - 1];

  // Convert to BudgetVsActualItem format for chart reuse
  const chartData = data.items.map((item) => ({
    category_id: item.categoryName,
    categoryName: item.categoryName,
    categoryType: 'expense' as const,
    budgeted: item.budgeted,
    actual: item.actual,
    difference: item.difference,
    percentage: item.percentage,
  }));

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">
        Informe Presupuesto vs Real — {monthName} {year}
      </h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-gray-500">Total Presupuesto</p>
            <p className="text-xl font-bold">{formatCLP(data.totalBudget)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-gray-500">Total Ejecutado</p>
            <p className="text-xl font-bold">{formatCLP(data.totalActual)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-gray-500">Diferencia</p>
            <p className={`text-xl font-bold ${data.totalDifference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCLP(data.totalDifference)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-gray-500">% Ejecutado</p>
            <p className="text-xl font-bold">{data.totalPercentage}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Variance Table */}
      {data.items.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalle por Categoría</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Presupuestado</TableHead>
                  <TableHead className="text-right">Ejecutado</TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead className="w-32">Progreso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item) => (
                  <TableRow key={item.categoryName} className={getRowColor(item.percentage)}>
                    <TableCell className="font-medium">{item.categoryName}</TableCell>
                    <TableCell className="text-right">{formatCLP(item.budgeted)}</TableCell>
                    <TableCell className="text-right">{formatCLP(item.actual)}</TableCell>
                    <TableCell className={`text-right ${item.difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCLP(item.difference)}
                    </TableCell>
                    <TableCell className="text-right">{item.percentage}%</TableCell>
                    <TableCell>
                      <div className="relative">
                        <Progress
                          value={Math.min(item.percentage, 100)}
                          className="h-2"
                        />
                        <div
                          className={`absolute inset-0 h-2 rounded-full ${getProgressColor(item.percentage)}`}
                          style={{ width: `${Math.min(item.percentage, 100)}%` }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            No hay datos de presupuesto para {monthName} {year}.
          </CardContent>
        </Card>
      )}

      {/* Chart */}
      {chartData.length > 0 && <BudgetVsActualChart data={chartData} />}

      {/* Auto-generated Notes */}
      {data.notes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Observaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.notes.map((note, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-amber-600 mt-0.5">•</span>
                  {note}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BudgetReport;
