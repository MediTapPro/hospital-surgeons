import { LucideIcon } from 'lucide-react';
import { cn } from '../_lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  className?: string;
}

export function StatCard({ title, value, icon: Icon, trend, className }: StatCardProps) {
  return (
    <div className={cn("bg-white rounded-lg shadow p-6", className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-slate-600">{title}</p>
          <p className="mt-2">{value}</p>
          {trend && (
            <p className={cn(
              "mt-2",
              trend.isPositive ? "text-green-600" : "text-red-600"
            )}>
              {trend.value}
            </p>
          )}
        </div>
        <div className="w-12 h-12 bg-navy-50 rounded-lg flex items-center justify-center">
          <Icon className="w-6 h-6 text-navy-600" />
        </div>
      </div>
    </div>
  );
}
