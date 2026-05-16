import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Receipt, Pencil, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { expensesApi } from '../../api/expenses.api';
import { bankAccountsApi } from '../../api/bankAccounts.api';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { toast } from 'sonner';

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

export default function ExpensesPage() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [page, setPage] = useState(1);
  const [yearFilter, setYearFilter] = useState(String(currentYear));
  const [monthFilter, setMonthFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [accountFilter, setAccountFilter] = useState('');

  const { register, handleSubmit, reset, setValue } = useForm();

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: bankAccounts } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: () => bankAccountsApi.getAll().then((r) => r.data.data),
  });

  const { data: expensesPage, isLoading } = useQuery({
    queryKey: ['expenses', page, yearFilter, monthFilter, categoryFilter, accountFilter],
    queryFn: () =>
      expensesApi
        .getAll({
          page,
          limit: 20,
          year: yearFilter || undefined,
          month: monthFilter || undefined,
          category: categoryFilter || undefined,
          bankAccountId: accountFilter || undefined,
        })
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
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to save expense';
      toast.error(msg);
    },
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
    reset({
      title: '',
      category: '',
      amount: '',
      date: new Date().toISOString().slice(0, 10),
      description: '',
      bankAccountId: '',
    });
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

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    reset();
  };

  const confirmDelete = (expense: any) => {
    if (window.confirm(`Delete "${expense.title}"? This cannot be undone.`)) {
      deleteMutation.mutate(expense.id);
    }
  };

  const bankAccountOptions = [
    { value: '', label: 'No account' },
    ...(bankAccounts ?? []).map((a: any) => ({ value: a.id, label: a.name })),
  ];

  const accountFilterOptions = [
    { value: '', label: 'All accounts' },
    ...(bankAccounts ?? []).map((a: any) => ({ value: a.id, label: a.name })),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Expenses</h1>
          <p className="text-sm text-slate-500 mt-1">Track community outgoing payments</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openAdd}>
          Add Expense
        </Button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <select
          className="input !w-auto"
          value={yearFilter}
          onChange={(e) => { setYearFilter(e.target.value); setPage(1); }}
        >
          <option value="">All years</option>
          {YEARS.map((y) => <option key={y.value} value={y.value}>{y.label}</option>)}
        </select>
        <select
          className="input !w-auto"
          value={monthFilter}
          onChange={(e) => { setMonthFilter(e.target.value); setPage(1); }}
        >
          {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <select
          className="input !w-auto"
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {(bankAccounts?.length ?? 0) > 0 && (
          <select
            className="input !w-auto"
            value={accountFilter}
            onChange={(e) => { setAccountFilter(e.target.value); setPage(1); }}
          >
            {accountFilterOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
        ) : expenses.length === 0 ? (
          <div className="p-8">
            <EmptyState icon={Receipt} title="No expenses recorded" description="Add your first expense using the button above" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-50 dark:bg-surface-800/50 border-b border-surface-200 dark:border-surface-700">
                    {['Date', 'Title', 'Category', 'Bank Account', 'Amount', 'Description', ''].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                  {expenses.map((exp: any) => (
                    <tr key={exp.id} className="hover:bg-surface-50 dark:hover:bg-surface-800">
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(exp.date, 'PP')}</td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{exp.title}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-surface-100 dark:bg-surface-700 text-slate-600 dark:text-slate-300">
                          {exp.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{exp.bankAccountName ?? '—'}</td>
                      <td className="px-4 py-3 font-semibold text-red-600 dark:text-red-400 whitespace-nowrap">
                        {formatCurrency(Number(exp.amount))}
                      </td>
                      <td className="px-4 py-3 text-slate-400 max-w-[200px] truncate">{exp.description ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(exp)}
                            className="p-1.5 rounded hover:bg-surface-100 dark:hover:bg-surface-700 text-slate-400 hover:text-slate-600"
                          >
                            <Pencil size={14} />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => confirmDelete(exp)}
                              className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-surface-200 dark:border-surface-700 flex items-center justify-between text-xs text-slate-500">
                <span>{total} expenses</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-2 py-1 rounded border border-surface-200 dark:border-surface-700 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <span className="px-2 py-1">{page} / {totalPages}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-2 py-1 rounded border border-surface-200 dark:border-surface-700 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editing ? 'Edit Expense' : 'Add Expense'}
      >
        <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))} className="space-y-4">
          <Input label="Title" placeholder="e.g. Office supplies" {...register('title', { required: true })} />

          <Select
            label="Category"
            options={CATEGORIES.map((c) => ({ value: c, label: c }))}
            {...register('category', { required: true })}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input label="Amount (Rs.)" type="number" step="0.01" min="0" {...register('amount', { required: true })} />
            <Input label="Date" type="date" {...register('date', { required: true })} />
          </div>

          {(bankAccounts?.length ?? 0) > 0 && (
            <Select
              label="Bank Account"
              options={bankAccountOptions}
              {...register('bankAccountId')}
            />
          )}

          <Input label="Description" placeholder="Optional note" {...register('description')} />

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" loading={saveMutation.isPending}>
              {editing ? 'Save Changes' : 'Add Expense'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
