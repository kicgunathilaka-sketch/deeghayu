import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, MapPin, CreditCard, Calendar, Shield, AlertTriangle, Pencil, Camera, X, Check, Sun, Moon, Bell, PenLine } from 'lucide-react';
import { membersApi } from '../../api/members.api';
import { useAuthStore } from '../../store/authStore';
import { useUiStore } from '../../store/uiStore';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SignaturePad } from '../../components/ui/SignaturePad';
import { StatusBadge } from '../../components/ui/Badge';
import { PageLoader } from '../../components/ui/Spinner';
import { formatDate, formatCurrency, formatRole } from '../../utils/formatters';
import { uploadImage } from '../../utils/uploadImage';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';

const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];

export default function MemberProfilePage() {
  const { id: paramId } = useParams<{ id: string }>();
  const { user, updateUser } = useAuthStore();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const memberId = paramId || user?.memberId;
  const isOwnProfile = !paramId || paramId === user?.memberId;
  const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'SECRETARY'].includes(user?.role || '');
  const canEdit = isOwnProfile || isAdmin;
  const { theme, toggleTheme } = useUiStore();

  const [editMode, setEditMode] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showSigPad, setShowSigPad] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['member', memberId],
    queryFn: () => membersApi.getById(memberId!).then((r) => r.data.data),
    enabled: !!memberId,
  });

  const { data: arrearsData } = useQuery({
    queryKey: ['member-arrears', memberId],
    queryFn: () => membersApi.getArrears(memberId!).then((r) => r.data.data),
    enabled: !!memberId,
  });

  const { register, handleSubmit, reset } = useForm();

  const updateMutation = useMutation({
    mutationFn: (formData: any) => membersApi.update(memberId!, formData),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['member', memberId] });
      if (isOwnProfile) {
        updateUser({ member: { fullName: res.data.data.fullName, profilePhoto: res.data.data.profilePhoto } });
      }
      setEditMode(false);
      toast.success('Profile updated');
    },
    onError: () => toast.error('Update failed'),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => membersApi.updateStatus(memberId!, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['member', memberId] });
      toast.success('Status updated');
    },
    onError: () => toast.error('Update failed'),
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const url = await uploadImage(file, 'profiles');
      await membersApi.update(memberId!, { profilePhoto: url });
      qc.invalidateQueries({ queryKey: ['member', memberId] });
      if (isOwnProfile) updateUser({ member: { profilePhoto: url } });
      toast.success('Photo updated');
    } catch {
      toast.error('Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleSaveSig = async (url: string) => {
    await membersApi.update(memberId!, { signatureUrl: url });
    qc.invalidateQueries({ queryKey: ['member', memberId] });
    setShowSigPad(false);
    toast.success('Signature saved');
  };

  const startEdit = () => {
    if (!data) return;
    reset({
      fullName: data.fullName,
      phone: data.phone,
      address: data.address,
      occupation: data.occupation || '',
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth).toISOString().split('T')[0] : '',
    });
    setEditMode(true);
  };

  if (isLoading) return <PageLoader />;
  if (!data) return <div>Member not found</div>;

  const member = data;

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
          {/* Photo */}
          <div className="relative mb-4">
            <div className="w-24 h-24 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center overflow-hidden">
              {member.profilePhoto ? (
                <img src={member.profilePhoto} alt="" className="w-24 h-24 rounded-full object-cover" />
              ) : (
                <span className="text-4xl font-bold text-primary-600">{member.fullName[0]}</span>
              )}
            </div>
            {canEdit && (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="absolute bottom-0 right-0 w-7 h-7 bg-primary-600 hover:bg-primary-700 text-white rounded-full flex items-center justify-center shadow-md transition-colors"
                >
                  {uploadingPhoto ? <span className="animate-spin text-xs">⏳</span> : <Camera size={13} />}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </>
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
          {/* Contact Info / Edit Form */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                {editMode ? 'Edit Profile' : 'Contact Information'}
              </h3>
              {canEdit && !editMode && (
                <Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={startEdit}>Edit</Button>
              )}
            </div>

            {editMode ? (
              <form onSubmit={handleSubmit((d) => updateMutation.mutate(d))} className="space-y-3">
                <Input label="Full Name" {...register('fullName', { required: true })} />
                <Input label="Phone" {...register('phone')} />
                <Input label="Address" {...register('address')} />
                <Input label="Occupation" {...register('occupation')} />
                <Input label="Date of Birth" type="date" {...register('dateOfBirth')} />
                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="secondary" type="button" icon={<X size={14} />}
                    onClick={() => setEditMode(false)}>Cancel</Button>
                  <Button type="submit" icon={<Check size={14} />} loading={updateMutation.isPending}>Save</Button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { icon: Mail, label: 'Email', value: member.user?.email },
                  { icon: Phone, label: 'Phone', value: member.phone },
                  { icon: MapPin, label: 'Address', value: member.address },
                  { icon: Shield, label: 'NIC', value: member.nic },
                  { icon: Calendar, label: 'Joined', value: formatDate(member.dateJoined) },
                  { icon: Shield, label: 'Role', value: formatRole(member.user?.role || '') },
                  ...(member.occupation ? [{ icon: Shield, label: 'Occupation', value: member.occupation }] : []),
                  ...(member.dateOfBirth ? [{ icon: Calendar, label: 'Date of Birth', value: formatDate(member.dateOfBirth) }] : []),
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
            )}
          </div>

          {/* Arrears */}
          {arrearsData && (arrearsData.arrears.length > 0 || arrearsData.monthlyFee > 0) && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-red-500" />
                  Monthly Fee Arrears
                </h3>
                {arrearsData.totalArrears > 0 && (
                  <span className="text-sm font-bold text-red-600 dark:text-red-400">
                    Total: {formatCurrency(arrearsData.totalArrears)}
                  </span>
                )}
              </div>
              {arrearsData.arrears.length === 0 ? (
                <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">All monthly fees paid — no arrears.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-100 dark:border-surface-700">
                        <th className="text-left text-xs font-semibold text-slate-500 uppercase pb-2">Period</th>
                        <th className="text-right text-xs font-semibold text-slate-500 uppercase pb-2">Due</th>
                        <th className="text-right text-xs font-semibold text-slate-500 uppercase pb-2">Paid</th>
                        <th className="text-right text-xs font-semibold text-slate-500 uppercase pb-2">Balance</th>
                        <th className="text-center text-xs font-semibold text-slate-500 uppercase pb-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                      {arrearsData.arrears.map((a: any) => (
                        <tr key={`${a.year}-${a.month}`}>
                          <td className="py-2 font-medium text-slate-900 dark:text-slate-100">{a.monthName} {a.year}</td>
                          <td className="py-2 text-right text-slate-600 dark:text-slate-300">{formatCurrency(a.amount)}</td>
                          <td className="py-2 text-right text-slate-600 dark:text-slate-300">{formatCurrency(a.paidAmount)}</td>
                          <td className="py-2 text-right font-semibold text-red-600 dark:text-red-400">{formatCurrency(a.balance)}</td>
                          <td className="py-2 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              a.status === 'PARTIAL' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                              a.status === 'OVERDUE' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                              'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                            }`}>{a.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

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

          {/* Digital Signature */}
          {canEdit && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <PenLine size={16} /> Digital Signature
                </h3>
                {!showSigPad && (
                  <Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => setShowSigPad(true)}>
                    {member.signatureUrl ? 'Update' : 'Add Signature'}
                  </Button>
                )}
              </div>
              {showSigPad ? (
                <SignaturePad onSave={handleSaveSig} onCancel={() => setShowSigPad(false)} />
              ) : member.signatureUrl ? (
                <div className="border border-surface-200 dark:border-surface-600 rounded-xl p-3 bg-white dark:bg-surface-800">
                  <img src={member.signatureUrl} alt="Digital signature" className="max-h-24 object-contain" />
                </div>
              ) : (
                <p className="text-sm text-slate-400">No signature added yet.</p>
              )}
            </div>
          )}

          {/* Appearance — only on own profile */}
          {isOwnProfile && (
            <div className="card p-5">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Appearance</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Theme</p>
                  <p className="text-xs text-slate-400 mt-0.5">Currently {theme} mode</p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={toggleTheme}
                  icon={theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
                >
                  Switch to {theme === 'light' ? 'Dark' : 'Light'}
                </Button>
              </div>
            </div>
          )}

          {/* Notification Preferences — only on own profile */}
          {isOwnProfile && (
            <div className="card p-5">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                <Bell size={16} /> Notification Preferences
              </h3>
              <div className="space-y-4">
                {[
                  { label: 'Payment reminders', desc: 'Get notified when a payment is due' },
                  { label: 'Event reminders', desc: 'Get notified about upcoming events' },
                  { label: 'Announcements', desc: 'Receive community announcements' },
                ].map(({ label, desc }) => (
                  <div key={label} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{label}</p>
                      <p className="text-xs text-slate-400">{desc}</p>
                    </div>
                    <input type="checkbox" defaultChecked className="w-4 h-4 accent-primary-600" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
