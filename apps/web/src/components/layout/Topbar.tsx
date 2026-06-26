import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Menu, Sun, Moon, Bell, Search } from 'lucide-react';
import { useUiStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import { notificationsApi } from '../../api/notifications.api';
import { formatDate } from '../../utils/formatters';
import { resolveMediaUrl } from '../../utils/media';

export default function Topbar() {
  const { toggleSidebar, toggleTheme, theme } = useUiStore();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const navigate = useNavigate();
  const notifRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.getAll().then((r) => r.data.data),
    refetchInterval: 30_000,
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) navigate(`/members?search=${encodeURIComponent(search)}`);
  };

  const unreadCount = (notifications as any[])?.filter((n) => !n.isRead).length ?? 0;

  return (
    <header className="h-16 bg-white dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700 flex items-center gap-4 px-4 sticky top-0 z-10">
      {/* Mobile menu toggle */}
      <button
        onClick={toggleSidebar}
        className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
      >
        <Menu size={20} />
      </button>

      {/* Search */}
      <form onSubmit={handleSearch} className="hidden sm:flex flex-1 max-w-md">
        <div className="relative w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-surface-100 dark:bg-surface-700 border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white dark:focus:bg-surface-800 transition-all"
          />
        </div>
      </form>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-slate-500 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
          title="Toggle theme"
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setShowNotifications((v) => !v)}
            className="relative p-2 rounded-lg text-slate-500 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
            title="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-surface-100 dark:border-surface-700">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                  Notifications {unreadCount > 0 && <span className="ml-1 text-xs text-slate-400">({unreadCount} unread)</span>}
                </h3>
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllMutation.mutate()}
                    className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-96 overflow-y-auto divide-y divide-surface-50 dark:divide-surface-700">
                {!(notifications as any[])?.length ? (
                  <div className="px-4 py-8 text-center">
                    <Bell size={24} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="text-sm text-slate-400">No notifications yet</p>
                  </div>
                ) : (
                  (notifications as any[]).map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        if (!n.isRead) markReadMutation.mutate(n.id);
                        if (n.link) navigate(n.link);
                        setShowNotifications(false);
                      }}
                      className={`px-4 py-3 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-700 flex items-start gap-3 transition-colors ${
                        !n.isRead ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${!n.isRead ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'}`}>
                          {n.title}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>
                        <p className="text-xs text-slate-300 dark:text-slate-500 mt-1">
                          {formatDate(n.createdAt, 'PPp')}
                        </p>
                      </div>
                      {!n.isRead && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <button
          onClick={() => navigate('/profile')}
          className="flex items-center gap-2 pl-2"
        >
          <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center overflow-hidden">
            {user?.member?.profilePhoto ? (
              <img src={resolveMediaUrl(user.member.profilePhoto)} alt="" className="w-8 h-8 object-cover" />
            ) : (
              <span className="text-white text-sm font-medium">
                {user?.member?.fullName?.[0] || user?.email?.[0] || '?'}
              </span>
            )}
          </div>
          <span className="hidden md:block text-sm font-medium text-slate-700 dark:text-slate-200">
            {user?.member?.fullName?.split(' ')[0] || 'User'}
          </span>
        </button>
      </div>
    </header>
  );
}
