import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, Download } from 'lucide-react';
import { paymentsApi } from '../../api/payments.api';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDate, formatCurrency, downloadBlob } from '../../utils/formatters';
import { toast } from 'sonner';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'TREASURER'];

export default function PaymentsPage() {
  const { user } = useAuthStore();
  const isAdmin = ADMIN_ROLES.includes(user?.role || '');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['payments', statusFilter, typeFilter, page, user?.memberId],
    queryFn: () => {
      if (isAdmin) {
        return paymentsApi.getAll({ status: statusFilter || undefined, type: typeFilter || undefined, page }).then((r) => r.data);
      }
      return paymentsApi.getAll({ status: statusFilter || undefined }).then((r) => r.data);
    },
  });

  const handleDownloadReceipt = async (id: string) => {
    try {
      const res = await paymentsApi.getReceipt(id);
      downloadBlob(res.data, `receipt-${id}.pdf`);
    } catch {
      toast.error('Receipt not available');
    }
  };

  const payments = data?.data || [];

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Payments</h1>
          <p className="text-sm text-slate-500 mt-1">{data?.meta?.total || 0} records</p>
        </div>
        {isAdmin && (
          <Button onClick={() => toast.info('Use Treasurer Dashboard for full management')} icon={<CreditCard size={16} />}>
            Record Payment
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input w-40">
          <option value="">All Status</option>
          {['PAID', 'PENDING', 'OVERDUE', 'PARTIAL'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {isAdmin && (
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input w-44">
            <option value="">All Types</option>
            {['MONTHLY_MEETING', 'SPECIAL_MEETING', 'COMMUNITY_EVENT', 'VOLUNTEER_EVENT', 'RELIGIOUS_EVENT', 'OTHER', 'CUSTOM'].map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-50 dark:bg-surface-800/50 border-b border-surface-200 dark:border-surface-700">
                {isAdmin && <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Member</th>}
                {['Type', 'Amount', 'Paid', 'Status', 'Due Date', 'Paid At', 'Receipt'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
              {payments.length > 0 ? payments.map((p: any) => (
                <tr key={p.id} className="hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors">
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{p.member?.fullName}</p>
                      <p className="text-xs text-slate-400 font-mono">{p.member?.membershipId}</p>
                    </td>
                  )}
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {p.type === 'CUSTOM' && p.customType ? p.customType : p.type?.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-3 font-semibold">{formatCurrency(Number(p.amount))}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatCurrency(Number(p.paidAmount))}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-3 text-slate-500">{p.dueDate ? formatDate(p.dueDate, 'PP') : '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{p.paidAt ? formatDate(p.paidAt, 'PP') : '—'}</td>
                  <td className="px-4 py-3">
                    {p.status === 'PAID' || p.status === 'PARTIAL' ? (
                      <Button variant="ghost" size="sm" icon={<Download size={14} />} onClick={() => handleDownloadReceipt(p.id)}>
                        PDF
                      </Button>
                    ) : '—'}
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={isAdmin ? 8 : 7}>
                  <EmptyState icon={CreditCard} title="No payments found" />
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        {data?.meta && (
          <div className="px-4 py-3 border-t border-surface-200 dark:border-surface-700 flex items-center justify-between">
            <p className="text-xs text-slate-500">Page {data.meta.page} of {data.meta.totalPages}</p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={!data.meta.hasPrev} onClick={() => setPage(p => p - 1)}>Prev</Button>
              <Button variant="secondary" size="sm" disabled={!data.meta.hasNext} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
