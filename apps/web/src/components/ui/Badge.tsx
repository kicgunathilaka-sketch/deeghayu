import { cn } from '../../utils/cn';
import { statusColors } from '../../utils/formatters';

interface BadgeProps {
  status: string;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: BadgeProps) {
  return (
    <span className={cn('badge', statusColors[status] || 'bg-slate-100 text-slate-600', className)}>
      {label || status}
    </span>
  );
}

export function Badge({ children, variant = 'default', className }: {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  className?: string;
}) {
  const variants = {
    default: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    primary: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400',
    success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    danger: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  return (
    <span className={cn('badge', variants[variant], className)}>{children}</span>
  );
}
