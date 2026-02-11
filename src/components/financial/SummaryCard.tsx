/**
 * SummaryCard — Reusable metric card for the financial dashboard.
 *
 * Displays an icon, title, formatted CLP value, and optional color class.
 * Uses shadcn Card component.
 */

import { type LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatCLP } from '@/types/financial';
import { cn } from '@/lib/utils';

interface SummaryCardProps {
  title: string;
  amount: number;
  icon: LucideIcon;
  colorClass?: string;
  iconColorClass?: string;
}

const SummaryCard = ({
  title,
  amount,
  icon: Icon,
  colorClass = 'text-foreground',
  iconColorClass = 'text-muted-foreground',
}: SummaryCardProps) => {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={cn('text-2xl font-bold', colorClass)}>
              {formatCLP(amount)}
            </p>
          </div>
          <div className={cn('rounded-full p-3 bg-muted', iconColorClass)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SummaryCard;
