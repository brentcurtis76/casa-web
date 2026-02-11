/**
 * BudgetVsActualChart — Recharts grouped BarChart comparing
 * budgeted vs actual amounts per category.
 *
 * Uses shadcn ChartContainer wrapper for consistency with FinancialDashboard.
 */

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { formatCLP } from '@/types/financial';
import type { BudgetVsActualItem } from '@/lib/financial/budgetService';

// ─── Props ──────────────────────────────────────────────────────────────────

interface BudgetVsActualChartProps {
  data: BudgetVsActualItem[];
}

// ─── Chart Config ───────────────────────────────────────────────────────────

const chartConfig: ChartConfig = {
  budgeted: { label: 'Presupuesto', color: '#3b82f6' },
  actual: { label: 'Gastado', color: '#22c55e' },
};

// ─── Component ──────────────────────────────────────────────────────────────

const BudgetVsActualChart = ({ data }: BudgetVsActualChartProps) => {
  const chartData = useMemo(() => {
    return data.map((item) => ({
      name: item.categoryName,
      budgeted: item.budgeted,
      actual: item.actual,
      percentage: item.percentage,
      // Color the "actual" bar based on percentage
      actualFill:
        item.percentage > 100 ? '#ef4444' :
        item.percentage >= 80 ? '#f59e0b' :
        '#22c55e',
    }));
  }, [data]);

  if (chartData.length === 0) return null;

  // Calculate chart width based on number of categories
  const minWidth = Math.max(chartData.length * 80, 400);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Presupuesto vs Ejecución</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div style={{ minWidth: `${minWidth}px` }}>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart data={chartData} barGap={2} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  angle={-30}
                  textAnchor="end"
                  height={60}
                  interval={0}
                />
                <YAxis
                  tickFormatter={(value: number) => {
                    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                    return String(value);
                  }}
                  tick={{ fontSize: 11 }}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatCLP(value as number)}
                    />
                  }
                />
                <Bar
                  dataKey="budgeted"
                  name="Presupuesto"
                  fill="#3b82f6"
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  dataKey="actual"
                  name="Gastado"
                  radius={[2, 2, 0, 0]}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`actual-${index}`} fill={entry.actualFill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BudgetVsActualChart;
