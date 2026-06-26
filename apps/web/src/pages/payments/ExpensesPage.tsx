import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Receipt, Pencil, Trash2, FolderOpen, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { expensesApi, expenseGroupsApi } from '../../api/expenses.api';
import { bankAccountsApi } from '../../api/bankAccounts.api';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { toast } from 'sonner';
import { cn } from '../../utils/cn';

const CATEGORIES = ['Office', 'Travel', 'Event', 'Utilities', 'Maintenance', 'Salaries', 'Other'];

const MONTHS = [
  { value: '', label: 'All months' },
  ...Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Date(0, i).toLocaleString('default', { month: 'long' }),
  })),
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => ({
  value: String(currentYear - i),
  label: String(currentYear - i),
}));

// ── Expense Event Detail Modal ────────────────────────────────────────────────
function EventDetailModal({ groupId, onClose, isAdmin }: { groupId: string; onClose: () => void; isAdmin: boolean }) {
  const qc = useQueryClient();

  const { data: res, isLoading } = useQuery({
    queryKey: ['expense-group', groupId],
    queryFn: () => expenseGroupsApi.getById(groupId).then((r) => r.data.data),
  });
  const group = res as any;

  const deleteMut = useMutation({
    mutationFn: () => expenseGroupsApi.delete(groupId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expense-groups'] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['bank-accounts'] });
      toast.success('Expense event deleted');
      onClose();
    },
    onError: () => toast.error('Failed to delete event'),
  });

  return (
    <Modal isOpen onClose={onClose} title={group?.title ?? 'Expense Event'} size="lg">
      {isLoading || !group ? (
        <div className="py-8 text-center text-slate-400 text-sm">Loading…</div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 text-sm text-slate-500">
            <span>{formatDate(group.date, 'PP')}</span>
            {group.bankAccountName && (
              <span className="text-primary-600 dark:text-primary-400 font-medium">{group.bankAccountName}</span>
            )}
            {group.description && <span className="italic">{group.description}</span>}
          </div>

          <div className="rounded-xl bg-surface-50 dark:bg-surface-800/50 p-4">
            <div className="flex justify-between text-sm font-semibold mb-3">
              <span>{group.expenses?.length ?? 0} expense{group.expenses?.length !== 1 ? 's' : ''}</span>
              <span className="text-red-600 dark:text-red-400">{formatCurrency(group.totalAmount)}</span>
            </div>
            <div className="divide-y divide-surface-200 dark:divide-surface-700">
              {(group.expenses ?? []).map((exp: any) => (
                <div key={exp.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 dark:text-slate-100 truncate">{exp.title}</p>
                    <p className="text-xs text-slate-400">{exp.category}{exp.description ? ` · ${exp.description}` : ''}</p>
                  </div>
                  <span className="font-semibold text-red-600 dark:text-red-400 ml-4 shrink-0">
                    {formatCurrency(Number(exp.amount))}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {isAdmin && (
            <div className="flex justify-end pt-1">
              <Button
                variant="danger"
                size="sm"
                icon={<Trash2 size={14} />}
                loading={deleteMut.isPending}
                onClick={() => window.confirm('Delete this event and all its expenses?') && deleteMut.mutate()}
              >
                Delete Event
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ── Create Expense Event Modal ─────────────────────────────────────────────────
function CreateEventModal({ onClose, bankAccounts }: { onClose: () => void; bankAccounts: any[] }) {
  const qc = useQueryClient();
  const [items, setItems] = useState([{ title: '', amount: '', category: 'Event', description: '' }]);
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { title: '', description: '', date: new Date().toISOString().slice(0, 10), bankAccountId: '' },
  });

  const createMut = useMutation({
    mutationFn: (data: any) => expenseGroupsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expense-groups'] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['bank-accounts'] });
      toast.success('Expense event created');
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to create event'),
  });

  const updateItem = (i: number, field: string, val: string) => {
    setItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, [field]: val } : item)));
  };

  const addItem = () => setItems((prev) => [...prev, { title: '', amount: '', category: 'Event', description: '' }]);
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  const onSubmit = (data: any) => {
    const validItems = items.filter((it) => it.title.trim() && Number(it.amount) > 0);
    if (validItems.length === 0) { toast.error('Add at least one expense item'); return; }
    createMut.mutate({ ...data, items: validItems });
  };

  const bankAccountOptions = [
    { value: '', label: 'No account' },
    ...(bankAccounts ?? []).map((a: any) => ({ value: a.id, label: `${a.name} (${formatCurrency(a.balance ?? 0)})` })),
  ];

  const total = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);

  return (
    <Modal isOpen onClose={onClose} title="Create Expense Event" size="xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Event details */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Input
              label="Event Title"
              placeholder="e.g. Annual General Meeting"
              {...register('title', { required: 'Title is required' })}
              error={errors.title?.message as string}
            />
          </div>
          <Input label="Date" type="date" {...register('date', { required: true })} />
          <Select
            label="Bank Account"
            options={bankAccountOptions}
            {...register('bankAccountId')}
          />
          <div className="col-span-2">
            <Input label="Description (optional)" placeholder="Any notes about this event" {...register('description')} />
          </div>
        </div>

        {/* Line items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">Expenses</label>
            <span className="text-sm font-semibold text-red-600 dark:text-red-400">
              Total: {formatCurrency(total)}
            </span>
          </div>

          <div className="space-y-2">
            {/* Header row */}
            <div className="grid grid-cols-[1fr_100px_120px_1fr_32px] gap-2 text-xs text-slate-400 font-medium px-1">
              <span>Title</span><span>Amount</span><span>Category</span><span>Description</span><span />
            </div>

            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-[1fr_100px_120px_1fr_32px] gap-2 items-center">
                <input
                  className="input text-sm"
                  placeholder="Expense title"
                  value={item.title}
                  onChange={(e) => updateItem(i, 'title', e.target.value)}
                />
                <input
                  className="input text-sm"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={item.amount}
                  onChange={(e) => updateItem(i, 'amount', e.target.value)}
                />
                <select
                  className="input text-sm"
                  value={item.category}
                  onChange={(e) => updateItem(i, 'category', e.target.value)}
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <input
                  className="input text-sm"
                  placeholder="Optional note"
                  value={item.description}
                  onChange={(e) => updateItem(i, 'description', e.target.value)}
                />
                <button
                  type="button"
                  disabled={items.length === 1}
                  onClick={() => removeItem(i)}
                  className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <X size={14} />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={addItem}
              className="text-xs text-primary-600 dark:text-primary-400 hover:underline mt-1"
            >
              + Add item
            </button>
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-2 border-t border-surface-200 dark:border-surface-700">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={createMut.isPending}>
            Create Event
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ExpensesPage() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  const [showModal, setShowModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [page, setPage] = useState(1);
  const [yearFilter, setYearFilter] = useState(String(currentYear));
  const [monthFilter, setMonthFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [showGroups, setShowGroups] = useState(true);

  const { register, handleSubmit, reset, setValue } = useForm();

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: bankAccounts } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: () => bankAccountsApi.getAll().then((r) => r.data.data),
  });

  const { data: groups = [] } = useQuery({
    queryKey: ['expense-groups', yearFilter, monthFilter, accountFilter],
    queryFn: () =>
      expenseGroupsApi.getAll({
        year: yearFilter || undefined,
        month: monthFilter || undefined,
        bankAccountId: accountFilter || undefined,
      }).then((r) => r.data.data),
  });

  const { data: expensesPage, isLoading } = useQuery({
    queryKey: ['expenses', page, yearFilter, monthFilter, categoryFilter, accountFilter],
    queryFn: () =>
      expensesApi
        .getAll({ page, limit: 20, year: yearFilter || undefined, month: monthFilter || undefined, category: categoryFilter || undefined, bankAccountId: accountFilter || undefined })
        .then((r) => r.data),
  });

  const expenses: any[] = expensesPage?.data ?? [];
  const total: number = expensesPage?.meta?.total ?? 0;
  const totalPages: number = expensesPage?.meta?.totalPages ?? 1;

  // ── Mutations ──────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      editing ? expensesApi.update(editing.id, data) : expensesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['bank-accounts'] });
      toast.success(editing ? 'Expense updated' : 'Expense recorded');
      closeModal();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to save expense'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => expensesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['bank-accounts'] });
      toast.success('Expense deleted');
    },
    onError: () => toast.error('Failed to delete expense'),
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  const openAdd = () => {
    reset({ title: '', category: '', amount: '', date: new Date().toISOString().slice(0, 10), description: '', bankAccountId: '' });
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (expense: any) => {
    setEditing(expense);
    setValue('title', expense.title);
    setValue('category', expense.category);
    setValue('amount', expense.amount);
    setValue('date', expense.date?.slice(0, 10) ?? '');
    setValue('description', expense.description ?? '');
    setValue('bankAccountId', expense.bankAccountId ?? '');
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditing(null); reset(); };

  const confirmDelete = (expense: any) => {
    if (window.confirm(`Delete "${expense.title}"? This cannot be undone.`)) deleteMutation.mutate(expense.id);
  };

  const bankAccountOptions = [
    { value: '', label: 'No account' },
    ...(bankAccounts ?? []).map((a: any) => ({ value: a.id, label: a.name })),
  ];

  const accountFilterOptions = [
    { value: '', label: 'All accounts' },
    ...(bankAccounts ?? []).map((a: any) => ({ value: a.id, label: a.name })),
  ];

  // Standalone expenses = expenses without a groupId
  const standaloneExpenses = expenses.filter((e) => !e.groupId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Expenses</h1>
          <p className="text-sm text-slate-500 mt-1">Track community outgoing payments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon={<FolderOpen size={16} />} onClick={() => setShowEventModal(true)}>
            Create Event
          </Button>
          <Button icon={<Plus size={16} />} onClick={openAdd}>
            Add Expense
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <select className="input !w-auto" value={yearFilter} onChange={(e) => { setYearFilter(e.target.value); setPage(1); }}>
          <option value="">All years</option>
          {YEARS.map((y) => <option key={y.value} value={y.value}>{y.label}</option>)}
        </select>
        <select className="input !w-auto" value={monthFilter} onChange={(e) => { setMonthFilter(e.target.value); setPage(1); }}>
          {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <select className="input !w-auto" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {(bankAccounts?.length ?? 0) > 0 && (
          <select className="input !w-auto" value={accountFilter} onChange={(e) => { setAccountFilter(e.target.value); setPage(1); }}>
            {accountFilterOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
      </div>

      {/* ── Expense Events ────────────────────────────────────────── */}
      {(groups as any[]).length > 0 && (
        <div className="card overflow-hidden">
          <button
            onClick={() => setShowGroups((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <FolderOpen size={16} className="text-primary-500" />
              Expense Events ({(groups as any[]).length})
            </span>
            {showGroups ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showGroups && (
            <div className="border-t border-surface-200 dark:border-surface-700 divide-y divide-surface-100 dark:divide-surface-700">
              {(groups as any[]).map((group: any) => (
                <button
                  key={group.id}
                  onClick={() => setSelectedGroupId(group.id)}
                  className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
                    <FolderOpen size={16} className="text-primary-600 dark:text-primary-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{group.title}</p>
                    <p className="text-xs text-slate-400">
                      {formatDate(group.date, 'PP')}
                      {group.bankAccountName && ` · ${group.bankAccountName}`}
                      {` · ${group.expenseCount} item${group.expenseCount !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <span className="font-semibold text-red-600 dark:text-red-400 text-sm shrink-0">
                    {formatCurrency(group.totalAmount)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Individual Expenses ───────────────────────────────────── */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
        ) : standaloneExpenses.length === 0 && expenses.length === 0 ? (
          <div className="p-8">
            <EmptyState icon={Receipt} title="No expenses recorded" description="Add an expense or create an expense event above" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-50 dark:bg-surface-800/50 border-b border-surface-200 dark:border-surface-700">
                    {['Date', 'Title', 'Category', 'Bank Account', 'Amount', 'Description', ''].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                  {expenses.map((exp: any) => (
                    <tr key={exp.id} className={cn('hover:bg-surface-50 dark:hover:bg-surface-800', exp.groupId && 'opacity-60')}>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(exp.date, 'PP')}</td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                        {exp.title}
                        {exp.groupId && (
                          <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">event</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-surface-100 dark:bg-surface-700 text-slate-600 dark:text-slate-300">{exp.category}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{exp.bankAccountName ?? '—'}</td>
                      <td className="px-4 py-3 font-semibold text-red-600 dark:text-red-400 whitespace-nowrap">{formatCurrency(Number(exp.amount))}</td>
                      <td className="px-4 py-3 text-slate-400 max-w-[200px] truncate">{exp.description ?? '—'}</td>
                      <td className="px-4 py-3">
                        {!exp.groupId && (
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEdit(exp)} className="p-1.5 rounded hover:bg-surface-100 dark:hover:bg-surface-700 text-slate-400 hover:text-slate-600">
                              <Pencil size={14} />
                            </button>
                            {isAdmin && (
                              <button onClick={() => confirmDelete(exp)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-surface-200 dark:border-surface-700 flex items-center justify-between text-xs text-slate-500">
                <span>{total} expenses</span>
                <div className="flex gap-1">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1 rounded border border-surface-200 dark:border-surface-700 disabled:opacity-40">Prev</button>
                  <span className="px-2 py-1">{page} / {totalPages}</span>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-2 py-1 rounded border border-surface-200 dark:border-surface-700 disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add / Edit Expense Modal */}
      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Edit Expense' : 'Add Expense'}>
        <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))} className="space-y-4">
          <Input label="Title" placeholder="e.g. Office supplies" {...register('title', { required: true })} />
          <Select label="Category" options={CATEGORIES.map((c) => ({ value: c, label: c }))} {...register('category', { required: true })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Amount (Rs.)" type="number" step="0.01" min="0" {...register('amount', { required: true })} />
            <Input label="Date" type="date" {...register('date', { required: true })} />
          </div>
          {(bankAccounts?.length ?? 0) > 0 && (
            <Select label="Bank Account" options={bankAccountOptions} {...register('bankAccountId')} />
          )}
          <Input label="Description" placeholder="Optional note" {...register('description')} />
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={closeModal}>Cancel</Button>
            <Button type="submit" loading={saveMutation.isPending}>{editing ? 'Save Changes' : 'Add Expense'}</Button>
          </div>
        </form>
      </Modal>

      {/* Create Expense Event Modal */}
      {showEventModal && (
        <CreateEventModal onClose={() => setShowEventModal(false)} bankAccounts={bankAccounts ?? []} />
      )}

      {/* Event Detail Modal */}
      {selectedGroupId && (
        <EventDetailModal groupId={selectedGroupId} onClose={() => setSelectedGroupId(null)} isAdmin={isAdmin} />
      )}
    </div>
  );
}
