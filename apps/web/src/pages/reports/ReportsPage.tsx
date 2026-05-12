import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, BarChart3, Users, CreditCard, TrendingUp } from 'lucide-react';
import { reportsApi } from '../../api/reports.api';
import { Button } from '../../components/ui/Button';
import { formatCurrency, formatDate, downloadBlob } from '../../utils/formatters';
import { toast } from 'sonner';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

export default function ReportsPage() {
  const year = new Date().getFullYear();
  const [exporting, setExporting] = useState<string | null>(null);

  const { data: finance } = useQuery({
    queryKey: ['finance-report', year],
    queryFn: () => reportsApi.getFinancialReport(year).then((r) => r.data.data),
  });

  const handleExport = async (type: string, format: string) => {
    setExporting(`${type}-${format}`);
    try {
      const res = await reportsApi.exportReport(type, format, { year });
      const ext = format === 'excel' ? 'xlsx' : format;
      downloadBlob(res.data, `${type}-report-${year}.${ext}`);
      toast.success('Report downloaded');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="text-sm text-slate-500 mt-1">Financial year {year}</p>
        </div>
      </div>

      {/* Export Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { type: 'members', icon: Users, title: 'Members Report', color: 'blue' },
          { type: 'payments', icon: CreditCard, title: 'Payments Report', color: 'emerald' },
          { type: 'attendance', icon: BarChart3, title: 'Attendance Report', color: 'violet' },
          { type: 'finance', icon: TrendingUp, title: 'Finance Report', color: 'amber' },
        ].map(({ type, icon: Icon, title, color }) => (
          <div key={type} className="card p-5">
            <div className={`w-10 h-10 bg-${color}-100 dark:bg-${color}-900/30 rounded-xl flex items-center justify-center mb-3`}>
              <Icon size={18} className={`text-${color}-600`} />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm mb-3">{title}</h3>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                icon={<Download size={13} />}
                loading={exporting === `${type}-excel`}
                onClick={() => handleExport(type, 'excel')}
              >
                Excel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                icon={<Download size={13} />}
                loading={exporting === `${type}-pdf`}
                onClick={() => handleExport(type, 'pdf')}
              >
                PDF
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Financial Summary */}
      {finance && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card p-5">
            <p className="text-sm text-slate-500">Total Income</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(finance.totalIncome)}</p>
          </div>
          <div className="card p-5">
            <p className="text-sm text-slate-500">Total Expenses</p>
            <p className="text-2xl font-bold text-red-500 mt-1">{formatCurrency(finance.totalExpenses)}</p>
          </div>
          <div className="card p-5">
            <p className="text-sm text-slate-500">Net Balance</p>
            <p className={`text-2xl font-bold mt-1 ${finance.netBalance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {formatCurrency(finance.netBalance)}
            </p>
          </div>
        </div>
      )}

      {/* Payment History Table */}
      {finance?.payments?.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">Payment Records — {year}</h2>
            <span className="text-sm text-slate-500">{finance.payments.length} records</span>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white dark:bg-surface-800">
                <tr className="border-b border-surface-200 dark:border-surface-700">
                  {['Member', 'Type', 'Amount', 'Status', 'Date'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                {finance.payments.slice(0, 50).map((p: any) => (
                  <tr key={p.id} className="hover:bg-surface-50 dark:hover:bg-surface-800">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{p.member?.fullName}</p>
                      <p className="text-xs text-slate-400 font-mono">{p.member?.membershipId}</p>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300 text-xs">{p.type?.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(Number(p.amount))}</td>
                    <td className="px-4 py-2.5"><span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">{p.status}</span></td>
                    <td className="px-4 py-2.5 text-slate-500">{formatDate(p.createdAt, 'PP')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
