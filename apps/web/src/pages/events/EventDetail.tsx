import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, Users, QrCode, Send, CheckCircle, Clock } from 'lucide-react';
import { eventsApi } from '../../api/events.api';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { PageLoader } from '../../components/ui/Spinner';
import { Modal } from '../../components/ui/Modal';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { toast } from 'sonner';
import { useState } from 'react';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SECRETARY', 'PRESIDENT', 'COMMITTEE_MEMBER'];

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isAdmin = ADMIN_ROLES.includes(user?.role || '');
  const [showQr, setShowQr] = useState(false);
  const [qrData, setQrData] = useState<{ qrCode: string; qrExpiresAt: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: () => eventsApi.getById(id!).then((r) => r.data.data),
    enabled: !!id,
  });

  const publishMutation = useMutation({
    mutationFn: () => eventsApi.publish(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event', id] });
      toast.success('Event published with QR code');
    },
    onError: () => toast.error('Publish failed'),
  });

  const rsvpMutation = useMutation({
    mutationFn: (response: string) => eventsApi.rsvp(id!, response),
    onSuccess: () => toast.success('RSVP submitted'),
    onError: () => toast.error('RSVP failed'),
  });

  const loadQr = async () => {
    try {
      const res = await eventsApi.getQr(id!);
      setQrData(res.data.data);
      setShowQr(true);
    } catch {
      toast.error('QR not available. Publish the event first.');
    }
  };

  if (isLoading) return <PageLoader />;
  if (!data) return <div>Event not found</div>;

  const event = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} />} onClick={() => navigate(-1)}>Back</Button>
        <StatusBadge status={event.status} />
      </div>

      {event.coverImage && (
        <div className="w-full h-64 rounded-2xl overflow-hidden">
          <img src={event.coverImage} alt={event.title} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-6">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">{event.title}</h1>
            {event.description && <p className="text-slate-600 dark:text-slate-300 mb-4">{event.description}</p>}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <Clock size={16} className="text-slate-400" />
                <div>
                  <p className="text-xs text-slate-400">Starts</p>
                  <p>{formatDate(event.startTime, 'PPp')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <Clock size={16} className="text-slate-400" />
                <div>
                  <p className="text-xs text-slate-400">Ends</p>
                  <p>{formatDate(event.endTime, 'PPp')}</p>
                </div>
              </div>
              {event.location && (
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <MapPin size={16} className="text-slate-400" />
                  <p>{event.location}</p>
                </div>
              )}
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <Users size={16} className="text-slate-400" />
                <p>{event._count?.attendances || 0} attending</p>
              </div>
            </div>

            {event.requiresFee && event.feeAmount && (
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  Event Fee: {formatCurrency(Number(event.feeAmount))}
                </p>
              </div>
            )}
          </div>

          {/* Gallery */}
          {event.gallery?.length > 0 && (
            <div className="card p-5">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Gallery</h2>
              <div className="grid grid-cols-3 gap-2">
                {event.gallery.map((img: any) => (
                  <img key={img.id} src={img.imageUrl} alt={img.caption || ''} className="w-full h-28 object-cover rounded-lg" />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Actions */}
        <div className="space-y-4">
          {/* RSVP */}
          {event.requiresRsvp && event.status === 'PUBLISHED' && (
            <div className="card p-5">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">RSVP</h3>
              <div className="flex gap-2">
                {['GOING', 'NOT_GOING', 'MAYBE'].map((r) => (
                  <button
                    key={r}
                    onClick={() => rsvpMutation.mutate(r)}
                    className="flex-1 py-2 rounded-lg text-xs font-medium border border-surface-200 dark:border-surface-700 hover:border-primary-500 hover:text-primary-600 transition-colors"
                  >
                    {r === 'GOING' ? '✅ Going' : r === 'NOT_GOING' ? '❌ No' : '🤔 Maybe'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Admin Actions */}
          {isAdmin && (
            <div className="card p-5 space-y-3">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Admin Actions</h3>
              {event.status === 'DRAFT' && (
                <Button className="w-full" loading={publishMutation.isPending} onClick={() => publishMutation.mutate()}>
                  Publish & Generate QR
                </Button>
              )}
              <Button variant="secondary" className="w-full" icon={<QrCode size={16} />} onClick={loadQr}>
                View QR Code
              </Button>
              <Button variant="secondary" className="w-full" icon={<Send size={16} />}>
                Send Reminders
              </Button>
              <Button variant="secondary" className="w-full" icon={<Users size={16} />} onClick={() => navigate(`/attendance`)}>
                View Attendance
              </Button>
            </div>
          )}

          {/* Stats */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">Event Stats</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Attendees</span><span className="font-medium">{event._count?.attendances || 0}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">RSVPs</span><span className="font-medium">{event._count?.rsvps || 0}</span></div>
              {event.maxAttendees && <div className="flex justify-between"><span className="text-slate-500">Capacity</span><span className="font-medium">{event.maxAttendees}</span></div>}
            </div>
          </div>
        </div>
      </div>

      {/* QR Modal */}
      <Modal isOpen={showQr} onClose={() => setShowQr(false)} title="Event QR Code" size="sm">
        {qrData ? (
          <div className="text-center">
            <img src={qrData.qrCode} alt="Event QR" className="w-64 h-64 mx-auto rounded-xl border" />
            <p className="text-sm text-slate-500 mt-3">Members scan this to check in</p>
            {qrData.qrExpiresAt && (
              <p className="text-xs text-slate-400 mt-1">Expires: {formatDate(qrData.qrExpiresAt, 'PPp')}</p>
            )}
          </div>
        ) : <p>No QR available</p>}
      </Modal>
    </div>
  );
}
