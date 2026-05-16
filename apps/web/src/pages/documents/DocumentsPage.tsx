import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { FileText, Download, Eye } from 'lucide-react';
import { documentsApi } from '../../api/documents.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { toast } from 'sonner';
import { useAuthStore } from '../../store/authStore';
import { formatRole } from '../../utils/formatters';

function LetterPreview({ values }: { values: any }) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  const ref = `DCW/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

  return (
    <div className="bg-white shadow-xl rounded-xl overflow-hidden text-slate-800" style={{ fontFamily: 'Georgia, serif', fontSize: 13 }}>
      {/* Letterhead */}
      <div style={{ background: '#0c3a5e', padding: '22px 32px 18px', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* Logo placeholder */}
          <div style={{
            width: 58, height: 58, borderRadius: '50%',
            background: '#1d5080', border: '2px solid #4a90c4',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, color: '#93c5ea', fontSize: 10, fontFamily: 'sans-serif', fontWeight: 700,
          }}>LOGO</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: 0.3 }}>
              Deeghayu Community Welfare Society
            </div>
            <div style={{ color: '#93c5ea', fontSize: 11, marginTop: 3 }}>Koligala, Handapangoda.</div>
            <div style={{ color: '#6daed6', fontSize: 10, fontStyle: 'italic', marginTop: 2 }}>
              Building Community. Enriching Lives.
            </div>
          </div>
        </div>
      </div>
      <div style={{ height: 5, background: '#1d8cf8' }} />
      <div style={{ height: 2, background: '#e8f4ff' }} />

      {/* Body */}
      <div style={{ padding: '24px 32px 28px' }}>
        {/* Ref + Date */}
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', fontSize: 11, marginBottom: 14 }}>
          <span>Ref: {ref}</span>
          <span>{dateStr}</span>
        </div>
        <hr style={{ borderColor: '#e2e8f0', marginBottom: 18 }} />

        {/* Receiver */}
        <div style={{ marginBottom: 18, lineHeight: 1.7 }}>
          <div>To,</div>
          <div style={{ fontWeight: 700 }}>{values.receiverName || 'Receiver Name'}</div>
          {values.receiverDesignation && <div style={{ color: '#334155' }}>{values.receiverDesignation}</div>}
          {(values.receiverAddress || '').split('\n').map((line: string, i: number) => (
            <div key={i} style={{ color: '#334155' }}>{line}</div>
          ))}
        </div>

        {/* Subject */}
        {values.subject && (
          <div style={{ fontWeight: 700, textDecoration: 'underline', marginBottom: 14 }}>
            Subject: {values.subject}
          </div>
        )}

        {/* Salutation */}
        <div style={{ marginBottom: 14 }}>Dear {values.receiverName || 'Sir/Madam'},</div>

        {/* Content */}
        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, textAlign: 'justify', color: '#1e293b', marginBottom: 24 }}>
          {values.content || 'Your letter content will appear here...'}
        </div>

        {/* Closing */}
        <div style={{ marginBottom: 48 }}>Yours faithfully,</div>

        {/* Signature */}
        <div>
          <div style={{ width: 160, borderTop: '1px solid #475569', marginBottom: 6 }} />
          <div style={{ fontWeight: 700 }}>{values.senderName || 'Secretary'}</div>
          <div style={{ color: '#475569', fontSize: 12 }}>{values.senderDesignation || 'Secretary'}</div>
          <div style={{ color: '#475569', fontSize: 12 }}>Deeghayu Community Welfare Society</div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid #e2e8f0', padding: '10px 32px', textAlign: 'center', color: '#94a3b8', fontSize: 10 }}>
        Deeghayu Community Welfare Society · Kotigala, Handapangoda.
      </div>
    </div>
  );
}

export default function DocumentsPage() {
  const { user } = useAuthStore();
  const [downloading, setDownloading] = useState(false);
  const [tab, setTab] = useState<'form' | 'preview'>('form');

  const { register, handleSubmit, control, formState: { errors } } = useForm({
    defaultValues: {
      receiverName: '',
      receiverDesignation: '',
      receiverAddress: '',
      subject: '',
      content: '',
      senderName: user?.member?.fullName || '',
      senderDesignation: formatRole(user?.role || ''),
    },
  });

  const values = useWatch({ control });

  const onDownload = handleSubmit(async (data) => {
    setDownloading(true);
    try {
      const res = await documentsApi.createLetter(data);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `letter-${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Letter downloaded');
    } catch {
      toast.error('Failed to generate letter');
    } finally {
      setDownloading(false);
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title flex items-center gap-2">
          <FileText size={22} className="text-primary-600" />
          Documents
        </h1>
      </div>

      {/* Mobile tab switcher */}
      <div className="flex lg:hidden gap-2 border-b border-surface-200 dark:border-surface-700">
        {(['form', 'preview'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'form' ? 'Edit' : 'Preview'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ── Form ─────────────────────────────────────── */}
        <div className={`card p-6 space-y-4 ${tab === 'preview' ? 'hidden lg:block' : ''}`}>
          <h2 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-2">
            Create Letter
          </h2>

          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Receiver Details</p>
            <Input
              label="Receiver Name"
              placeholder="e.g. Mr. A. B. Perera"
              error={errors.receiverName?.message as string}
              {...register('receiverName', { required: 'Required' })}
            />
            <Input
              label="Designation (optional)"
              placeholder="e.g. The Manager, Bank of Ceylon"
              {...register('receiverDesignation')}
            />
            <div>
              <label className="label">Address</label>
              <textarea
                className="input min-h-[80px] resize-none"
                placeholder={'No. 12, Main Street\nColombo 01'}
                {...register('receiverAddress', { required: 'Required' })}
              />
              {errors.receiverAddress && (
                <p className="text-xs text-red-500 mt-1">{errors.receiverAddress.message as string}</p>
              )}
            </div>
          </div>

          <hr className="border-surface-200 dark:border-surface-700" />

          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Letter Content</p>
            <Input
              label="Subject (optional)"
              placeholder="e.g. Request for Bank Statement"
              {...register('subject')}
            />
            <div>
              <label className="label">Content</label>
              <textarea
                className="input resize-none"
                style={{ minHeight: 200 }}
                placeholder="Write the body of the letter here..."
                {...register('content', { required: 'Required' })}
              />
              {errors.content && (
                <p className="text-xs text-red-500 mt-1">{errors.content.message as string}</p>
              )}
            </div>
          </div>

          <hr className="border-surface-200 dark:border-surface-700" />

          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Sender (Signature)</p>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Name" placeholder="Secretary" {...register('senderName')} />
              <Input label="Designation" placeholder="Secretary" {...register('senderDesignation')} />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="secondary"
              icon={<Eye size={15} />}
              type="button"
              onClick={() => setTab('preview')}
              className="lg:hidden"
            >
              Preview
            </Button>
            <Button
              icon={<Download size={15} />}
              loading={downloading}
              onClick={onDownload}
              type="button"
            >
              Download PDF
            </Button>
          </div>
        </div>

        {/* ── Live Preview ──────────────────────────────── */}
        <div className={`${tab === 'form' ? 'hidden lg:block' : ''}`}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Eye size={13} /> Live Preview
            </p>
            <Button
              size="sm"
              icon={<Download size={13} />}
              loading={downloading}
              onClick={onDownload}
              type="button"
            >
              Download PDF
            </Button>
          </div>
          <LetterPreview values={values} />
        </div>
      </div>
    </div>
  );
}
