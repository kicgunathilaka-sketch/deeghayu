import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Trophy, Search, TrendingUp, CalendarCheck, CreditCard, Medal } from 'lucide-react';
import { performanceApi } from '../../api/performance.api';
import { PageLoader } from '../../components/ui/Spinner';

const GRADE_BG: Record<string, string> = {
  Excellent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  Good: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Average: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Fair: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'Needs Improvement': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const RANK_STYLE: Record<number, string> = {
  1: 'bg-yellow-400 text-yellow-900',
  2: 'bg-slate-300 text-slate-700',
  3: 'bg-amber-600 text-amber-100',
};

function ScoreRing({ score, color, size = 64 }: { score: number; color: string; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={6} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text
        x={size / 2} y={size / 2 + 5}
        textAnchor="middle"
        fontSize={size > 56 ? 15 : 12}
        fontWeight="bold"
        fill="currentColor"
        style={{ transform: 'rotate(90deg)', transformOrigin: `${size / 2}px ${size / 2}px`, fill: color }}
      >
        {score}
      </text>
    </svg>
  );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="flex-1 h-1.5 bg-surface-200 dark:bg-surface-600 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-slate-500 w-8 text-right">{value}/{max}</span>
    </div>
  );
}

export default function PerformancePage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data: members, isLoading } = useQuery({
    queryKey: ['performance-all'],
    queryFn: () => performanceApi.getAll().then((r) => r.data.data),
    staleTime: 60_000,
  });

  if (isLoading) return <PageLoader />;

  const filtered = (members ?? []).filter((m: any) =>
    m.fullName.toLowerCase().includes(search.toLowerCase()) ||
    m.membershipId.toLowerCase().includes(search.toLowerCase())
  );

  const top3 = (members ?? []).slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="page-title flex items-center gap-2">
          <Trophy size={22} className="text-amber-500" />
          Member Performance
        </h1>
        <span className="text-sm text-slate-500">{(members ?? []).length} active members</span>
      </div>

      {/* Top 3 podium */}
      {top3.length >= 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {top3.map((m: any) => (
            <div
              key={m.memberId}
              onClick={() => navigate(`/members/${m.memberId}`)}
              className="card p-5 flex flex-col items-center gap-3 cursor-pointer hover:shadow-md transition-shadow relative"
            >
              {/* Rank badge */}
              <span className={`absolute top-3 left-3 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${RANK_STYLE[m.rank] || 'bg-surface-200 text-slate-600'}`}>
                {m.rank === 1 ? '🥇' : m.rank === 2 ? '🥈' : '🥉'}
              </span>
              {/* Avatar */}
              <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center overflow-hidden mt-2">
                {m.profilePhoto
                  ? <img src={m.profilePhoto} alt="" className="w-full h-full object-cover" />
                  : <span className="text-2xl font-bold text-primary-600">{m.fullName[0]}</span>
                }
              </div>
              <div className="text-center">
                <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{m.fullName}</p>
                <p className="text-xs text-slate-400 font-mono">{m.membershipId}</p>
              </div>
              <ScoreRing score={m.score} color={m.gradeColor} size={64} />
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${GRADE_BG[m.grade]}`}>{m.grade}</span>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="input pl-9 w-full sm:max-w-xs"
          placeholder="Search member..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Full leaderboard */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-50 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700">
            <tr>
              {['Rank', 'Member', 'Score', 'Attendance', 'Payments', 'Grade'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
            {filtered.map((m: any) => (
              <tr
                key={m.memberId}
                onClick={() => navigate(`/members/${m.memberId}`)}
                className="hover:bg-surface-50 dark:hover:bg-surface-800 cursor-pointer transition-colors"
              >
                {/* Rank */}
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${RANK_STYLE[m.rank] || 'bg-surface-100 dark:bg-surface-700 text-slate-600 dark:text-slate-300'}`}>
                    {m.rank}
                  </span>
                </td>

                {/* Member */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center overflow-hidden shrink-0">
                      {m.profilePhoto
                        ? <img src={m.profilePhoto} alt="" className="w-full h-full object-cover" />
                        : <span className="text-sm font-bold text-primary-600">{m.fullName[0]}</span>
                      }
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{m.fullName}</p>
                      <p className="text-xs text-slate-400 font-mono">{m.membershipId}</p>
                    </div>
                  </div>
                </td>

                {/* Score */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-surface-200 dark:bg-surface-600 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${m.score}%`, background: m.gradeColor }} />
                    </div>
                    <span className="font-bold text-slate-900 dark:text-slate-100" style={{ color: m.gradeColor }}>{m.score}</span>
                  </div>
                </td>

                {/* Attendance */}
                <td className="px-4 py-3">
                  <div className="space-y-1 min-w-[110px]">
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <CalendarCheck size={11} />
                      <span>{m.breakdown.attendance.attendanceRate}% attended</span>
                    </div>
                    <MiniBar value={m.breakdown.attendance.attended} max={m.breakdown.attendance.totalEvents} color="#3b82f6" />
                    <div className="text-xs text-slate-400">
                      {m.breakdown.attendance.late > 0 && `${m.breakdown.attendance.late} late`}
                      {m.breakdown.attendance.late === 0 && m.breakdown.attendance.attended > 0 && '✓ always on time'}
                    </div>
                  </div>
                </td>

                {/* Payments */}
                <td className="px-4 py-3">
                  <div className="space-y-1 min-w-[120px]">
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <CreditCard size={11} />
                      <span>{m.breakdown.payments.paidOnTime} on time</span>
                    </div>
                    <MiniBar
                      value={m.breakdown.payments.paidOnTime}
                      max={m.breakdown.payments.expectedMonths}
                      color="#10b981"
                    />
                    <div className="text-xs text-slate-400">
                      {m.breakdown.payments.overdue > 0 && <span className="text-red-500">{m.breakdown.payments.overdue} overdue</span>}
                      {m.breakdown.payments.unpaid > 0 && <span className="text-slate-400 ml-1">{m.breakdown.payments.unpaid} unpaid</span>}
                      {m.breakdown.payments.overdue === 0 && m.breakdown.payments.unpaid === 0 && '✓ all paid'}
                    </div>
                  </div>
                </td>

                {/* Grade */}
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${GRADE_BG[m.grade]}`}>
                    {m.grade}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center py-8 text-sm text-slate-400">No members found</p>
        )}
      </div>

      {/* Scoring legend */}
      <div className="card p-5">
        <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Medal size={16} className="text-slate-400" /> How Scores Are Calculated
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
          <div>
            <p className="font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1">
              <CalendarCheck size={14} /> Attendance (0–40 pts)
            </p>
            <ul className="space-y-1 text-slate-500 text-xs">
              <li>• Attendance rate × 30 pts</li>
              <li>• Punctuality rate × 10 pts</li>
              <li className="text-slate-400 italic">Based on all events since you joined</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1">
              <CreditCard size={14} /> Monthly Payments (0–60 pts)
            </p>
            <ul className="space-y-1 text-slate-500 text-xs">
              <li>• Paid on time → full credit</li>
              <li>• Paid late → 60% credit</li>
              <li>• Partial → proportional credit</li>
              <li>• Overdue / Unpaid → 0 credit</li>
            </ul>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {[
            { label: 'Excellent', range: '90–100', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
            { label: 'Good', range: '75–89', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
            { label: 'Average', range: '60–74', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
            { label: 'Fair', range: '45–59', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
            { label: 'Needs Improvement', range: '0–44', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
          ].map((g) => (
            <span key={g.label} className={`text-xs font-medium px-2.5 py-1 rounded-full ${g.color}`}>
              {g.label} ({g.range})
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
