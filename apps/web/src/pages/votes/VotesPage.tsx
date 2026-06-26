import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ThumbsUp, ThumbsDown, Vote, Lock, CheckCircle2, Trash2, PlayCircle, Users, EyeOff } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { votesApi } from '../../api/votes.api';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDate } from '../../utils/formatters';
import { toast } from 'sonner';
import { cn } from '../../utils/cn';

const CAN_MANAGE = ['SUPER_ADMIN', 'ADMIN', 'PRESIDENT', 'SECRETARY'];

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    DRAFT: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
    CLOSED: 'bg-surface-100 text-slate-500 dark:bg-surface-700 dark:text-slate-400',
  };
  const labels: Record<string, string> = { DRAFT: 'Draft', ACTIVE: 'Active', CLOSED: 'Closed' };
  return (
    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', styles[status] ?? styles.DRAFT)}>
      {labels[status] ?? status}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  return type === 'ANONYMOUS' ? (
    <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400">
      <EyeOff size={10} /> Anonymous
    </span>
  ) : (
    <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
      <Users size={10} /> Poll
    </span>
  );
}

function ProgressBar({ value, max, color = 'primary' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const barColor = color === 'green' ? 'bg-green-500' : color === 'red' ? 'bg-red-500' : color === 'blue' ? 'bg-blue-500' : 'bg-primary-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500 w-10 text-right">{pct}%</span>
    </div>
  );
}

