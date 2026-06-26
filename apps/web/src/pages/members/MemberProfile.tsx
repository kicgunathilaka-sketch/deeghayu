import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, MapPin, CreditCard, Calendar, Shield, AlertTriangle, Pencil, Camera, X, Check, Sun, Moon, Bell, PenLine, Plus, DollarSign } from 'lucide-react';
import { membersApi } from '../../api/members.api';
import { paymentsApi } from '../../api/payments.api';
import { performanceApi } from '../../api/performance.api';
import { bankAccountsApi } from '../../api/bankAccounts.api';
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
  const canCollect = ['SUPER_ADMIN', 'ADMIN', 'SECRETARY', 'TREASURER', 'PRESIDENT'].includes(user?.role || '');
  const canEdit = isOwnProfile || isAdmin;
  const { theme, toggleTheme } = useUiStore();

  const [editMode, setEditMode] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showSigPad, setShowSigPad] = useState(false);

  // Arrear management
  const [expandedArrear, setExpandedArrear] = useState<string | null>(null); // "year-month" key
  const [collectingArrear, setCollectingArrear] = useState<any | null>(null); // arrear row being paid
  const [collectAmount, setCollectAmount] = useState('');
  const [collectBankAccountId, setCollectBankAccountId] = useState<string>('');
  const [showAddArrear, setShowAddArrear] = useState(false);
  const [addArrearForm, setAddArrearForm] = useState({
    month: String(new Date().getMonth() + 1),
    year: String(new Date().getFullYear()),
    amount: '',
    dueDate: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['member', memberId],
    queryFn: () => membersApi.getById(memberId!).then((r) => r.data.data),
    enabled: !!memberId,
    staleTime: 0,
  });

  const { data: arrearsData } = useQuery({
    queryKey: ['member-arrears', memberId],
    queryFn: () => membersApi.getArrears(memberId!).then((r) => r.data.data),
    enabled: !!memberId,
    staleTime: 0,
  });

  const { data: perfData } = useQuery({
    queryKey: ['performance', memberId],
    queryFn: () => performanceApi.getById(memberId!).then((r) => r.data.data),
    enabled: !!memberId,
    staleTime: 60_000,
  });

  const { data: bankAccounts } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: () => bankAccountsApi.getAll().then((r) => r.data.data as any[]),
    staleTime: 60_000,
    enabled: canCollect,
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

  const invalidateArrears = () => {
    qc.invalidateQueries({ queryKey: ['member-arrears', memberId] });
    qc.invalidateQueries({ queryKey: ['member', memberId] });
    qc.invalidateQueries({ queryKey: ['performance', memberId] });
  };

  // Collect payment on an existing or UNPAID arrear row
  const collectMutation = useMutation({
    mutationFn: async ({ arrear, amount, bankAccountId }: { arrear: any; amount: number; bankAccountId?: string }) => {
      const bankId = bankAccountId || undefined;
      if (arrear.paymentId) {
        // Existing payment record — add to paidAmount cumulatively
        return paymentsApi.update(arrear.paymentId, { paidAmount: amount, bankAccountId: bankId });
      } else {
        // No record yet (UNPAID) — create it with this payment
        return paymentsApi.create({
          memberId: memberId!,
          type: 'MONTHLY_MEETING',
          month: arrear.month,
          year: arrear.year,
          amount: arrear.amount,
          paidAmount: amount,
          bankAccountId: bankId,
        });
      }
    },
    onSuccess: () => {
      invalidateArrears();
      qc.invalidateQueries({ queryKey: ['bank-accounts'] });
      setCollectingArrear(null);
      setCollectAmount('');
      setCollectBankAccountId('');
      toast.success('Payment recorded');
    },
    onError: () => toast.error('Failed to record payment'),
  });

  // Manually add a new arrear record
  const addArrearMutation = useMutation({
    mutationFn: (form: typeof addArrearForm) =>
      paymentsApi.create({
        memberId: memberId!,
        type: 'MONTHLY_MEETING',
        month: Number(form.month),
        year: Number(form.year),
        amount: Number(form.amount),
        paidAmount: 0,
        dueDate: form.dueDate || undefined,
      }),
    onSuccess: () => {
      invalidateArrears();
      setShowAddArrear(false);
      setAddArrearForm({ month: String(new Date().getMonth() + 1), year: String(new Date().getFullYear()), amount: '', dueDate: '' });
      toast.success('Arrear added');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to add arrear'),
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

  // Admin-only user (e.g. SUPER_ADMIN) with no member record — show account settings
  if (!memberId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} />} onClick={() => navigate(-1)}>Back</Button>
          <h1 className="page-title">Account Settings</h1>
        </div>

        <div className="max-w-lg space-y-4">
          {/* Account info */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Shield size={16} /> Account
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <Mail size={14} className="text-slate-400" />
                <span className="text-slate-900 dark:text-slate-100">{user?.email}</span>
              </div>
              <div className="flex items-center gap-3">
                <Shield size={14} className="text-slate-400" />
                <span className="text-slate-900 dark:text-slate-100">{formatRole(user?.role || '')}</span>
              </div>
            </div>
          </div>

          {/* Appearance */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Appearance</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Theme</p>
                <p className="text-xs text-slate-400 mt-0.5">Currently {theme} mode</p>
              </div>
              <Button variant="secondary" size="sm" onClick={toggleTheme}
                icon={theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}>
                Switch to {theme === 'light' ? 'Dark' : 'Light'}
              </Button>
            </div>
          </div>

          {/* Notifications */}
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
        </div>
      </div>
    );
  }

  if (!data) return <div className="text-center py-12 text-slate-500">Member not found</div>;

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
          {arrearsData && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-red-500" />
                  Monthly Fee Arrears
                </h3>
                <div className="flex items-center gap-3">
                  {arrearsData.totalArrears > 0 && (
                    <span className="text-sm font-bold text-red-600 dark:text-red-400">
                      Total: {formatCurrency(arrearsData.totalArrears)}
                    </span>
                  )}
                  {isAdmin && (
                    <Button size="sm" variant="secondary" icon={<Plus size={13} />}
                      onClick={() => {
                        setAddArrearForm(f => ({ ...f, amount: String(arrearsData.monthlyFee || '') }));
                        setShowAddArrear(true);
                      }}>
                      Add Arrear
                    </Button>
                  )}
                </div>
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
                        {canCollect && <th className="text-left text-xs font-semibold text-slate-500 uppercase pb-2 pl-3">Collect</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {arrearsData.arrears.map((a: any) => {
                        const rowKey = a.paymentId || `${a.year}-${a.month}`;
                        const isExpanded = expandedArrear === rowKey;
                        const hasTransactions = a.transactions?.length > 0;
                        return (
                        <tr key={rowKey} className="border-b border-surface-100 dark:border-surface-700">
                          <td className="py-2 font-medium text-slate-900 dark:text-slate-100">
                            <div className="flex items-center gap-1">
                              {hasTransactions && (
                                <button
                                  onClick={() => setExpandedArrear(isExpanded ? null : rowKey)}
                                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                  title="Show payment history"
                                >
                                  <span className="text-xs">{isExpanded ? '▾' : '▸'}</span>
                                </button>
                              )}
                              {a.monthName} {a.year}
                            </div>
                            {isExpanded && hasTransactions && (
                              <div className="mt-1.5 ml-4 space-y-1">
                                {a.transactions.map((tx: any) => (
                                  <div key={tx.id} className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">+{formatCurrency(tx.amount)}</span>
                                    <span>{formatDate(tx.createdAt)}</span>
                                    {tx.bankName && <span className="text-slate-400">→ {tx.bankName}</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
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
                          {canCollect && (
                            <td className="py-2 pl-3 min-w-[200px]">
                              {collectingArrear?.month === a.month && collectingArrear?.year === a.year ? (
                                <div className="flex flex-col gap-1.5">
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      min="0.01"
                                      step="0.01"
                                      max={a.balance}
                                      placeholder={`Amount (max ${formatCurrency(a.balance)})`}
                                      value={collectAmount}
                                      onChange={(e) => setCollectAmount(e.target.value)}
                                      className="input py-1 px-2 text-xs w-36"
                                      autoFocus
                                    />
                                    <button
                                      onClick={() => {
                                        const amt = Number(collectAmount);
                                        if (amt <= 0 || amt > a.balance) return;
                                        collectMutation.mutate({ arrear: a, amount: amt, bankAccountId: collectBankAccountId || undefined });
                                      }}
                                      disabled={!collectAmount || collectMutation.isPending}
                                      className="w-6 h-6 flex items-center justify-center rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
                                    >
                                      <Check size={12} />
                                    </button>
                                    <button
                                      onClick={() => { setCollectingArrear(null); setCollectAmount(''); setCollectBankAccountId(''); }}
                                      className="w-6 h-6 flex items-center justify-center rounded bg-surface-200 dark:bg-surface-700 text-slate-600 dark:text-slate-300 hover:bg-surface-300"
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                  <select
                                    value={collectBankAccountId}
                                    onChange={(e) => setCollectBankAccountId(e.target.value)}
                                    className="input py-1 px-2 text-xs"
                                  >
                                    <option value="">No bank account</option>
                                    {(bankAccounts || []).map((acc: any) => (
                                      <option key={acc.id} value={acc.id}>{acc.name}</option>
                                    ))}
                                  </select>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setCollectingArrear(a);
                                    setCollectAmount(String(a.balance));
                                    setCollectBankAccountId(bankAccounts?.length === 1 ? bankAccounts[0].id : '');
                                  }}
                                  className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 whitespace-nowrap"
                                >
                                  <DollarSign size={12} /> Collect
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Add Arrear Modal */}
          {showAddArrear && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
              <div className="bg-white dark:bg-surface-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 dark:text-slate-100">Add Arrear</h3>
                  <button onClick={() => setShowAddArrear(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Month</label>
                    <select
                      className="input"
                      value={addArrearForm.month}
                      onChange={(e) => setAddArrearForm(f => ({ ...f, month: e.target.value }))}
                    >
                      {['January','February','March','April','May','June','July','August','September','October','November','December'].map((mn, i) => (
                        <option key={i + 1} value={i + 1}>{mn}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Year</label>
                    <input
                      type="number"
                      className="input"
                      value={addArrearForm.year}
                      onChange={(e) => setAddArrearForm(f => ({ ...f, year: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Amount (Rs.)</label>
                  <input
                    type="number"
                    className="input"
                    placeholder={`e.g. ${arrearsData?.monthlyFee || 0}`}
                    value={addArrearForm.amount}
                    onChange={(e) => setAddArrearForm(f => ({ ...f, amount: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="label">Due Date (optional)</label>
                  <input
                    type="date"
                    className="input"
                    value={addArrearForm.dueDate}
                    onChange={(e) => setAddArrearForm(f => ({ ...f, dueDate: e.target.value }))}
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <Button variant="secondary" type="button" onClick={() => setShowAddArrear(false)}>Cancel</Button>
                  <Button
                    type="button"
                    loading={addArrearMutation.isPending}
                    disabled={!addArrearForm.amount || Number(addArrearForm.amount) <= 0}
                    onClick={() => addArrearMutation.mutate(addArrearForm)}
                  >
                    Add Arrear
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Performance Score */}
          {perfData && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  Performance Score
                </h3>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  perfData.grade === 'Excellent' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                  perfData.grade === 'Good' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                  perfData.grade === 'Average' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                  perfData.grade === 'Fair' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>{perfData.grade}</span>
              </div>

              <div className="flex items-center gap-5">
                {/* Score ring */}
                <div className="relative shrink-0">
                  <svg width={80} height={80} style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx={40} cy={40} r={33} fill="none" stroke="#e2e8f0" strokeWidth={7} />
                    <circle
                      cx={40} cy={40} r={33}
                      fill="none"
                      stroke={perfData.gradeColor}
                      strokeWidth={7}
                      strokeDasharray={`${(perfData.score / 100) * 2 * Math.PI * 33} ${2 * Math.PI * 33}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center font-bold text-lg" style={{ color: perfData.gradeColor }}>
                    {perfData.score}
                  </span>
                </div>

                {/* Breakdown bars */}
                <div className="flex-1 space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">Attendance</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{perfData.breakdown.attendance.score}/{perfData.breakdown.attendance.maxScore}</span>
                    </div>
                    <div className="h-2 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(perfData.breakdown.attendance.score / 40) * 100}%` }} />
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {perfData.breakdown.attendance.attended}/{perfData.breakdown.attendance.totalEvents} events
                      {perfData.breakdown.attendance.late > 0 ? ` · ${perfData.breakdown.attendance.late} late` : ''}
                    </p>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">Payments</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{perfData.breakdown.payments.score}/{perfData.breakdown.payments.maxScore}</span>
                    </div>
                    <div className="h-2 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(perfData.breakdown.payments.score / 60) * 100}%` }} />
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {perfData.breakdown.payments.paidOnTime} on time
                      {perfData.breakdown.payments.overdue > 0 ? ` · ${perfData.breakdown.payments.overdue} overdue` : ''}
                      {perfData.breakdown.payments.unpaid > 0 ? ` · ${perfData.breakdown.payments.unpaid} unpaid` : ''}
                    </p>
                  </div>
                </div>
              </div>
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
                    <p className="text-sm font-semibold">
                      {(p.status === 'OVERDUE' || p.status === 'PARTIAL')
                        ? formatCurrency(Number(p.amount) - Number(p.paidAmount))
                        : formatCurrency(Number(p.paidAmount || p.amount))}
                    </p>
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
