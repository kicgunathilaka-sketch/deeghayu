import { format, formatDistanceToNow } from 'date-fns';

export const formatDate = (date: string | Date, fmt = 'PPP') =>
  format(new Date(date), fmt);

export const formatDateTime = (date: string | Date) =>
  format(new Date(date), 'PPp');

export const formatRelative = (date: string | Date) =>
  formatDistanceToNow(new Date(date), { addSuffix: true });

export const formatCurrency = (amount: number, currency = 'Rs.') =>
  `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

export const formatRole = (role: string) =>
  role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const statusColors: Record<string, string> = {
  // Member
  ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  INACTIVE: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  SUSPENDED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  DECEASED: 'bg-slate-200 text-slate-500',
  // Payment
  PAID: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  OVERDUE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  PARTIAL: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  WAIVED: 'bg-purple-100 text-purple-700',
  // Event
  DRAFT: 'bg-slate-100 text-slate-600',
  PUBLISHED: 'bg-blue-100 text-blue-700',
  ONGOING: 'bg-emerald-100 text-emerald-700',
  COMPLETED: 'bg-slate-100 text-slate-500',
  CANCELLED: 'bg-red-100 text-red-700',
};

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
