/**
 * AnnualReport — Full-year financial report with monthly trends, category breakdowns,
 * optional budget comparison, and auto-generated notes.
 */

import { useMemo } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { formatCLP, MONTH_LABELS_FULL } from '@/types/financial';
import type { AnnualReportData } from '@/lib/financial/financialQueries';

interface AnnualReportProps {
  data: AnnualReportData;
  year: number;
}

const chartConfig: ChartConfig = {
  income: { label: 'Ingresos', color: '#22c55e' },
  expenses: { label: 'Gastos', color: '#ef4444' },
  balance: { label: 'Balance', color: '#3b82f6' },
};

const AnnualReport = ({ data, year }: AnnualReportProps) => {
  // Compute the date range string for partial years
  const dateRangeString = useMemo(() => {
    if (data.isPartialYear) {
      const lastMonth = MONTH_LABELS_FULL[data.lastMonthWithData - 1];
      return `Enero — ${lastMonth} (parcial)`;
    }
    return 'Enero — Diciembre';
  }, [data.isPartialYear, data.lastMonthWithData]);

  // Prepare chart data (only up to lastMonthWithData)
  const chartData = useMemo(() => {
    return data.monthlyData.map((item) => ({
      month: item.label,
      income: item.income,
      expenses: item.expenses,
      balance: item.balance,
    }));
  }, [data.monthlyData]);

  if (data.monthlyData.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-gray-500">
          No hay datos para {year}.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title + YTD Badge */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          Informe Financiero Anual — {year}
        </h2>
        {data.isPartialYear && (
          <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-300">
            {dateRangeString}
          </Badge>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-gray-500">Total Ingresos Anuales</p>
            <p className="text-2xl font-bold text-green-600">{formatCLP(data.totalIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-gray-500">Total Gastos Anuales</p>
            <p className="text-2xl font-bold text-red-600">{formatCLP(data.totalExpenses)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-gray-500">Balance Anual</p>
            <p className={`text-2xl font-bold ${data.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {formatCLP(data.balance)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tendencia Mensual</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 12 }}
                tickFormatter={(value: number) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(0)}M`;
                  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                  return String(value);
                }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12 }}
                tickFormatter={(value: number) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(0)}M`;
                  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                  return String(value);
                }}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => formatCLP(value as number)}
                  />
                }
              />
              <Legend />
              <Bar yAxisId="left" dataKey="income" fill="#22c55e" opacity={0.7} />
              <Bar yAxisId="left" dataKey="expenses" fill="#ef4444" opacity={0.7} />
              <Line yAxisId="right" type="monotone" dataKey="balance" stroke="#3b82f6" strokeWidth={2} />
            </ComposedChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Monthly Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Desglose Mensual</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mes</TableHead>
                <TableHead className="text-right">Ingresos</TableHead>
                <TableHead className="text-right">Gastos</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.monthlyData.map((item) => (
                <TableRow key={item.month} className={item.balance < 0 ? 'bg-red-50' : ''}>
                  <TableCell>{MONTH_LABELS_FULL[item.month - 1]}</TableCell>
                  <TableCell className="text-right">{formatCLP(item.income)}</TableCell>
                  <TableCell className="text-right">{formatCLP(item.expenses)}</TableCell>
                  <TableCell className={`text-right font-medium ${item.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    {formatCLP(item.balance)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Top Income Categories */}
      {data.topIncomeCategories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 10 Categorías de Ingresos</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Total Anual</TableHead>
                  <TableHead className="text-right">% del Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topIncomeCategories.map((item) => (
                  <TableRow key={item.category_id}>
                    <TableCell>{item.category_name}</TableCell>
                    <TableCell className="text-right">{formatCLP(item.total)}</TableCell>
                    <TableCell className="text-right">{item.percentage}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Top Expense Categories */}
      {data.topExpenseCategories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 10 Categorías de Gastos</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Total Anual</TableHead>
                  <TableHead className="text-right">% del Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topExpenseCategories.map((item) => (
                  <TableRow key={item.category_id}>
                    <TableCell>{item.category_name}</TableCell>
                    <TableCell className="text-right">{formatCLP(item.total)}</TableCell>
                    <TableCell className="text-right">{item.percentage}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Budget Comparison (conditional) */}
      {data.budgetComparison && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-gray-500">Presupuesto Anual</p>
                <p className="text-2xl font-bold text-amber-600">{formatCLP(data.budgetComparison.totalBudget)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-gray-500">Ejecutado</p>
                <p className="text-2xl font-bold text-blue-600">{formatCLP(data.budgetComparison.totalActual)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-gray-500">Diferencia</p>
                <p className={`text-2xl font-bold ${data.budgetComparison.totalDifference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCLP(data.budgetComparison.totalDifference)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-gray-500">% Ejecutado</p>
                <p className="text-2xl font-bold text-purple-600">{data.budgetComparison.totalPercentage}%</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Comparación Presupuesto vs Ejecutado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Presupuestado</TableHead>
                    <TableHead className="text-right">Ejecutado</TableHead>
                    <TableHead className="text-right">% Ejecutado</TableHead>
                    <TableHead>Progreso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.budgetComparison.items.map((item) => (
                    <TableRow key={item.category_id}>
                      <TableCell>{item.categoryName}</TableCell>
                      <TableCell className="text-right">{formatCLP(item.budgeted)}</TableCell>
                      <TableCell className="text-right">{formatCLP(item.actual)}</TableCell>
                      <TableCell className="text-right">{item.percentage}%</TableCell>
                      <TableCell>
                        <Progress value={Math.min(item.percentage, 100)} className="w-20" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* Notes/Observaciones */}
      {data.notes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Observaciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.notes.map((note, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-gray-400 mt-1">•</span>
                <p className="text-sm text-gray-700">{note}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AnnualReport;
