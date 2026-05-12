import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users2, Plus, Crown, ChevronDown, ChevronUp } from 'lucide-react';
import { committeeApi } from '../../api/committee.api';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input, Select } from '../../components/ui/Input';
import { PageLoader } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDate, formatRole } from '../../utils/formatters';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';

const ROLE_OPTIONS = [
  { value: 'PRESIDENT', label: 'President' },
  { value: 'VICE_PRESIDENT', label: 'Vice President' },
  { value: 'SECRETARY', label: 'Secretary' },
  { value: 'TREASURER', label: 'Treasurer' },
  { value: 'COMMITTEE_MEMBER', label: 'Committee Member' },
];

const ROLE_ICONS: Record<string, string> = {
  PRESIDENT: '👑',
  VICE_PRESIDENT: '🌟',
  SECRETARY: '📋',
  TREASURER: '💰',
  COMMITTEE_MEMBER: '👥',
};

export default function CommitteePage() {
  const qc = useQueryClient();
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showAddRole, setShowAddRole] = useState<string | null>(null);
  const [expandedPanel, setExpandedPanel] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['committee-panels'],
    queryFn: () => committeeApi.getAllPanels().then((r) => r.data.data),
  });

  const createPanelMutation = useMutation({
    mutationFn: (data: any) => committeeApi.createPanel(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['committee-panels'] });
      setShowAddPanel(false);
      toast.success('Panel created');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const assignRoleMutation = useMutation({
    mutationFn: ({ panelId, data }: { panelId: string; data: any }) => committeeApi.assignRole(panelId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['committee-panels'] });
      setShowAddRole(null);
      toast.success('Role assigned');
    },
    onError: () => toast.error('Failed to assign role'),
  });

  const panelForm = useForm();
  const roleForm = useForm();

  if (isLoading) return <PageLoader />;

  const panels = data || [];

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Committee Panels</h1>
          <p className="text-sm text-slate-500 mt-1">Yearly committee management</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => setShowAddPanel(true)}>New Panel</Button>
      </div>

      {panels.length === 0 ? (
        <div className="card p-8">
          <EmptyState icon={Users2} title="No committee panels yet" description="Create your first yearly panel" action={
            <Button icon={<Plus size={16} />} onClick={() => setShowAddPanel(true)}>Create Panel</Button>
          } />
        </div>
      ) : (
        <div className="space-y-4">
          {panels.map((panel: any) => (
            <div key={panel.id} className="card overflow-hidden">
              <div
                className="flex items-center justify-between p-5 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors"
                onClick={() => setExpandedPanel(expandedPanel === panel.id ? null : panel.id)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${panel.isActive ? 'bg-primary-100 dark:bg-primary-900/30' : 'bg-surface-100 dark:bg-surface-700'}`}>
                    <Crown size={18} className={panel.isActive ? 'text-primary-600' : 'text-slate-400'} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                      {panel.year} Committee Panel
                      {panel.isActive && <span className="ml-2 text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-600 px-2 py-0.5 rounded-full">Active</span>}
                    </h3>
                    <p className="text-sm text-slate-400">{panel.roles?.length || 0} members assigned</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={(e) => { e.stopPropagation(); setShowAddRole(panel.id); }}>
                    Add Role
                  </Button>
                  {expandedPanel === panel.id ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                </div>
              </div>

              <AnimatePresence>
                {expandedPanel === panel.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-surface-200 dark:border-surface-700 p-5">
                      {panel.roles?.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {panel.roles.map((role: any) => (
                            <div key={role.id} className="flex items-center gap-3 p-3 bg-surface-50 dark:bg-surface-800 rounded-xl">
                              <span className="text-2xl">{ROLE_ICONS[role.role] || '👤'}</span>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{role.member?.fullName}</p>
                                <p className="text-xs text-slate-400">{formatRole(role.role)}</p>
                                <p className="text-xs text-slate-400 font-mono">{role.member?.membershipId}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400 text-center py-4">No roles assigned yet</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      {/* Create Panel Modal */}
      <Modal isOpen={showAddPanel} onClose={() => setShowAddPanel(false)} title="Create Committee Panel">
        <form onSubmit={panelForm.handleSubmit((data) => createPanelMutation.mutate(data))} className="space-y-4">
          <Input label="Year" type="number" defaultValue={new Date().getFullYear()} {...panelForm.register('year', { required: true, valueAsNumber: true })} />
          <div>
            <label className="label">Notes (optional)</label>
            <textarea className="input" rows={3} {...panelForm.register('notes')} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" type="button" onClick={() => setShowAddPanel(false)}>Cancel</Button>
            <Button type="submit" loading={createPanelMutation.isPending}>Create Panel</Button>
          </div>
        </form>
      </Modal>

      {/* Assign Role Modal */}
      <Modal isOpen={!!showAddRole} onClose={() => setShowAddRole(null)} title="Assign Role">
        <form onSubmit={roleForm.handleSubmit((data) => assignRoleMutation.mutate({ panelId: showAddRole!, data }))} className="space-y-4">
          <Input label="Member ID (UUID)" placeholder="Member's ID" {...roleForm.register('memberId', { required: true })} />
          <Select label="Role" options={ROLE_OPTIONS} {...roleForm.register('role', { required: true })} />
          <Input label="Start Date" type="date" defaultValue={new Date().toISOString().split('T')[0]} {...roleForm.register('startDate', { required: true })} />
          <div>
            <label className="label">Notes (optional)</label>
            <textarea className="input" rows={2} {...roleForm.register('notes')} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" type="button" onClick={() => setShowAddRole(null)}>Cancel</Button>
            <Button type="submit" loading={assignRoleMutation.isPending}>Assign</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
