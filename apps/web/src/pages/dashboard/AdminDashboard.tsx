import { useQuery } from '@tanstack/react-query';
import { Users, CreditCard, AlertTriangle, Calendar, TrendingUp, Activity, Clock } from 'lucide-react';
import { reportsApi } from '../../api/reports.api';
import { paymentsApi } from '../../api/payments.api';
import { StatCard } from '../../components/ui/StatCard';
import { PageLoader } from '../../components/ui/Spinner';
import { StatusBadge } from '../../components/ui/Badge';
import { formatCurrency, formatDate, formatRole, formatRelative } from '../../utils/formatters';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const COLORS = ['#0284c7', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

export default function AdminDashboard() {
  const { data: statsData, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => reportsApi.getDashboardStats().then((r) => r.data.data),
    refetchInterval: 60_000,
  });

  const { data: analyticsData } = useQuery({
    queryKey: ['payment-analytics', new Date().getFullYear()],
    queryFn: () => paymentsApi.getAnalytics(new Date().getFullYear()).then((r) => r.data.data),
  });

  if (isLoading) return <PageLoader />;

  const stats = statsData;
  const chartData = analyticsData?.map((d: any) => ({ name: MONTHS[d.month - 1], income: d.income })) || [];

  const pieData = [
    { name: 'Active', value: stats?.activeMembers || 0 },
    { name: 'Pending', value: stats?.pendingMembers || 0 },
    { name: 'Inactive', value: (stats?.totalMembers || 0) - (stats?.activeMembers || 0) - (stats?.pendingMembers || 0) },
  ];

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {formatDate(new Date(), 'PPPP')}
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Members"
          value={stats?.totalMembers || 0}
          subtitle={`${stats?.activeMembers || 0} active`}
          icon={Users}
          iconBg="bg-blue-100 dark:bg-blue-900/30"
          iconColor="text-blue-600"
        />
        <StatCard
          title="Monthly Income"
          value={formatCurrency(stats?.currentMonthIncome || 0)}
          subtitle="This month"
          icon={TrendingUp}
          iconBg="bg-emerald-100 dark:bg-emerald-900/30"
          iconColor="text-emerald-600"
        />
        <StatCard
          title="Pending Payments"
          value={stats?.pendingPayments || 0}
          subtitle="Awaiting collection"
          icon={CreditCard}
          iconBg="bg-amber-100 dark:bg-amber-900/30"
          iconColor="text-amber-600"
        />
        <StatCard
          title="New Registrations"
          value={stats?.pendingMembers || 0}
          subtitle="Awaiting approval"
          icon={AlertTriangle}
          iconBg="bg-red-100 dark:bg-red-900/30"
          iconColor="text-red-600"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Income Chart */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">Monthly Income — {new Date().getFullYear()}</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0284c7" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#0284c7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: any) => [`Rs. ${Number(v).toLocaleString()}`, 'Income']} />
              <Area type="monotone" dataKey="income" stroke="#0284c7" strokeWidth={2} fill="url(#incomeGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Member Pie */}
        <div className="card p-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">Member Status</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                {pieData.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Legend iconSize={10} iconType="circle" />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upcoming Events */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Upcoming Events</h2>
            <Calendar size={18} className="text-slate-400" />
          </div>
          {stats?.upcomingEvents?.length ? (
            <div className="space-y-3">
              {stats.upcomingEvents.map((event: any) => (
                <div key={event.id} className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-accent-100 dark:bg-accent-900/30 rounded-lg flex items-center justify-center shrink-0">
                    <Calendar size={16} className="text-accent-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{event.title}</p>
                    <p className="text-xs text-slate-400">{formatDate(event.startTime, 'PPp')}</p>
                    {event.location && <p className="text-xs text-slate-400">📍 {event.location}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-4 text-center">No upcoming events</p>
          )}
        </div>

        {/* Recent Activity */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Recent Activity</h2>
            <Activity size={18} className="text-slate-400" />
          </div>
          {stats?.recentActivity?.length ? (
            <div className="space-y-3">
              {stats.recentActivity.slice(0, 7).map((log: any) => (
                <div key={log.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-xs font-medium text-slate-500">
                      {log.user?.member?.fullName?.[0] || '?'}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-700 dark:text-slate-300">
                      <span className="font-medium">{log.user?.member?.fullName || log.user?.email}</span>
                      {' '}{log.action.toLowerCase()} {log.entity.toLowerCase()}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                      <Clock size={10} />
                      {formatRelative(log.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-4 text-center">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );
}
