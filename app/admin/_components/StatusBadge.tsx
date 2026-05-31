import { cn } from '../_lib/utils';

interface StatusBadgeProps {
  status: string;
  variant?: 'default' | 'small';
}

export function StatusBadge({ status, variant = 'default' }: StatusBadgeProps) {
  const getStatusColor = (status: string) => {
    const normalized = status.toLowerCase();
    if (normalized.includes('pending') || normalized.includes('waiting')) {
      return 'bg-amber-100 text-amber-700';
    }
    if (normalized.includes('active') || normalized.includes('verified') || 
        normalized.includes('approved') || normalized.includes('completed') || 
        normalized.includes('success')) {
      return 'bg-green-100 text-green-700';
    }
    if (normalized.includes('rejected') || normalized.includes('cancelled') || 
        normalized.includes('failed') || normalized.includes('critical')) {
      return 'bg-red-100 text-red-700';
    }
    if (normalized.includes('suspended') || normalized.includes('inactive')) {
      return 'bg-slate-100 text-slate-700';
    }
    if (normalized.includes('urgent') || normalized.includes('emergency')) {
      return 'bg-red-100 text-red-700';
    }
    if (normalized.includes('routine')) {
      return 'bg-blue-100 text-blue-700';
    }
    return 'bg-slate-100 text-slate-700';
  };

  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2.5 py-0.5",
      getStatusColor(status),
      variant === 'small' && "px-2 py-0"
    )}>
      {status}
    </span>
  );
}
