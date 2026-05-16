import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DollarSign, AlertTriangle, Plus, Send, Users, User } from 'lucide-react';
import { paymentsApi } from '../../api/payments.api';
import { membersApi } from '../../api/members.api';
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

  const [scope, setScope] = useState<'individual' | 'all'>('individual');

  const addPaymentMutation = useMutation({
    mutationFn: (data: any) =>
      scope === 'all'
        ? paymentsApi.bulkCreate(data)
        : paymentsApi.create(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['payment-summary'] });
      qc.invalidateQueries({ queryKey: ['overdue-payments'] });
      setShowAddModal(false);
      resetForm();
      if (scope === 'all') {
        const { created, skipped } = res.data.data;
        toast.success(`Created ${created} payment(s)${skipped ? `, skipped ${skipped} already recorded` : ''}`);
      } else {
        toast.success('Payment recorded');
      }
    },
    onError: () => toast.error('Failed to record payment'),
  });

  const reminderMutation = useMutation({
    mutationFn: (ids: string[]) => paymentsApi.sendBulkReminders(ids),
    onSuccess: (res) => toast.success(`${res.data.data.sent} reminders sent`),
    onError: () => toast.error('Failed to send reminders'),
  });

  const { register, handleSubmit, reset, setValue, watch } = useForm();
  const paymentType = watch('type');
  const watchedDueDate = watch('dueDate');

  useEffect(() => {
    if (watchedDueDate) {
      const d = new Date(watchedDueDate);
      if (!isNaN(d.getTime())) {
        setValue('month', d.getMonth() + 1);
        setValue('year', d.getFullYear());
      }
    }
  }, [watchedDueDate, setValue]);

  const [memberQuery, setMemberQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedMember, setSelectedMember] = useState<{ id: string; fullName: string; membershipId: string } | null>(null);
  const memberRef = useRef<HTMLDivElement>(null);

  const { data: memberSuggestions } = useQuery({
    queryKey: ['member-search', memberQuery],
    queryFn: () => membersApi.getAll({ search: memberQuery, limit: 8 }).then((r) => r.data.data),
    enabled: memberQuery.length >= 1 && !selectedMember,
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (memberRef.current && !memberRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMemberSelect = (member: { id: string; fullName: string; membershipId: string }) => {
    setSelectedMember(member);
    setMemberQuery('');
    setShowSuggestions(false);
    setValue('memberId', member.id, { shouldValidate: true });
  };

  const clearMember = () => {
    setSelectedMember(null);
    setMemberQuery('');
    setValue('memberId', '');
  };

  const resetForm = () => {
    reset();
    setSelectedMember(null);
    setMemberQuery('');
    setScope('individual');
  };

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
      <Modal isOpen={showAddModal} onClose={() => { setShowAddModal(false); resetForm(); }} title="Record Payment">
        <form onSubmit={handleSubmit((data) => {
          if (scope === 'all') {
            addPaymentMutation.mutate({ scope: 'ALL', ...data });
          } else {
            addPaymentMutation.mutate(data);
          }
        })} className="space-y-4">

          {/* Scope toggle */}
          <div className="flex rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden">
            <button
              type="button"
              onClick={() => setScope('individual')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                scope === 'individual'
                  ? 'bg-primary-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-surface-50 dark:hover:bg-surface-800'
              }`}
            >
              <User size={15} /> Individual Member
            </button>
            <button
              type="button"
              onClick={() => setScope('all')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                scope === 'all'
                  ? 'bg-primary-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-surface-50 dark:hover:bg-surface-800'
              }`}
            >
              <Users size={15} /> All Active Members
            </button>
          </div>

          {scope === 'all' && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-700 dark:text-amber-400 text-xs">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              Creates a pending payment for every active member. Members already recorded for this type/month/year are skipped. Once the due date passes, all unpaid become overdue.
            </div>
          )}

          {/* Member autocomplete — individual only */}
          {scope === 'individual' && (
            <div ref={memberRef} className="relative w-full">
              <label className="label">Member</label>
              <input type="hidden" {...register('memberId', { required: scope === 'individual' })} />
              {selectedMember ? (
                <div className="input flex items-center justify-between">
                  <span className="text-slate-900 dark:text-slate-100 text-sm">
                    {selectedMember.fullName}
                    <span className="ml-2 text-xs text-slate-400">{selectedMember.membershipId}</span>
                  </span>
                  <button type="button" onClick={clearMember} className="text-slate-400 hover:text-slate-600 text-xs ml-2">✕</button>
                </div>
              ) : (
                <input
                  className="input"
                  placeholder="Search by name or member ID..."
                  value={memberQuery}
                  onChange={(e) => { setMemberQuery(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                />
              )}
              {showSuggestions && !selectedMember && (memberSuggestions?.length ?? 0) > 0 && (
                <ul className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                  {memberSuggestions!.map((m: any) => (
                    <li
                      key={m.id}
                      onMouseDown={() => handleMemberSelect({ id: m.id, fullName: m.fullName, membershipId: m.membershipId })}
                      className="px-4 py-2.5 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-700 flex items-center justify-between"
                    >
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{m.fullName}</span>
                      <span className="text-xs text-slate-400">{m.membershipId}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <Select label="Payment Type" options={[
            { value: 'MONTHLY_MEETING', label: 'Monthly Meeting' },
            { value: 'SPECIAL_MEETING', label: 'Special Meeting' },
            { value: 'COMMUNITY_EVENT', label: 'Community Event' },
            { value: 'VOLUNTEER_EVENT', label: 'Volunteer Event' },
            { value: 'RELIGIOUS_EVENT', label: 'Religious Event' },
            { value: 'OTHER', label: 'Other' },
            { value: 'CUSTOM', label: 'Custom' },
          ]} {...register('type', { required: true })} />

          {paymentType === 'CUSTOM' && (
            <Input label="Custom Type" placeholder="e.g. Annual Subscription" {...register('customType', { required: true })} />
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input label="Amount (Rs.)" type="number" step="0.01" {...register('amount', { required: true })} />
            {scope === 'individual' && (
              <Input label="Paid Amount" type="number" step="0.01" placeholder="Leave blank = fully paid" {...register('paidAmount')} />
            )}
          </div>

          {/* Due date — auto-fills month/year */}
          <div>
            <Input
              label={scope === 'all' ? 'Due Date & Time (payment deadline)' : 'Due Date & Time (optional)'}
              type="datetime-local"
              {...register('dueDate', { required: scope === 'all' })}
            />
            <p className="text-xs text-slate-400 mt-1">Month and year are auto-filled from this date</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Month" type="number" min="1" max="12" defaultValue={month} {...register('month')} />
            <Input label="Year" type="number" defaultValue={year} {...register('year')} />
          </div>

          <Input label="Description" placeholder="Optional note" {...register('description')} />

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={() => { setShowAddModal(false); resetForm(); }}>Cancel</Button>
            <Button type="submit" loading={addPaymentMutation.isPending}>
              {scope === 'all' ? 'Create for All Members' : 'Record Payment'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
