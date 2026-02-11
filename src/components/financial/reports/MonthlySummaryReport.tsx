/**
 * MonthlySummaryReport — Monthly financial summary with tables and charts.
 */

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import type { MonthlySummaryReportData } from '@/lib/financial/financialQueries';

interface MonthlySummaryReportProps {
  data: MonthlySummaryReportData;
  year: number;
  month: number;
}

const chartConfig: ChartConfig = {
  amount: { label: 'Monto', color: '#ef4444' },
};

const MonthlySummaryReport = ({ data, year, month }: MonthlySummaryReportProps) => {
  const monthName = MONTH_LABELS_FULL[month - 1];

  // Previous month lookup map for comparisons
  const prevIncomeMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of data.previousMonth.incomeBreakdown) {
      map.set(item.category_name, item.total);
    }
    return map;
  }, [data.previousMonth.incomeBreakdown]);

  const prevExpenseMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of data.previousMonth.expenseBreakdown) {
      map.set(item.category_name, item.total);
    }
    return map;
  }, [data.previousMonth.expenseBreakdown]);

  // Top 10 expense categories for chart
  const top10Expenses = useMemo(() => {
    return data.expenseBreakdown.slice(0, 10).map((item) => ({
      name: item.category_name,
      amount: item.total,
    }));
  }, [data.expenseBreakdown]);

  function getChange(currentAmount: number, prevMap: Map<string, number>, categoryName: string): string {
    const prev = prevMap.get(categoryName);
    if (!prev || prev === 0) return '—';
    const change = Math.round(((currentAmount - prev) / prev) * 100);
    if (change === 0) return '—';
    return change > 0 ? `▲ ${change}%` : `▼ ${Math.abs(change)}%`;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">
        Informe Financiero Mensual — {monthName} {year}
      </h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-gray-500">Total Ingresos</p>
            <p className="text-2xl font-bold text-green-600">{formatCLP(data.totalIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-gray-500">Total Gastos</p>
            <p className="text-2xl font-bold text-red-600">{formatCLP(data.totalExpenses)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-gray-500">Balance</p>
            <p className={`text-2xl font-bold ${data.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {formatCLP(data.balance)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Income Breakdown */}
      {data.incomeBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Desglose de Ingresos</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">% del Total</TableHead>
                  <TableHead className="text-right">vs Mes Anterior</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.incomeBreakdown.map((item) => (
                  <TableRow key={item.category_id}>
                    <TableCell>{item.category_name}</TableCell>
                    <TableCell className="text-right">{formatCLP(item.total)}</TableCell>
                    <TableCell className="text-right">{item.percentage}%</TableCell>
                    <TableCell className="text-right">
                      {getChange(item.total, prevIncomeMap, item.category_name)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Expense Breakdown */}
      {data.expenseBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Desglose de Gastos</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">% del Total</TableHead>
                  <TableHead className="text-right">vs Mes Anterior</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.expenseBreakdown.map((item) => (
                  <TableRow key={item.category_id}>
                    <TableCell>{item.category_name}</TableCell>
                    <TableCell className="text-right">{formatCLP(item.total)}</TableCell>
                    <TableCell className="text-right">{item.percentage}%</TableCell>
                    <TableCell className="text-right">
                      {getChange(item.total, prevExpenseMap, item.category_name)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Top 10 Expense Categories Chart */}
      {top10Expenses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 10 Categorías de Gasto</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart data={top10Expenses} layout="vertical" barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(value: number) => {
                    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                    return String(value);
                  }}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                  width={120}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatCLP(value as number)}
                    />
                  }
                />
                <Bar dataKey="amount" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {data.incomeBreakdown.length === 0 && data.expenseBreakdown.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            No hay datos para {monthName} {year}.
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MonthlySummaryReport;
