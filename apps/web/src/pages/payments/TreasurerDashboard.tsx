import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DollarSign, AlertTriangle, Plus, Send } from 'lucide-react';
import { paymentsApi } from '../../api/payments.api';
import { Button } from '../../components/ui/Button';
import { StatCard } from '../../components/ui/StatCard';
import { StatusBadge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input, Select } from '../../components/ui/Input';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function TreasurerDashboardPage() {
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  const qc = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedOverdue, setSelectedOverdue] = useState<string[]>([]);

  const { data: summary } = useQuery({
    queryKey: ['payment-summary', year],
    queryFn: () => paymentsApi.getSummary(year).then((r) => r.data.data),
  });

  const { data: analytics } = useQuery({
    queryKey: ['payment-analytics', year],
    queryFn: () => paymentsApi.getAnalytics(year).then((r) => r.data.data),
  });

  const { data: overdueData } = useQuery({
    queryKey: ['overdue-payments'],
    queryFn: () => paymentsApi.getOverdue().then((r) => r.data.data),
  });

  const addPaymentMutation = useMutation({
    mutationFn: (data: any) => paymentsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-summary'] });
      setShowAddModal(false);
      toast.success('Payment recorded');
    },
    onError: () => toast.error('Failed to record payment'),
  });

  const reminderMutation = useMutation({
    mutationFn: (ids: string[]) => paymentsApi.sendBulkReminders(ids),
    onSuccess: (res) => toast.success(`${res.data.data.sent} reminders sent`),
    onError: () => toast.error('Failed to send reminders'),
  });

  const { register, handleSubmit, reset } = useForm();

  const chartData = analytics?.map((d: any) => ({ name: MONTHS[d.month - 1], income: d.income })) || [];

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Treasurer Dashboard</h1>
        <Button icon={<Plus size={16} />} onClick={() => setShowAddModal(true)}>Record Payment</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Income" value={formatCurrency(Number(summary?.totalIncome || 0))} subtitle={String(year)} icon={DollarSign} iconBg="bg-emerald-100 dark:bg-emerald-900/30" iconColor="text-emerald-600" />
        <StatCard title="Pending" value={summary?.pendingCount || 0} subtitle="payments" icon={AlertTriangle} iconBg="bg-amber-100 dark:bg-amber-900/30" iconColor="text-amber-600" />
        <StatCard title="Overdue" value={summary?.overdueCount || 0} subtitle="payments" icon={AlertTriangle} iconBg="bg-red-100 dark:bg-red-900/30" iconColor="text-red-600" />
      </div>

      {/* Income Chart */}
      <div className="card p-5">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">Monthly Income — {year}</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: any) => [`Rs. ${Number(v).toLocaleString()}`, 'Income']} />
            <Bar dataKey="income" fill="#0284c7" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Overdue Payments */}
      {(overdueData?.length || 0) > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-surface-200 dark:border-surface-700">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">Overdue Payments ({overdueData?.length})</h2>
            <Button
              size="sm"
              variant="secondary"
              icon={<Send size={14} />}
              disabled={selectedOverdue.length === 0}
              onClick={() => reminderMutation.mutate(selectedOverdue)}
              loading={reminderMutation.isPending}
            >
              Send Reminders ({selectedOverdue.length})
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-50 dark:bg-surface-800/50 border-b border-surface-200 dark:border-surface-700">
                  <th className="px-4 py-2.5 text-left"><input type="checkbox" onChange={(e) => {
                    if (e.target.checked) setSelectedOverdue(overdueData?.map((p: any) => p.id) || []);
                    else setSelectedOverdue([]);
                  }} /></th>
                  {['Member', 'Amount', 'Due Date', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                {overdueData?.map((p: any) => (
                  <tr key={p.id} className="hover:bg-surface-50 dark:hover:bg-surface-800">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedOverdue.includes(p.id)}
                        onChange={(e) => setSelectedOverdue(e.target.checked ? [...selectedOverdue, p.id] : selectedOverdue.filter((id) => id !== p.id))} />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{p.member?.fullName}</p>
                      <p className="text-xs text-slate-400">{p.member?.membershipId}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold">{formatCurrency(Number(p.amount))}</td>
                    <td className="px-4 py-3 text-red-500">{p.dueDate ? formatDate(p.dueDate, 'PP') : '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Payment Modal */}
      <Modal isOpen={showAddModal} onClose={() => { setShowAddModal(false); reset(); }} title="Record Payment">
        <form onSubmit={handleSubmit((data) => addPaymentMutation.mutate(data))} className="space-y-4">
          <Input label="Member ID" placeholder="DC-XXXX or UUID" {...register('memberId', { required: true })} />
          <Select label="Payment Type" options={[
            { value: 'MONTHLY_FEE', label: 'Monthly Fee' },
            { value: 'JOINING_FEE', label: 'Joining Fee' },
            { value: 'EVENT_PAYMENT', label: 'Event Payment' },
            { value: 'DONATION', label: 'Donation' },
            { value: 'CUSTOM', label: 'Custom' },
          ]} {...register('type', { required: true })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Amount (Rs.)" type="number" step="0.01" {...register('amount', { required: true })} />
            <Input label="Paid Amount" type="number" step="0.01" {...register('paidAmount')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Month" type="number" min="1" max="12" {...register('month')} />
            <Input label="Year" type="number" defaultValue={year} {...register('year')} />
          </div>
          <Input label="Description" placeholder="Optional note" {...register('description')} />
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={() => { setShowAddModal(false); reset(); }}>Cancel</Button>
            <Button type="submit" loading={addPaymentMutation.isPending}>Record</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
