import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, ClipboardList } from 'lucide-react';
import { membersApi } from '../../api/members.api';
import { Button } from '../../components/ui/Button';
import { PageLoader } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDate } from '../../utils/formatters';
import { toast } from 'sonner';

export default function MemberApprovalsPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['pending-members'],
    queryFn: () => membersApi.getAll({ status: 'PENDING' }).then((r) => r.data),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => membersApi.updateStatus(id, status),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pending-members'] });
      toast.success(vars.status === 'ACTIVE' ? 'Member approved' : 'Member rejected');
    },
    onError: () => toast.error('Action failed'),
  });

  if (isLoading) return <PageLoader />;

  const members = data?.data || [];

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Member Approvals</h1>
          <p className="text-sm text-slate-500 mt-1">{members.length} pending registration{members.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {members.length === 0 ? (
        <div className="card p-8">
          <EmptyState icon={ClipboardList} title="No pending approvals" description="All registrations have been processed" />
        </div>
      ) : (
        <div className="grid gap-4">
          {members.map((member: any) => (
            <div key={member.id} className="card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
                <span className="text-primary-600 font-bold text-lg">{member.fullName[0]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">{member.fullName}</h3>
                <p className="text-sm text-slate-500">{member.user?.email} · {member.phone}</p>
                <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-400">
                  <span>NIC: {member.nic}</span>
                  <span>Registered: {formatDate(member.createdAt)}</span>
                  <span>ID: {member.membershipId}</span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="danger"
                  size="sm"
                  icon={<XCircle size={14} />}
                  loading={approveMutation.isPending}
                  onClick={() => approveMutation.mutate({ id: member.id, status: 'INACTIVE' })}
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  icon={<CheckCircle size={14} />}
                  loading={approveMutation.isPending}
                  onClick={() => approveMutation.mutate({ id: member.id, status: 'ACTIVE' })}
                >
                  Approve
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
