import { LucideIcon, ArrowUpRight, ArrowDownRight } from 'lucide-react';
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
  subtitle?: string;
}

export function StatCard({ title, value, icon: Icon, trend, className, subtitle }: StatCardProps) {
  return (
    <div className={cn("bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow", className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-slate-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          {subtitle && (
            <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className={cn(
              "mt-2 flex items-center gap-1 text-sm font-medium",
              trend.isPositive ? "text-green-600" : "text-red-600"
            )}>
              {trend.isPositive ? (
                <ArrowUpRight className="w-4 h-4" />
              ) : (
                <ArrowDownRight className="w-4 h-4" />
              )}
              <span>{trend.value}</span>
            </div>
          )}
        </div>
        <div className="w-12 h-12 bg-teal-50 rounded-lg flex items-center justify-center">
          <Icon className="w-6 h-6 text-teal-600" />
        </div>
      </div>
    </div>
  );
}

