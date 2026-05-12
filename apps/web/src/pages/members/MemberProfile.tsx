import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, MapPin, QrCode, CreditCard, Calendar, Shield } from 'lucide-react';
import { membersApi } from '../../api/members.api';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { PageLoader } from '../../components/ui/Spinner';
import { formatDate, formatCurrency, formatRole } from '../../utils/formatters';
import { toast } from 'sonner';

const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];

export default function MemberProfilePage() {
  const { id: paramId } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const memberId = paramId || user?.memberId;

  const { data, isLoading } = useQuery({
    queryKey: ['member', memberId],
    queryFn: () => membersApi.getById(memberId!).then((r) => r.data.data),
    enabled: !!memberId,
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => membersApi.updateStatus(memberId!, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['member', memberId] });
      toast.success('Status updated');
    },
    onError: () => toast.error('Update failed'),
  });

  if (isLoading) return <PageLoader />;
  if (!data) return <div>Member not found</div>;

  const member = data;
  const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'SECRETARY'].includes(user?.role || '');
  const isOwnProfile = user?.memberId === member.id;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} />} onClick={() => navigate(-1)}>Back</Button>
        <h1 className="page-title">Member Profile</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="card p-6 flex flex-col items-center text-center">
          <div className="w-24 h-24 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-4">
            {member.profilePhoto ? (
              <img src={member.profilePhoto} alt="" className="w-24 h-24 rounded-full object-cover" />
            ) : (
              <span className="text-4xl font-bold text-primary-600">{member.fullName[0]}</span>
            )}
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{member.fullName}</h2>
          <p className="text-slate-500 text-sm font-mono">{member.membershipId}</p>
          <div className="mt-2"><StatusBadge status={member.status} /></div>

          {member.qrCodeUrl && (
            <div className="mt-4">
              <img src={member.qrCodeUrl} alt="QR" className="w-36 h-36 rounded-xl border border-surface-200 dark:border-surface-700 p-1" />
              <p className="text-xs text-slate-400 mt-2">Member QR Code</p>
            </div>
          )}

          {isAdmin && (
            <div className="mt-4 w-full">
              <label className="label text-left">Change Status</label>
              <select
                value={member.status}
                onChange={(e) => statusMutation.mutate(e.target.value)}
                className="input text-sm"
                disabled={statusMutation.isPending}
              >
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="lg:col-span-2 space-y-4">
          {/* Contact Info */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Contact Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { icon: Mail, label: 'Email', value: member.user?.email },
                { icon: Phone, label: 'Phone', value: member.phone },
                { icon: MapPin, label: 'Address', value: member.address },
                { icon: Shield, label: 'NIC', value: member.nic },
                { icon: Calendar, label: 'Joined', value: formatDate(member.dateJoined) },
                { icon: Shield, label: 'Role', value: formatRole(member.user?.role || '') },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-surface-100 dark:bg-surface-700 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                    <Icon size={14} className="text-slate-500" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">{label}</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{value || '—'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Payments */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Recent Payments</h3>
              <CreditCard size={18} className="text-slate-400" />
            </div>
            <div className="space-y-2">
              {member.payments?.slice(0, 5).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-surface-100 dark:border-surface-700 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{p.type.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-slate-400">{p.paidAt ? formatDate(p.paidAt) : 'Not paid'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCurrency(Number(p.amount))}</p>
                    <StatusBadge status={p.status} />
                  </div>
                </div>
              )) || <p className="text-sm text-slate-400">No payments</p>}
            </div>
          </div>

          {/* Attendance History */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Attendance History</h3>
              <Calendar size={18} className="text-slate-400" />
            </div>
            <div className="space-y-2">
              {member.attendances?.slice(0, 5).map((a: any) => (
                <div key={a.id} className="flex items-center justify-between py-2 border-b border-surface-100 dark:border-surface-700 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{a.event?.title}</p>
                    <p className="text-xs text-slate-400">{formatDate(a.checkedInAt, 'PPp')}</p>
                  </div>
                  <StatusBadge status={a.isLate ? 'LATE' : 'PRESENT'} />
                </div>
              )) || <p className="text-sm text-slate-400">No attendance records</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