// ── Detail / Voting Modal ──────────────────────────────────────────────────────
function VoteDetailModal({ voteId, onClose, canManage }: { voteId: string; onClose: () => void; canManage: boolean }) {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const hasMember = !!user?.member;
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const { data: res, isLoading } = useQuery({
    queryKey: ['vote', voteId],
    queryFn: () => votesApi.getById(voteId).then((r) => r.data.data),
    enabled: !!voteId,
  });
  const vote = res as any;

  const respondMut = useMutation({
    mutationFn: (response: string) => votesApi.respond(voteId, response),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vote', voteId] });
      qc.invalidateQueries({ queryKey: ['votes'] });
      toast.success('Vote recorded');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to cast vote'),
  });

  const removeMut = useMutation({
    mutationFn: () => votesApi.removeResponse(voteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vote', voteId] });
      qc.invalidateQueries({ queryKey: ['votes'] });
      toast.success('Vote removed');
    },
    onError: () => toast.error('Failed to remove vote'),
  });

  const statusMut = useMutation({
    mutationFn: (status: string) => votesApi.setStatus(voteId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vote', voteId] });
      qc.invalidateQueries({ queryKey: ['votes'] });
      toast.success('Status updated');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to update status'),
  });

  if (isLoading || !vote) {
    return (
      <Modal isOpen onClose={onClose} size="lg">
        <div className="py-12 text-center text-slate-400 text-sm">Loading…</div>
      </Modal>
    );
  }

  const isActive = vote.status === 'ACTIVE';
  const isClosed = vote.status === 'CLOSED';
  const isDraft = vote.status === 'DRAFT';
  const myResponse = vote.myResponse;
  const canVote = hasMember && isActive;

  // ── Anonymous vote UI ────────────────────────────────────────────────────
  const renderAnonymous = () => {
    const hasOptions = (vote.options?.length ?? 0) > 0;

    // Anonymous with custom options — same voting UI as public poll, but results hide names
    if (hasOptions) {
      const options: any[] = vote.options ?? [];
      const total: number = vote.totalResponses ?? 0;
      const showVoting = canVote && !myResponse;
      return (
        <div className="space-y-5">
          {showVoting && (
            <div className="space-y-2">
              {options.map((opt: any) => (
                <label
                  key={opt.id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all',
                    selectedOption === opt.id
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-surface-200 dark:border-surface-700 hover:border-purple-300'
                  )}
                >
                  <input
                    type="radio"
                    name="vote-option"
                    value={opt.id}
                    checked={selectedOption === opt.id}
                    onChange={() => setSelectedOption(opt.id)}
                    className="accent-purple-600"
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{opt.label}</span>
                </label>
              ))}
              <Button
                className="w-full mt-2"
                disabled={!selectedOption}
                loading={respondMut.isPending}
                onClick={() => selectedOption && respondMut.mutate(selectedOption)}
              >
                Submit Vote
              </Button>
            </div>
          )}

          {canVote && myResponse && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
              <CheckCircle2 size={16} className="text-purple-600 dark:text-purple-400 shrink-0" />
              <span className="text-sm text-purple-700 dark:text-purple-300">
                You voted: <strong>{options.find((o: any) => o.id === myResponse)?.label}</strong>
              </span>
              <button
                onClick={() => removeMut.mutate()}
                disabled={removeMut.isPending}
                className="ml-auto text-xs text-slate-400 hover:text-red-500 underline"
              >
                Change
              </button>
            </div>
          )}

          {!hasMember && isActive && (
            <p className="text-center text-sm text-slate-400">Only members can cast votes.</p>
          )}

          {(total > 0 || isClosed || myResponse) && (
            <div className="rounded-xl bg-surface-50 dark:bg-surface-800/50 p-4 space-y-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Results — {total} response{total !== 1 ? 's' : ''} <span className="font-normal text-slate-400">(votes are anonymous)</span>
              </p>
              {options.map((opt: any, i: number) => {
                const colors = ['blue', 'green', 'red', 'primary'];
                return (
                  <div key={opt.id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className={cn('font-medium', myResponse === opt.id && 'text-purple-600 dark:text-purple-400')}>
                        {opt.label}
                        {myResponse === opt.id && <CheckCircle2 size={12} className="inline ml-1" />}
                      </span>
                      <span className="text-slate-500">{opt.voteCount}</span>
                    </div>
                    <ProgressBar value={opt.voteCount} max={total} color={colors[i % colors.length]} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    // Anonymous without options — classic like / dislike
    const { likes = 0, dislikes = 0, total = 0 } = vote.results ?? {};
    return (
      <div className="space-y-5">
        {canVote && (
          <div className="flex gap-3">
            <button
              onClick={() => respondMut.mutate('LIKE')}
              disabled={respondMut.isPending}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-medium transition-all',
                myResponse === 'LIKE'
                  ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'border-surface-200 dark:border-surface-700 hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 text-slate-600 dark:text-slate-300'
              )}
            >
              <ThumbsUp size={20} /> Like
            </button>
            <button
              onClick={() => respondMut.mutate('DISLIKE')}
              disabled={respondMut.isPending}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-medium transition-all',
                myResponse === 'DISLIKE'
                  ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  : 'border-surface-200 dark:border-surface-700 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-600 dark:text-slate-300'
              )}
            >
              <ThumbsDown size={20} /> Dislike
            </button>
          </div>
        )}

        {!hasMember && isActive && (
          <p className="text-center text-sm text-slate-400">Only members can cast votes.</p>
        )}

        {(total > 0 || isClosed) && (
          <div className="rounded-xl bg-surface-50 dark:bg-surface-800/50 p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Results — {total} response{total !== 1 ? 's' : ''}</p>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400 font-medium"><ThumbsUp size={14} /> Like</span>
                  <span className="text-slate-500">{likes}</span>
                </div>
                <ProgressBar value={likes} max={total} color="green" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="flex items-center gap-1.5 text-red-500 dark:text-red-400 font-medium"><ThumbsDown size={14} /> Dislike</span>
                  <span className="text-slate-500">{dislikes}</span>
                </div>
                <ProgressBar value={dislikes} max={total} color="red" />
              </div>
            </div>
          </div>
        )}

        {myResponse && isActive && (
          <button
            onClick={() => removeMut.mutate()}
            disabled={removeMut.isPending}
            className="text-xs text-slate-400 hover:text-red-500 underline"
          >
            Remove my vote
          </button>
        )}
      </div>
    );
  };

  // ── Public poll UI ───────────────────────────────────────────────────────
  const renderPublic = () => {
    const options: any[] = vote.options ?? [];
    const total: number = vote.totalResponses ?? 0;
    const showVoting = canVote && !myResponse;

    return (
      <div className="space-y-5">
        {showVoting && (
          <div className="space-y-2">
            {options.map((opt: any) => (
              <label
                key={opt.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all',
                  selectedOption === opt.id
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-surface-200 dark:border-surface-700 hover:border-primary-300'
                )}
              >
                <input
                  type="radio"
                  name="vote-option"
                  value={opt.id}
                  checked={selectedOption === opt.id}
                  onChange={() => setSelectedOption(opt.id)}
                  className="accent-primary-600"
                />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{opt.label}</span>
              </label>
            ))}
            <Button
              className="w-full mt-2"
              disabled={!selectedOption}
              loading={respondMut.isPending}
              onClick={() => selectedOption && respondMut.mutate(selectedOption)}
            >
              Submit Vote
            </Button>
          </div>
        )}

        {canVote && myResponse && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800">
            <CheckCircle2 size={16} className="text-primary-600 dark:text-primary-400 shrink-0" />
            <span className="text-sm text-primary-700 dark:text-primary-300">
              You voted: <strong>{options.find((o: any) => o.id === myResponse)?.label}</strong>
            </span>
            <button
              onClick={() => removeMut.mutate()}
              disabled={removeMut.isPending}
              className="ml-auto text-xs text-slate-400 hover:text-red-500 underline"
            >
              Change
            </button>
          </div>
        )}

        {!hasMember && isActive && (
          <p className="text-center text-sm text-slate-400">Only members can cast votes.</p>
        )}

        {(total > 0 || isClosed || myResponse) && (
          <div className="rounded-xl bg-surface-50 dark:bg-surface-800/50 p-4 space-y-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Results — {total} response{total !== 1 ? 's' : ''}</p>
            {options.map((opt: any, i: number) => {
              const colors = ['blue', 'green', 'red', 'primary'];
              return (
                <div key={opt.id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className={cn('font-medium', myResponse === opt.id && 'text-primary-600 dark:text-primary-400')}>
                      {opt.label}
                      {myResponse === opt.id && <CheckCircle2 size={12} className="inline ml-1" />}
                    </span>
                    <span className="text-slate-500">{opt.voteCount}</span>
                  </div>
                  <ProgressBar value={opt.voteCount} max={total} color={colors[i % colors.length]} />
                  {opt.voters?.length > 0 && (
                    <p className="text-xs text-slate-400 pl-1">
                      {opt.voters.slice(0, 5).map((v: any) => v.fullName).join(', ')}
                      {opt.voters.length > 5 && ` +${opt.voters.length - 5} more`}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal isOpen onClose={onClose} title={vote.title} size="lg">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <TypeBadge type={vote.type} />
          <StatusBadge status={vote.status} />
          {vote.type === 'ANONYMOUS' && (
            <span className="text-xs text-slate-400">Votes are anonymous — only counts are shown</span>
          )}
        </div>

        {vote.description && (
          <p className="text-sm text-slate-600 dark:text-slate-300">{vote.description}</p>
        )}

        {vote.type === 'ANONYMOUS' ? renderAnonymous() : renderPublic()}

        {canManage && !isClosed && (
          <div className="flex justify-end gap-2 pt-2 border-t border-surface-200 dark:border-surface-700">
            {isDraft && (
              <Button
                size="sm"
                variant="outline"
                icon={<PlayCircle size={14} />}
                loading={statusMut.isPending}
                onClick={() => statusMut.mutate('ACTIVE')}
              >
                Open Voting
              </Button>
            )}
            {isActive && (
              <Button
                size="sm"
                variant="secondary"
                icon={<Lock size={14} />}
                loading={statusMut.isPending}
                onClick={() => statusMut.mutate('CLOSED')}
              >
                Close Vote
              </Button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Create Vote Modal ─────────────────────────────────────────────────────────
function CreateVoteModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [voteType, setVoteType] = useState<'ANONYMOUS' | 'PUBLIC'>('ANONYMOUS');
  const [options, setOptions] = useState(['', '']);
  const { register, handleSubmit, formState: { errors } } = useForm();

  const createMut = useMutation({
    mutationFn: (data: any) => votesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['votes'] });
      toast.success('Vote created');
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to create vote'),
  });

  const onSubmit = (data: any) => {
    const filledOptions = options.filter((o) => o.trim());
    createMut.mutate({
      ...data,
      type: voteType,
      // Send options for both types; backend ignores empty arrays / validates PUBLIC has ≥2
      options: filledOptions.length >= 2 ? filledOptions : undefined,
    });
  };

  const updateOption = (i: number, val: string) => {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? val : o)));
  };

  return (
    <Modal isOpen onClose={onClose} title="Create Vote" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Title"
          placeholder="What are we voting on?"
          {...register('title', { required: 'Title is required' })}
          error={errors.title?.message as string}
        />

        <div>
          <label className="label">Description (optional)</label>
          <textarea
            className="input min-h-[72px] resize-y"
            placeholder="Add context or details…"
            {...register('description')}
          />
        </div>

        <div>
          <label className="label">Vote Type</label>
          <div className="grid grid-cols-2 gap-3 mt-1">
            <button
              type="button"
              onClick={() => setVoteType('ANONYMOUS')}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-sm',
                voteType === 'ANONYMOUS'
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                  : 'border-surface-200 dark:border-surface-700 text-slate-500 hover:border-purple-300'
              )}
            >
              <EyeOff size={20} />
              <div>
                <p className="font-semibold">Anonymous</p>
                <p className="text-xs opacity-70">Results hide names</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setVoteType('PUBLIC')}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-sm',
                voteType === 'PUBLIC'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : 'border-surface-200 dark:border-surface-700 text-slate-500 hover:border-blue-300'
              )}
            >
              <Users size={20} />
              <div>
                <p className="font-semibold">Public</p>
                <p className="text-xs opacity-70">Results show names</p>
              </div>
            </button>
          </div>
        </div>

        <div>
          <label className="label">
            Poll Options
            {voteType === 'ANONYMOUS' && (
              <span className="ml-2 font-normal text-slate-400 text-xs">
                (optional — leave blank for Like / Dislike)
              </span>
            )}
          </label>
          <div className="space-y-2 mt-1">
            {options.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder={`Option ${i + 1}`}
                  value={opt}
                  onChange={(e) => updateOption(i, e.target.value)}
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))}
                    className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            {options.length < 8 && (
              <button
                type="button"
                onClick={() => setOptions((prev) => [...prev, ''])}
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
              >
                + Add option
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Start Date (optional)" type="date" {...register('startDate')} />
          <Input label="End Date (optional)" type="date" {...register('endDate')} />
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={createMut.isPending}>Create Vote</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function VotesPage() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canManage = CAN_MANAGE.includes(user?.role ?? '');
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role ?? '');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const { data: votesRes, isLoading } = useQuery({
    queryKey: ['votes'],
    queryFn: () => votesApi.getAll().then((r) => r.data.data),
  });
  const allVotes: any[] = votesRes ?? [];

  const votes = allVotes.filter((v) => {
    if (statusFilter && v.status !== statusFilter) return false;
    if (typeFilter && v.type !== typeFilter) return false;
    return true;
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => votesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['votes'] });
      toast.success('Vote deleted');
    },
    onError: () => toast.error('Failed to delete vote'),
  });

  const confirmDelete = (vote: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Delete "${vote.title}"? This cannot be undone.`)) {
      deleteMut.mutate(vote.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Voting</h1>
          <p className="text-sm text-slate-500 mt-1">Community votes and polls</p>
        </div>
        {canManage && (
          <Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>
            Create Vote
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <select
          className="input !w-auto"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="ACTIVE">Active</option>
          <option value="CLOSED">Closed</option>
        </select>
        <select
          className="input !w-auto"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All types</option>
          <option value="ANONYMOUS">Anonymous</option>
          <option value="PUBLIC">Poll</option>
        </select>
      </div>

      {/* Votes grid */}
      {isLoading ? (
        <div className="card p-8 text-center text-slate-400 text-sm">Loading…</div>
      ) : votes.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            icon={Vote}
            title="No votes yet"
            description={canManage ? 'Create the first vote using the button above' : 'No votes have been created yet'}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {votes.map((vote: any) => {
            const myResponse = vote.myResponse;
            const isActive = vote.status === 'ACTIVE';
            const isClosed = vote.status === 'CLOSED';

            return (
              <div
                key={vote.id}
                onClick={() => setSelectedId(vote.id)}
                className="card p-5 flex flex-col gap-3 cursor-pointer hover:shadow-md hover:border-primary-300 dark:hover:border-primary-700 transition-all"
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    <TypeBadge type={vote.type} />
                    <StatusBadge status={vote.status} />
                  </div>
                  {isAdmin && (
                    <button
                      onClick={(e) => confirmDelete(vote, e)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                {/* Title + description */}
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm leading-snug">{vote.title}</h3>
                  {vote.description && (
                    <p className="mt-1 text-xs text-slate-500 line-clamp-2">{vote.description}</p>
                  )}
                </div>

                {/* Meta */}
                <div className="flex items-center justify-between text-xs text-slate-400 mt-auto">
                  <span>{vote.createdByName || vote.createdByEmail || 'Admin'}</span>
                  <span>{formatDate(vote.createdAt, 'PP')}</span>
                </div>

                {/* Footer */}
                <div className="pt-2 border-t border-surface-100 dark:border-surface-700 flex items-center justify-between">
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Users size={12} /> {vote.responseCount ?? 0} response{vote.responseCount !== 1 ? 's' : ''}
                  </span>

                  {isActive && !myResponse && vote.type === 'ANONYMOUS' && (
                    <span className="text-xs font-medium text-primary-600 dark:text-primary-400">Vote now</span>
                  )}
                  {isActive && myResponse && vote.type === 'ANONYMOUS' && (
                    <span className={cn('text-xs font-medium flex items-center gap-1', myResponse === 'LIKE' ? 'text-green-600' : 'text-red-500')}>
                      {myResponse === 'LIKE' ? <ThumbsUp size={12} /> : <ThumbsDown size={12} />} Voted
                    </span>
                  )}
                  {isActive && vote.type === 'PUBLIC' && !myResponse && (
                    <span className="text-xs font-medium text-primary-600 dark:text-primary-400">Vote now</span>
                  )}
                  {isActive && vote.type === 'PUBLIC' && myResponse && (
                    <span className="text-xs font-medium text-primary-600 dark:text-primary-400 flex items-center gap-1">
                      <CheckCircle2 size={12} /> Voted
                    </span>
                  )}
                  {isClosed && (
                    <span className="text-xs text-slate-400 flex items-center gap-1"><Lock size={11} /> Closed</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedId && (
        <VoteDetailModal
          voteId={selectedId}
          onClose={() => setSelectedId(null)}
          canManage={canManage}
        />
      )}
      {showCreate && <CreateVoteModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
