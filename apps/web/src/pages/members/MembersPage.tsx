import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Search, Filter, Download } from 'lucide-react';
import { membersApi } from '../../api/members.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { StatusBadge } from '../../components/ui/Badge';
import { PageLoader, SkeletonCard } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDate, downloadBlob } from '../../utils/formatters';
import { resolveMediaUrl } from '../../utils/media';
import { toast } from 'sonner';
import { useDebounce } from '../../hooks/useDebounce';

export default function MembersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 400);

  const { data, isLoading } = useQuery({
    queryKey: ['members', debouncedSearch, statusFilter, page],
    queryFn: () => membersApi.getAll({ search: debouncedSearch, status: statusFilter || undefined, page }).then((r) => r.data),
  });

  const handleExport = async (format: string) => {
    try {
      const res = await membersApi.export(format);
      const ext = format === 'excel' ? 'xlsx' : format;
      downloadBlob(res.data, `members.${ext}`);
      toast.success('Export downloaded');
    } catch {
      toast.error('Export failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Members</h1>
          <p className="text-sm text-slate-500 mt-1">{data?.meta?.total || 0} total members</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" icon={<Download size={16} />} onClick={() => handleExport('excel')}>Export</Button>
          <Button onClick={() => navigate('/members/approvals')} icon={<Plus size={16} />}>Approvals</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search by name, ID, NIC, phone..."
          leftIcon={<Search size={15} />}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="flex-1"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="input w-full sm:w-44"
        >
          <option value="">All Status</option>
          {['ACTIVE', 'PENDING', 'INACTIVE', 'SUSPENDED'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-50 dark:bg-surface-800/50 border-b border-surface-200 dark:border-surface-700">
                {['Member', 'Membership ID', 'NIC', 'Phone', 'Status', 'Joined', 'Action'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-surface-200 dark:bg-surface-700 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data?.data?.length ? (
                data.data.map((member: any) => (
                  <tr
                    key={member.id}
                    onClick={() => navigate(`/members/${member.id}`)}
                    className="hover:bg-surface-50 dark:hover:bg-surface-800 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
                          {member.profilePhoto ? (
                            <img src={resolveMediaUrl(member.profilePhoto)} alt="" className="w-9 h-9 rounded-full object-cover" />
                          ) : (
                            <span className="text-primary-600 font-semibold text-sm">{member.fullName[0]}</span>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-slate-100">{member.fullName}</p>
                          <p className="text-xs text-slate-400">{member.user?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">{member.membershipId}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{member.nic}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{member.phone}</td>
                    <td className="px-4 py-3"><StatusBadge status={member.status} /></td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(member.dateJoined, 'PP')}</td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/members/${member.id}`); }}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7}>
                    <EmptyState icon={Users} title="No members found" description="Try adjusting your search or filters" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data?.meta && (
          <div className="px-4 py-3 border-t border-surface-200 dark:border-surface-700 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Page {data.meta.page} of {data.meta.totalPages} · {data.meta.total} results
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={!data.meta.hasPrev} onClick={() => setPage(p => p - 1)}>Prev</Button>
              <Button variant="secondary" size="sm" disabled={!data.meta.hasNext} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
