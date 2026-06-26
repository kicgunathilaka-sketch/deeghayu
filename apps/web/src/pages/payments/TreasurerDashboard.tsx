import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DollarSign, AlertTriangle, Plus, Send, CalendarClock, ChevronRight, Landmark, ArrowDownLeft, ArrowUpRight, List, X, FileDown } from 'lucide-react';
import { paymentsApi } from '../../api/payments.api';
import { paymentEventsApi } from '../../api/paymentEvents.api';
import { membersApi } from '../../api/members.api';
import { bankAccountsApi } from '../../api/bankAccounts.api';
import { reportsApi } from '../../api/reports.api';
import { downloadBlob } from '../../utils/formatters';
import { Button } from '../../components/ui/Button';
import { StatCard } from '../../components/ui/StatCard';
import { StatusBadge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input, Select } from '../../components/ui/Input';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PaymentEventDetail } from './PaymentEventDetail';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function TreasurerDashboardPage() {
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  const qc = useQueryClient();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [selectedOverdue, setSelectedOverdue] = useState<string[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [txAccountId, setTxAccountId] = useState<string | null>(null);
  const [reportMonth, setReportMonth] = useState(month);
  const [reportYear, setReportYear] = useState(year);
  const [downloadingReport, setDownloadingReport] = useState(false);

  const handleDownloadMonthlyReport = async () => {
    setDownloadingReport(true);
    try {
      const res = await reportsApi.getMonthlyReport(reportYear, reportMonth);
      const monthName = ['January','February','March','April','May','June','July','August','September','October','November','December'][reportMonth - 1];
      downloadBlob(res.data, `financial-report-${monthName}-${reportYear}.pdf`);
    } catch {
      toast.error('Failed to generate report');
    } finally {
      setDownloadingReport(false);
    }
  };

  // ── Queries ──────────────────────────────────────────────────────────────
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

  const { data: activeEvents } = useQuery({
    queryKey: ['active-payment-events'],
    queryFn: () => paymentEventsApi.getActive().then((r) => r.data.data),
    refetchInterval: 30_000,
  });

  const { data: bankAccounts } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: () => bankAccountsApi.getAll().then((r) => r.data.data),
  });

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ['bank-account-transactions', txAccountId],
    queryFn: () => bankAccountsApi.getTransactions(txAccountId!).then((r) => r.data.data),
    enabled: !!txAccountId,
    staleTime: 0,
  });

  // ── Bank account mutation ─────────────────────────────────────────────────
  const { register: regAcct, handleSubmit: handleAcct, reset: resetAcct } = useForm();
  const createAccountMutation = useMutation({
    mutationFn: (data: any) => bankAccountsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-accounts'] });
      setShowAccountModal(false);
      resetAcct();
      toast.success('Bank account created');
    },
    onError: () => toast.error('Failed to create bank account'),
  });

  // ── Individual payment mutation ───────────────────────────────────────────
  const addPaymentMutation = useMutation({
    mutationFn: (data: any) => paymentsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-summary'] });
      qc.invalidateQueries({ queryKey: ['overdue-payments'] });
      qc.invalidateQueries({ queryKey: ['bank-accounts'] });
      qc.invalidateQueries({ queryKey: ['member'] });
      qc.invalidateQueries({ queryKey: ['member-arrears'] });
      setShowAddModal(false);
      resetPaymentForm();
      toast.success('Payment recorded');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to record payment';
      toast.error(msg);
    },
  });

  // ── Payment event mutation ────────────────────────────────────────────────
  const createEventMutation = useMutation({
    mutationFn: (data: any) => paymentEventsApi.create(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['active-payment-events'] });
      qc.invalidateQueries({ queryKey: ['payment-summary'] });
      setShowEventModal(false);
      resetEventForm();
      toast.success(`Payment event created for ${res.data.data.memberCount} members`);
    },
    onError: () => toast.error('Failed to create payment event'),
  });

  const reminderMutation = useMutation({
    mutationFn: (ids: string[]) => paymentsApi.sendBulkReminders(ids),
    onSuccess: (res) => toast.success(`${res.data.data.sent} reminders sent`),
    onError: () => toast.error('Failed to send reminders'),
  });

  // ── Individual payment form ───────────────────────────────────────────────
  const { register, handleSubmit, reset, setValue, watch } = useForm();
  const paymentType = watch('type');

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
      if (memberRef.current && !memberRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMemberSelect = (m: { id: string; fullName: string; membershipId: string }) => {
    setSelectedMember(m);
    setMemberQuery('');
    setShowSuggestions(false);
    setValue('memberId', m.id, { shouldValidate: true });
  };

  const resetPaymentForm = () => { reset(); setSelectedMember(null); setMemberQuery(''); };

  // ── Payment event form ────────────────────────────────────────────────────
  const { register: regEvt, handleSubmit: handleEvt, reset: resetEvt, setValue: setEvtValue, watch: watchEvt } = useForm();
  const evtType = watchEvt('type');
  const evtDueDate = watchEvt('dueDate');

  useEffect(() => {
    if (evtDueDate) {
      const d = new Date(evtDueDate);
      if (!isNaN(d.getTime())) {
        setEvtValue('month', d.getMonth() + 1);
        setEvtValue('year', d.getFullYear());
      }
    }
  }, [evtDueDate, setEvtValue]);

  const resetEventForm = () => resetEvt();

  const chartData = analytics?.map((d: any) => ({ name: MONTHS[d.month - 1], income: d.income })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Treasurer Dashboard</h1>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<CalendarClock size={16} />} onClick={() => setShowEventModal(true)}>
            New Payment Event
          </Button>
          <Button icon={<Plus size={16} />} onClick={() => setShowAddModal(true)}>
            Record Payment
          </Button>
        </div>
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

      {/* Bank Accounts */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-surface-200 dark:border-surface-700">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Landmark size={16} className="text-slate-400" />
            Bank Accounts
          </h2>
          <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => setShowAccountModal(true)}>
            New Account
          </Button>
        </div>
        {(bankAccounts?.length ?? 0) === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-400">No bank accounts yet. Create one to start tracking balances.</p>
        ) : (
          <div className="divide-y divide-surface-100 dark:divide-surface-700">
            {(bankAccounts ?? []).map((acct: any) => {
              const balancePositive = acct.balance >= 0;
              return (
                <div key={acct.id} className="px-5 py-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{acct.name}</p>
                    {acct.accountNumber && (
                      <p className="text-xs text-slate-400 mt-0.5">A/C {acct.accountNumber}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <ArrowDownLeft size={14} />
                      <span>{formatCurrency(acct.totalIn)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-red-500 dark:text-red-400">
                      <ArrowUpRight size={14} />
                      <span>{formatCurrency(acct.totalOut)}</span>
                    </div>
                    <div className={`font-semibold text-base ${balancePositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {formatCurrency(acct.balance)}
                    </div>
                    <Button size="sm" variant="ghost" icon={<List size={14} />} onClick={() => setTxAccountId(acct.id)}>
                      Transactions
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Monthly Financial Report */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <FileDown size={16} className="text-slate-400" />
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">Monthly Financial Report</h2>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Download a PDF summary of income (by type), expenses, and bank balance for any month.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Month</label>
            <select
              className="input w-36"
              value={reportMonth}
              onChange={(e) => setReportMonth(Number(e.target.value))}
            >
              {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Year</label>
            <select
              className="input w-28"
              value={reportYear}
              onChange={(e) => setReportYear(Number(e.target.value))}
            >
              {Array.from({ length: 5 }, (_, i) => year - i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <Button
            icon={<FileDown size={15} />}
            loading={downloadingReport}
            onClick={handleDownloadMonthlyReport}
          >
            Download PDF
          </Button>
        </div>
      </div>

      {/* Bank Account Transactions Modal */}
      {txAccountId && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8 px-4">
          <div className="bg-white dark:bg-surface-900 rounded-2xl shadow-2xl w-full max-w-2xl">
            <div className="flex items-center justify-between p-5 border-b border-surface-200 dark:border-surface-700">
              <h2 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <List size={16} />
                {(bankAccounts ?? []).find((a: any) => a.id === txAccountId)?.name} — Transactions
              </h2>
              <button onClick={() => setTxAccountId(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1">
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[70vh]">
              {txLoading ? (
                <div className="flex justify-center py-10">
                  <div className="animate-spin w-7 h-7 border-4 border-primary-600 border-t-transparent rounded-full" />
                </div>
              ) : (txData?.length ?? 0) === 0 ? (
                <p className="px-6 py-8 text-sm text-slate-400 text-center">No transactions yet for this account.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-surface-50 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700">
                    <tr>
                      {['Date & Time', 'Description', 'Category / Type', 'Amount'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                    {(txData ?? []).map((tx: any) => (
                      <tr key={tx.id} className="hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors">
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(tx.createdAt, 'PP p')}</td>
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{tx.description}</td>
                        <td className="px-4 py-3 text-slate-500">
                          {tx.category ?? (tx.customType || tx.subType?.replace(/_/g, ' '))}
                        </td>
                        <td className={`px-4 py-3 font-semibold whitespace-nowrap ${tx.direction === 'IN' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                          {tx.direction === 'IN' ? '+' : '−'}{formatCurrency(tx.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="px-5 py-4 border-t border-surface-200 dark:border-surface-700 flex justify-end">
              <Button variant="secondary" onClick={() => setTxAccountId(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* Active Payment Events */}
      {(activeEvents?.length || 0) > 0 && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-surface-200 dark:border-surface-700">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">
              Active Payment Events <span className="ml-1 text-xs font-normal text-slate-400">({activeEvents!.length} open)</span>
            </h2>
          </div>
          <div className="divide-y divide-surface-100 dark:divide-surface-700">
            {activeEvents!.map((ev: any) => {
              const total = ev.totalCount || 0;
              const paid = ev.paidCount || 0;
              const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
              const isPastDue = ev.dueDate && new Date(ev.dueDate) < new Date();
              return (
                <button
                  key={ev.id}
                  onClick={() => setSelectedEventId(ev.id)}
                  className="w-full text-left px-5 py-4 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">{ev.title}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-surface-100 dark:bg-surface-700 text-slate-500">
                          {ev.type?.replace(/_/g, ' ')}
                        </span>
                        {isPastDue && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">Past Due</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Due {formatDate(ev.dueDate, 'PPp')} · {formatCurrency(Number(ev.amount))} / member
                      </p>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
                          <div className="h-1.5 bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-slate-500 whitespace-nowrap">{paid}/{total} paid</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-emerald-600">{formatCurrency(Number(ev.collectedAmount))}</p>
                        <p className="text-xs text-slate-400">collected</p>
                      </div>
                      <ChevronRight size={16} className="text-slate-400" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Overdue Payments */}
      {(overdueData?.length || 0) > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-surface-200 dark:border-surface-700">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">Overdue Payments ({overdueData?.length})</h2>
            <Button size="sm" variant="secondary" icon={<Send size={14} />}
              disabled={selectedOverdue.length === 0} loading={reminderMutation.isPending}
              onClick={() => reminderMutation.mutate(selectedOverdue)}>
              Send Reminders ({selectedOverdue.length})
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-50 dark:bg-surface-800/50 border-b border-surface-200 dark:border-surface-700">
                  <th className="px-4 py-2.5 text-left">
                    <input type="checkbox" onChange={(e) => {
                      setSelectedOverdue(e.target.checked ? overdueData?.map((p: any) => p.id) || [] : []);
                    }} />
                  </th>
                  {['Member', 'Type', 'Remaining', 'Due Date', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                {overdueData?.map((p: any) => (
                  <tr key={p.id} className="hover:bg-surface-50 dark:hover:bg-surface-800">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedOverdue.includes(p.id)}
                        onChange={(e) => setSelectedOverdue(e.target.checked
                          ? [...selectedOverdue, p.id]
                          : selectedOverdue.filter((id) => id !== p.id))} />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{p.member?.fullName}</p>
                      <p className="text-xs text-slate-400">{p.member?.membershipId}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{p.type?.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 font-semibold">{formatCurrency(Number(p.amount) - Number(p.paidAmount))}</td>
                    <td className="px-4 py-3 text-red-500">{p.dueDate ? formatDate(p.dueDate, 'PP') : '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Record Individual Payment Modal ─────────────────────────────── */}
      <Modal isOpen={showAddModal} onClose={() => { setShowAddModal(false); resetPaymentForm(); }} title="Record Individual Payment">
        <form onSubmit={handleSubmit((data) => addPaymentMutation.mutate(data))} className="space-y-4">
          <div ref={memberRef} className="relative w-full">
            <label className="label">Member</label>
            <input type="hidden" {...register('memberId', { required: true })} />
            {selectedMember ? (
              <div className="input flex items-center justify-between">
                <span className="text-slate-900 dark:text-slate-100 text-sm">
                  {selectedMember.fullName}
                  <span className="ml-2 text-xs text-slate-400">{selectedMember.membershipId}</span>
                </span>
                <button type="button" onClick={() => { setSelectedMember(null); setMemberQuery(''); setValue('memberId', ''); }}
                  className="text-slate-400 hover:text-slate-600 text-xs ml-2">✕</button>
              </div>
            ) : (
              <input className="input" placeholder="Search by name or member ID..."
                value={memberQuery}
                onChange={(e) => { setMemberQuery(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)} />
            )}
            {showSuggestions && !selectedMember && (memberSuggestions?.length ?? 0) > 0 && (
              <ul className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                {memberSuggestions!.map((m: any) => (
                  <li key={m.id} onMouseDown={() => handleMemberSelect({ id: m.id, fullName: m.fullName, membershipId: m.membershipId })}
                    className="px-4 py-2.5 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-700 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{m.fullName}</span>
                    <span className="text-xs text-slate-400">{m.membershipId}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

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
            <Input label="Paid Amount" type="number" step="0.01" placeholder="Leave blank = fully paid" {...register('paidAmount')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Month" type="number" min="1" max="12" defaultValue={month} {...register('month')} />
            <Input label="Year" type="number" defaultValue={year} {...register('year')} />
          </div>
          {(bankAccounts?.length ?? 0) > 0 && (
            <Select
              label="Bank Account (optional)"
              options={[
                { value: '', label: 'No account' },
                ...(bankAccounts ?? []).map((a: any) => ({ value: a.id, label: a.name })),
              ]}
              {...register('bankAccountId')}
            />
          )}
          <Input label="Description" placeholder="Optional note" {...register('description')} />
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={() => { setShowAddModal(false); resetPaymentForm(); }}>Cancel</Button>
            <Button type="submit" loading={addPaymentMutation.isPending}>Record Payment</Button>
          </div>
        </form>
      </Modal>

      {/* ── Create Payment Event Modal ───────────────────────────────────── */}
      <Modal isOpen={showEventModal} onClose={() => { setShowEventModal(false); resetEventForm(); }} title="New Payment Event">
        <form onSubmit={handleEvt((data) => createEventMutation.mutate({
          ...data,
          dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : data.dueDate,
        }))} className="space-y-4">
          <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg text-primary-700 dark:text-primary-300 text-xs">
            Creates a pending payment for every active member. Once the due date passes, all unpaid members get arrears and the overdue count increases.
          </div>

          <Input label="Event Title" placeholder="e.g. January 2025 Monthly Meeting Fee" {...regEvt('title', { required: true })} />

          <Select label="Payment Type" options={[
            { value: 'MONTHLY_MEETING', label: 'Monthly Meeting' },
            { value: 'SPECIAL_MEETING', label: 'Special Meeting' },
            { value: 'COMMUNITY_EVENT', label: 'Community Event' },
            { value: 'VOLUNTEER_EVENT', label: 'Volunteer Event' },
            { value: 'RELIGIOUS_EVENT', label: 'Religious Event' },
            { value: 'OTHER', label: 'Other' },
            { value: 'CUSTOM', label: 'Custom' },
          ]} {...regEvt('type', { required: true })} />
          {evtType === 'CUSTOM' && (
            <Input label="Custom Type" placeholder="e.g. Annual Subscription" {...regEvt('customType', { required: true })} />
          )}

          <Input label="Amount per Member (Rs.)" type="number" step="0.01" {...regEvt('amount', { required: true })} />

          <div>
            <Input label="Due Date & Time" type="datetime-local" {...regEvt('dueDate', { required: true })} />
            <p className="text-xs text-slate-400 mt-1">Month and year are auto-filled from this date</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Month" type="number" min="1" max="12" defaultValue={month} {...regEvt('month')} />
            <Input label="Year" type="number" defaultValue={year} {...regEvt('year')} />
          </div>

          {(bankAccounts?.length ?? 0) > 0 && (
            <Select
              label="Bank Account (optional)"
              options={[
                { value: '', label: 'No account' },
                ...(bankAccounts ?? []).map((a: any) => ({ value: a.id, label: a.name })),
              ]}
              {...regEvt('bankAccountId')}
            />
          )}

          <Input label="Description" placeholder="Optional note for members" {...regEvt('description')} />

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={() => { setShowEventModal(false); resetEventForm(); }}>Cancel</Button>
            <Button type="submit" loading={createEventMutation.isPending}>Create Payment Event</Button>
          </div>
        </form>
      </Modal>

      {/* ── New Bank Account Modal ───────────────────────────────────────── */}
      <Modal isOpen={showAccountModal} onClose={() => { setShowAccountModal(false); resetAcct(); }} title="New Bank Account">
        <form onSubmit={handleAcct((data) => createAccountMutation.mutate(data))} className="space-y-4">
          <Input label="Account Name" placeholder="e.g. Main Operations Account" {...regAcct('name', { required: true })} />
          <Input label="Account Number (optional)" placeholder="e.g. 00123456789" {...regAcct('accountNumber')} />
          <Input label="Opening Balance (Rs.)" type="number" step="0.01" defaultValue={0} {...regAcct('openingBalance')} />
          <Input label="Description (optional)" placeholder="Optional note" {...regAcct('description')} />
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={() => { setShowAccountModal(false); resetAcct(); }}>Cancel</Button>
            <Button type="submit" loading={createAccountMutation.isPending}>Create Account</Button>
          </div>
        </form>
      </Modal>

      {/* ── Payment Event Detail overlay ─────────────────────────────────── */}
      {selectedEventId && (
        <PaymentEventDetail eventId={selectedEventId} onClose={() => setSelectedEventId(null)} />
      )}
    </div>
  );
}
