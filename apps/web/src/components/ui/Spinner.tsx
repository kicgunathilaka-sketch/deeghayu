import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

export function Spinner({ className, size = 20 }: { className?: string; size?: number }) {
  return <Loader2 size={size} className={cn('animate-spin text-primary-600', className)} />;
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <Spinner size={36} className="mx-auto mb-3" />
        <p className="text-sm text-slate-400">Loading...</p>
      </div>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="card p-5 animate-pulse">
      <div className="h-4 bg-surface-200 dark:bg-surface-700 rounded w-1/3 mb-3" />
      <div className="h-8 bg-surface-200 dark:bg-surface-700 rounded w-1/2 mb-2" />
      <div className="h-3 bg-surface-200 dark:bg-surface-700 rounded w-2/3" />
    </div>
  );
}
