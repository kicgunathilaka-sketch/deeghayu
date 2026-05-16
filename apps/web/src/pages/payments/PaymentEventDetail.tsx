import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { paymentEventsApi } from '../../api/paymentEvents.api';
import { paymentsApi } from '../../api/payments.api';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { toast } from 'sonner';

interface Props {
  eventId: string;
  onClose: () => void;
}

export function PaymentEventDetail({ eventId, onClose }: Props) {
  const qc = useQueryClient();
  const [paying, setPaying] = useState<Record<string, string>>({}); // paymentId -> entered amount

  const { data, isLoading } = useQuery({
    queryKey: ['payment-event', eventId],
    queryFn: () => paymentEventsApi.getById(eventId).then((r) => r.data.data),
  });

  const payMutation = useMutation({
    mutationFn: ({ paymentId, paidAmount }: { paymentId: string; paidAmount: number }) =>
      paymentsApi.update(paymentId, { paidAmount }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-event', eventId] });
      qc.invalidateQueries({ queryKey: ['active-payment-events'] });
      qc.invalidateQueries({ queryKey: ['payment-summary'] });
      qc.invalidateQueries({ queryKey: ['bank-accounts'] });
      qc.invalidateQueries({ queryKey: ['member'] });
      qc.invalidateQueries({ queryKey: ['member-arrears'] });
      toast.success('Payment recorded');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to record payment';
      const status = err?.response?.status;
      toast.error(status ? `${msg} (${status})` : msg);
    },
  });

  if (isLoading || !data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white dark:bg-surface-900 rounded-2xl p-8">
          <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto" />
        </div>
      </div>
    );
  }

  const event = data;
  const unpaidCount = event.totalCount - event.paidCount;
  const progress = event.totalCount > 0 ? (event.paidCount / event.totalCount) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8 px-4">
      <div className="bg-white dark:bg-surface-900 rounded-2xl shadow-2xl w-full max-w-3xl">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-surface-200 dark:border-surface-700">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{event.title}</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {event.type?.replace(/_/g, ' ')} · Rs. {Number(event.amount).toLocaleString()} · Due {formatDate(event.dueDate, 'PPp')}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1">
            <X size={20} />
          </button>
        </div>

        {/* Progress */}
        <div className="px-6 py-4 border-b border-surface-200 dark:border-surface-700">
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-emerald-600">{event.paidCount}</span> of {event.totalCount} members paid
            </span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {formatCurrency(Number(event.collectedAmount))} collected
            </span>
          </div>
          <div className="w-full h-2 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
            <div
              className="h-2 bg-emerald-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex gap-4 mt-2 text-xs text-slate-500">
            <span className="flex items-center gap-1"><CheckCircle size={12} className="text-emerald-500" /> {event.paidCount} Paid</span>
            <span className="flex items-center gap-1"><AlertTriangle size={12} className="text-red-500" /> {event.overdueCount} Overdue</span>
            <span className="flex items-center gap-1"><Clock size={12} className="text-amber-500" /> {unpaidCount - (event.overdueCount || 0)} Pending</span>
          </div>
        </div>

        {/* Member payment list */}
        <div className="overflow-y-auto max-h-[60vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-50 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700">
              <tr>
                {['Member', 'Status', 'Paid / Due', 'Record Payment'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
              {event.payments?.map((p: any) => {
                const isPaid = p.status === 'PAID' || p.status === 'WAIVED';
                return (
                  <tr key={p.id} className={`hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors ${isPaid ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{p.member.fullName}</p>
                      <p className="text-xs text-slate-400 font-mono">{p.member.membershipId}</p>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {formatCurrency(Number(p.paidAmount))} / {formatCurrency(Number(p.amount))}
                    </td>
                    <td className="px-4 py-3">
                      {isPaid ? (
                        <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                          <CheckCircle size={13} /> {p.paidAt ? formatDate(p.paidAt, 'PP') : 'Paid'}
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max={Number(p.amount) - Number(p.paidAmount)}
                            placeholder={`Max ${Number(p.amount) - Number(p.paidAmount)}`}
                            value={paying[p.id] ?? ''}
                            onChange={(e) => setPaying((prev) => ({ ...prev, [p.id]: e.target.value }))}
                            className="input w-28 py-1.5 text-sm"
                          />
                          <Button
                            size="sm"
                            disabled={!paying[p.id] || payMutation.isPending}
                            loading={payMutation.isPending}
                            onClick={() => {
                              const amount = Number(paying[p.id]);
                              if (amount <= 0) return;
                              payMutation.mutate({ paymentId: p.id, paidAmount: amount });
                              setPaying((prev) => { const n = { ...prev }; delete n[p.id]; return n; });
                            }}
                          >
                            Pay
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-surface-200 dark:border-surface-700 flex justify-end">
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
