/**
 * CategoryReport — Category-level analysis with trends and charts.
 */

import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
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
import { Badge } from '@/components/ui/badge';
import { formatCLP } from '@/types/financial';
import type { CategoryReportData } from '@/lib/financial/financialQueries';

interface CategoryReportProps {
  data: CategoryReportData;
  dateRange: string;
}

const COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
];

const lineChartConfig: ChartConfig = {
  amount: { label: 'Monto', color: '#3b82f6' },
};

const CategoryReport = ({ data, dateRange }: CategoryReportProps) => {
  // Pie chart data: total per category
  const pieData = useMemo(() => {
    return data.categories.map((cat, i) => ({
      name: cat.name,
      value: cat.monthlyData.reduce((sum, m) => sum + m.amount, 0),
      fill: COLORS[i % COLORS.length],
    }));
  }, [data.categories]);

  const pieChartConfig: ChartConfig = useMemo(() => {
    const config: ChartConfig = {};
    data.categories.forEach((cat, i) => {
      config[cat.name] = { label: cat.name, color: COLORS[i % COLORS.length] };
    });
    return config;
  }, [data.categories]);

  if (data.categories.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-gray-500">
          Seleccione categorías para generar el informe.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">
        Informe por Categoría — {dateRange}
      </h2>

      {/* Per-category analysis */}
      {data.categories.map((cat, idx) => (
        <Card key={cat.name}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{cat.name}</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  Promedio: {formatCLP(cat.average)}
                </Badge>
                <Badge
                  variant={
                    cat.trend === 'increasing' ? 'destructive' :
                    cat.trend === 'decreasing' ? 'default' :
                    'secondary'
                  }
                >
                  {cat.trend === 'increasing' ? '▲ En aumento' :
                   cat.trend === 'decreasing' ? '▼ En disminución' :
                   '● Estable'}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Line chart */}
            {cat.monthlyData.length > 1 && (
              <ChartContainer config={lineChartConfig} className="h-[200px] w-full">
                <LineChart data={cat.monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis
                    tickFormatter={(value: number) => {
                      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                      if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                      return String(value);
                    }}
                    tick={{ fontSize: 10 }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => formatCLP(value as number)}
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke={COLORS[idx % COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ChartContainer>
            )}

            {/* Data table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mes</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Cambio vs Mes Anterior</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cat.monthlyData.map((m) => (
                  <TableRow key={m.month}>
                    <TableCell>{m.month}</TableCell>
                    <TableCell className="text-right">{formatCLP(m.amount)}</TableCell>
                    <TableCell className="text-right">
                      {m.change === 0 ? '—' : (
                        <span className={m.change > 0 ? 'text-red-600' : 'text-green-600'}>
                          {m.change > 0 ? '▲' : '▼'} {Math.abs(m.change)}%
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {/* Pie chart: proportion of total spending */}
      {pieData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Proporción del Gasto Total</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={pieChartConfig} className="h-[300px] w-full">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry) => `${entry.name}: ${formatCLP(entry.value)}`}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={`cell-${i}`} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatCLP(value as number)}
                    />
                  }
                />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CategoryReport;
