import { useQuery } from '@tanstack/react-query';
import { QrCode, Calendar, CreditCard, CheckCircle } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { membersApi } from '../../api/members.api';
import { eventsApi } from '../../api/events.api';
import { PageLoader } from '../../components/ui/Spinner';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

export default function MemberDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const { data: memberData, isLoading } = useQuery({
    queryKey: ['member-profile', user?.memberId],
    queryFn: () => membersApi.getById(user?.memberId!).then((r) => r.data.data),
    enabled: !!user?.memberId,
  });

  const { data: eventsData } = useQuery({
    queryKey: ['upcoming-events'],
    queryFn: () => eventsApi.getAll({ status: 'PUBLISHED', limit: 5 }).then((r) => r.data),
  });

  if (isLoading) return <PageLoader />;

  const member = memberData;
  const recentPayments = member?.payments?.slice(0, 3) || [];
  const recentAttendance = member?.attendances?.slice(0, 3) || [];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-primary-600 to-accent-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-primary-100 text-sm">Welcome back,</p>
            <h1 className="text-2xl font-bold mt-1">{member?.fullName}</h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="bg-white/20 text-white text-xs px-2.5 py-1 rounded-full font-medium">
                {member?.membershipId}
              </span>
              <StatusBadge status={member?.status || 'ACTIVE'} className="!bg-white/20 !text-white" />
            </div>
          </div>
          <div className="hidden sm:block">
            {member?.qrCodeUrl ? (
              <img src={member.qrCodeUrl} alt="Member QR" className="w-24 h-24 bg-white rounded-xl p-1" />
            ) : (
              <div className="w-24 h-24 bg-white/10 rounded-xl flex items-center justify-center">
                <QrCode size={36} />
              </div>
            )}
          </div>
        </div>
        <div className="mt-4">
          <Button
            variant="secondary"
            size="sm"
            className="!bg-white/20 !text-white hover:!bg-white/30 border-0"
            onClick={() => navigate('/scan')}
            icon={<QrCode size={14} />}
          >
            Scan Event QR
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* My QR */}
        <div className="card p-5 flex flex-col items-center">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">My Identity QR</h3>
          {member?.qrCodeUrl ? (
            <img src={member.qrCodeUrl} alt="QR" className="w-40 h-40 rounded-lg" />
          ) : (
            <div className="w-40 h-40 bg-surface-100 dark:bg-surface-700 rounded-lg flex items-center justify-center">
              <QrCode size={48} className="text-slate-300" />
            </div>
          )}
          <p className="text-xs text-slate-400 mt-3 text-center">Show this at events to identify yourself</p>
        </div>

        {/* Recent Payments */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Recent Payments</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/payments')}>View all</Button>
          </div>
          <div className="space-y-3">
            {recentPayments.length > 0 ? recentPayments.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{p.type.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-slate-400">{p.paidAt ? formatDate(p.paidAt) : 'Not paid'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(Number(p.amount))}</p>
                  <StatusBadge status={p.status} />
                </div>
              </div>
            )) : (
              <p className="text-sm text-slate-400 text-center py-4">No payment records</p>
            )}
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Upcoming Events</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/events')}>View all</Button>
          </div>
          <div className="space-y-3">
            {eventsData?.data?.length > 0 ? eventsData.data.map((event: any) => (
              <div
                key={event.id}
                onClick={() => navigate(`/events/${event.id}`)}
                className="flex items-start gap-3 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-700 rounded-lg p-2 -mx-2 transition-colors"
              >
                <div className="w-10 h-10 bg-accent-100 dark:bg-accent-900/20 rounded-lg flex items-center justify-center shrink-0">
                  <Calendar size={16} className="text-accent-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{event.title}</p>
                  <p className="text-xs text-slate-400">{formatDate(event.startTime, 'PPp')}</p>
                </div>
              </div>
            )) : (
              <p className="text-sm text-slate-400 text-center py-4">No upcoming events</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
