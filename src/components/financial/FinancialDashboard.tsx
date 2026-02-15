/**
 * FinancialDashboard — Resumen tab content.
 *
 * Displays 4 summary cards, month/year selector, 6-month bar chart,
 * expense pie chart, recent transactions list, and quick action buttons.
 */

import { useState } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Scale,
  Wallet,
  Plus,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import SummaryCard from './SummaryCard';
import { formatCLP, MONTH_LABELS_FULL } from '@/types/financial';
import {
  useMonthlySummary,
  useCategoryBreakdown,
  useMonthlyTrend,
  useRecentTransactions,
  useRemainingBudget,
} from '@/lib/financial/hooks';

// ─── Constants ──────────────────────────────────────────────────────────────

const PIE_COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#64748b',
];

const barChartConfig: ChartConfig = {
  income: { label: 'Ingresos', color: '#22c55e' },
  expenses: { label: 'Gastos', color: '#ef4444' },
};

// ─── Props ──────────────────────────────────────────────────────────────────

interface FinancialDashboardProps {
  canWrite: boolean;
  onNavigateToTransactions: () => void;
  onNewTransaction?: (type: 'income' | 'expense') => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

const FinancialDashboard = ({
  canWrite,
  onNavigateToTransactions,
  onNewTransaction,
}: FinancialDashboardProps) => {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  // Data hooks
  const { data: summary, isLoading: summaryLoading } = useMonthlySummary(
    selectedYear,
    selectedMonth
  );
  const { data: breakdown, isLoading: breakdownLoading } = useCategoryBreakdown(
    selectedYear,
    selectedMonth,
    'expense'
  );
  const { data: trend, isLoading: trendLoading } = useMonthlyTrend(6);
  const { data: recentTx, isLoading: recentLoading } = useRecentTransactions(10);
  const { data: remainingBudget } = useRemainingBudget(selectedYear, selectedMonth);

  // Year range
  const currentYear = now.getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  // Pie chart config built from breakdown data
  const pieConfig: ChartConfig = {};
  if (breakdown) {
    breakdown.forEach((item, idx) => {
      pieConfig[item.category_name] = {
        label: item.category_name,
        color: PIE_COLORS[idx % PIE_COLORS.length],
      };
    });
  }

  return (
    <div className="space-y-6">
      {/* Month/Year Selector */}
      <div className="flex items-center gap-3">
        <Select
          value={String(selectedMonth)}
          onValueChange={(val) => setSelectedMonth(Number(val))}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTH_LABELS_FULL.map((label, idx) => (
              <SelectItem key={idx} value={String(idx + 1)}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={String(selectedYear)}
          onValueChange={(val) => setSelectedYear(Number(val))}
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {canWrite && (
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-green-600 border-green-200 hover:bg-green-50"
              onClick={() => onNewTransaction?.('income')}
            >
              <Plus className="h-4 w-4 mr-1" />
              Nuevo Ingreso
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => onNewTransaction?.('expense')}
            >
              <Plus className="h-4 w-4 mr-1" />
              Nuevo Gasto
            </Button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div aria-live="polite" aria-busy={summaryLoading}>
        {summaryLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            title="Ingresos del Mes"
            amount={summary?.totalIncome ?? 0}
            icon={TrendingUp}
            colorClass="text-green-600"
            iconColorClass="text-green-600"
          />
          <SummaryCard
            title="Gastos del Mes"
            amount={summary?.totalExpenses ?? 0}
            icon={TrendingDown}
            colorClass="text-red-600"
            iconColorClass="text-red-600"
          />
          <SummaryCard
            title="Balance"
            amount={summary?.balance ?? 0}
            icon={Scale}
            colorClass="text-blue-600"
            iconColorClass="text-blue-600"
          />
          <SummaryCard
            title="Presupuesto Restante"
            amount={remainingBudget ?? 0}
            icon={Wallet}
            colorClass="text-amber-600"
            iconColorClass="text-amber-600"
          />
        </div>
        )}
      </div>

      {/* Charts Row */}
      <div aria-live="polite" aria-busy={trendLoading || breakdownLoading} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart — 6-month trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ingresos vs Gastos (6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            {trendLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : (
              <ChartContainer config={barChartConfig} className="h-[250px] w-full">
                <BarChart data={trend ?? []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => formatCLP(v)}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => (
                          <span>
                            {name === 'income' ? 'Ingresos' : 'Gastos'}:{' '}
                            {formatCLP(value as number)}
                          </span>
                        )}
                      />
                    }
                  />
                  <Bar dataKey="income" fill="var(--color-income)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Pie Chart — Expense breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Desglose de Gastos</CardTitle>
          </CardHeader>
          <CardContent>
            {breakdownLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : !breakdown || breakdown.length === 0 ? (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                Sin gastos para este período
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <ChartContainer config={pieConfig} className="h-[200px] w-full max-w-[300px]">
                  <PieChart>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, name) => (
                            <span>
                              {String(name)}: {formatCLP(value as number)}
                            </span>
                          )}
                        />
                      }
                    />
                    <Pie
                      data={breakdown}
                      dataKey="total"
                      nameKey="category_name"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                    >
                      {breakdown.map((_, idx) => (
                        <Cell
                          key={idx}
                          fill={PIE_COLORS[idx % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                {/* Legend */}
                <div className="mt-3 flex flex-wrap gap-2 justify-center">
                  {breakdown.map((item, idx) => (
                    <div key={item.category_id} className="flex items-center gap-1.5 text-xs">
                      <div
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                      />
                      <span className="text-muted-foreground">
                        {item.category_name} ({item.percentage}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <div aria-live="polite" aria-busy={recentLoading}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Transacciones Recientes</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onNavigateToTransactions}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Ver todas
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !recentTx || recentTx.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Sin transacciones recientes
            </div>
          ) : (
            <div className="space-y-2">
              {recentTx.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{tx.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{tx.date}</span>
                        {tx.category_name && (
                          <Badge variant="secondary" className="text-xs">
                            {tx.category_name}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`text-sm font-mono font-medium whitespace-nowrap ml-4 ${
                      tx.type === 'income' ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {tx.type === 'income' ? '+' : '-'}{formatCLP(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FinancialDashboard;
