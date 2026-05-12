import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Calendar, Plus, MapPin, Users, Clock } from 'lucide-react';
import { eventsApi } from '../../api/events.api';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageLoader } from '../../components/ui/Spinner';
import { formatDate } from '../../utils/formatters';
import { motion } from 'framer-motion';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SECRETARY', 'PRESIDENT'];
const CATEGORY_LABELS: Record<string, string> = {
  MONTHLY_MEETING: 'Monthly Meeting',
  SPECIAL_MEETING: 'Special Meeting',
  COMMUNITY_EVENT: 'Community Event',
  VOLUNTEER_EVENT: 'Volunteer Event',
  RELIGIOUS_EVENT: 'Religious Event',
  OTHER: 'Other',
};

export default function EventsPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const isAdmin = ADMIN_ROLES.includes(user?.role || '');
  const [statusFilter, setStatusFilter] = useState('PUBLISHED');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['events', statusFilter, page],
    queryFn: () => eventsApi.getAll({ status: statusFilter || undefined, page }).then((r) => r.data),
  });

  if (isLoading) return <PageLoader />;

  const events = data?.data || [];

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Events</h1>
        <div className="flex gap-2">
          {isAdmin && (
            <Button icon={<Plus size={16} />} onClick={() => navigate('/events/create')}>Create Event</Button>
          )}
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2 flex-wrap">
        {['', 'PUBLISHED', 'ONGOING', 'COMPLETED', 'DRAFT'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === s
                ? 'bg-primary-600 text-white'
                : 'bg-surface-100 dark:bg-surface-800 text-slate-600 dark:text-slate-300 hover:bg-surface-200 dark:hover:bg-surface-700'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {events.length === 0 ? (
        <div className="card p-8">
          <EmptyState icon={Calendar} title="No events found" description="Check back later for upcoming events" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {events.map((event: any, i: number) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/events/${event.id}`)}
            >
              {event.coverImage ? (
                <img src={event.coverImage} alt="" className="w-full h-40 object-cover" />
              ) : (
                <div className="w-full h-32 bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center">
                  <Calendar size={40} className="text-white/70" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-2">{event.title}</h3>
                  <StatusBadge status={event.status} className="shrink-0" />
                </div>
                <p className="text-xs text-slate-500 mb-3">{CATEGORY_LABELS[event.category] || event.category}</p>
                <div className="space-y-1.5 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <Clock size={12} />
                    <span>{formatDate(event.startTime, 'PPp')}</span>
                  </div>
                  {event.location && (
                    <div className="flex items-center gap-2">
                      <MapPin size={12} />
                      <span className="truncate">{event.location}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Users size={12} />
                    <span>{event._count?.attendances || 0} attendees</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {data?.meta && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="secondary" size="sm" disabled={!data.meta.hasPrev} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="text-sm text-slate-500">Page {data.meta.page} of {data.meta.totalPages}</span>
          <Button variant="secondary" size="sm" disabled={!data.meta.hasNext} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
