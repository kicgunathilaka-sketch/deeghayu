import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QrCode, Users, Clock, RefreshCw, CheckCircle, Calendar } from 'lucide-react';
import { eventsApi } from '../../api/events.api';
import { attendanceApi } from '../../api/attendance.api';
import { Button } from '../../components/ui/Button';
import { PageLoader } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDate } from '../../utils/formatters';
import { toast } from 'sonner';
import { cn } from '../../utils/cn';

export default function AttendancePage() {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: publishedData, isLoading: loadingPublished } = useQuery({
    queryKey: ['events-attendance', 'PUBLISHED'],
    queryFn: () => eventsApi.getAll({ status: 'PUBLISHED', limit: 50 }).then((r) => r.data.data as any[]),
    refetchInterval: 30000,
  });

  const { data: ongoingData, isLoading: loadingOngoing } = useQuery({
    queryKey: ['events-attendance', 'ONGOING'],
    queryFn: () => eventsApi.getAll({ status: 'ONGOING', limit: 50 }).then((r) => r.data.data as any[]),
    refetchInterval: 30000,
  });

  const events: any[] = [
    ...(ongoingData || []),
    ...(publishedData || []),
  ];

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  const { data: liveData, isLoading: liveLoading } = useQuery({
    queryKey: ['live-attendance', selectedEventId],
    queryFn: () => attendanceApi.getLive(selectedEventId!).then((r) => r.data.data),
    enabled: !!selectedEventId,
    refetchInterval: 5000,
  });

  const { data: qrData, refetch: refetchQr } = useQuery({
    queryKey: ['event-qr', selectedEventId],
    queryFn: () => eventsApi.getQr(selectedEventId!).then((r) => r.data.data),
    enabled: !!selectedEventId,
    retry: false,
  });

  const openMutation = useMutation({
    mutationFn: (id: string) => eventsApi.openAttendance(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events-attendance'] });
      refetchQr();
      toast.success('Attendance opened — QR code is now active');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to open attendance'),
  });

  if (loadingPublished && loadingOngoing) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance Management</h1>
          <p className="text-sm text-slate-500 mt-1">Open attendance for an event, then display the QR code for members to scan</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Event list */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">Events</p>

          {events.length === 0 ? (
            <div className="card p-6">
              <EmptyState
                icon={Calendar}
                title="No events available"
                description="Publish an event first to enable attendance"
              />
            </div>
          ) : (
            events.map((event) => (
              <button
                key={event.id}
                onClick={() => setSelectedEventId(event.id)}
                className={cn(
                  'w-full text-left card p-4 transition-all hover:border-primary-400',
                  selectedEventId === event.id && 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-slate-900 dark:text-slate-100 text-sm truncate">{event.title}</p>
                  <span className={cn(
                    'badge shrink-0 text-xs',
                    event.status === 'ONGOING'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  )}>
                    {event.status === 'ONGOING' ? 'Live' : 'Ready'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{formatDate(event.startTime, 'PP, p')}</p>
                <p className="text-xs text-slate-400 mt-1">{event._count?.attendances || 0} checked in</p>
              </button>
            ))
          )}
        </div>

        {/* Right panel */}
        <div className="lg:col-span-2">
          {!selectedEventId ? (
            <div className="card p-12 text-center">
              <QrCode size={48} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500">Select an event from the list to manage attendance</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* QR code card */}
              <div className="card p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="font-semibold text-slate-900 dark:text-slate-100">{selectedEvent?.title}</h2>
                    <p className="text-sm text-slate-500 mt-0.5">{formatDate(selectedEvent?.startTime, 'PPPP, p')}</p>
                  </div>
                  <Button
                    onClick={() => openMutation.mutate(selectedEventId)}
                    loading={openMutation.isPending}
                    icon={<RefreshCw size={15} />}
                    size="sm"
                  >
                    {selectedEvent?.status === 'ONGOING' ? 'Refresh QR' : 'Open Attendance'}
                  </Button>
                </div>

                {qrData?.qrCode ? (
                  <div className="flex flex-col items-center">
                    <img
                      src={qrData.qrCode}
                      alt="Event QR Code"
                      className="w-64 h-64 rounded-2xl border-4 border-surface-200 dark:border-surface-700"
                    />
                    <p className="text-xs text-slate-400 mt-3">
                      Members scan this code to check in · Expires {formatDate(qrData.qrExpiresAt, 'PPp')}
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-10 text-slate-400">
                    <QrCode size={44} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Click "Open Attendance" to generate the QR code</p>
                  </div>
                )}
              </div>

              {/* Live check-ins */}
              <div className="card overflow-hidden">
                <div className="p-4 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Users size={16} />
                    Live Check-ins
                  </h3>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle size={13} />
                      {liveData?.count || 0} present
                    </span>
                    <span className="flex items-center gap-1 text-amber-500">
                      <Clock size={13} />
                      {liveData?.lateCount || 0} late
                    </span>
                  </div>
                </div>

                {liveLoading ? (
                  <div className="p-8 text-center text-slate-400 text-sm">Loading...</div>
                ) : !liveData?.attendances?.length ? (
                  <div className="p-10 text-center text-slate-400 text-sm">
                    No check-ins yet — waiting for members to scan
                  </div>
                ) : (
                  <div className="divide-y divide-surface-100 dark:divide-surface-700 max-h-96 overflow-y-auto">
                    {liveData.attendances.map((a: any) => (
                      <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center shrink-0">
                          <span className="text-white text-xs font-semibold">{a.member.fullName[0]}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                            {a.member.fullName}
                          </p>
                          <p className="text-xs text-slate-400">{a.member.membershipId}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={cn(
                            'text-xs font-medium',
                            a.isLate ? 'text-amber-500' : 'text-emerald-500'
                          )}>
                            {a.isLate ? 'Late' : 'On time'}
                          </p>
                          <p className="text-xs text-slate-400">{formatDate(a.checkedInAt, 'p')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
