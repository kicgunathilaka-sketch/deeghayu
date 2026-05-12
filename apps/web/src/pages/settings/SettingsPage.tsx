import { useUiStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { Sun, Moon, User, Bell } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { formatRole, formatDate } from '../../utils/formatters';

export default function SettingsPage() {
  const { theme, toggleTheme } = useUiStore();
  const { user } = useAuthStore();

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="page-title">Settings</h1>

      {/* Profile Info */}
      <div className="card p-6">
        <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <User size={18} /> Account
        </h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-surface-100 dark:border-surface-700">
            <span className="text-slate-500">Name</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">{user?.member?.fullName || '—'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-surface-100 dark:border-surface-700">
            <span className="text-slate-500">Email</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">{user?.email}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-surface-100 dark:border-surface-700">
            <span className="text-slate-500">Role</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">{formatRole(user?.role || '')}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-slate-500">Member ID</span>
            <span className="font-mono text-slate-900 dark:text-slate-100">{user?.member?.membershipId || '—'}</span>
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="card p-6">
        <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Appearance</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Theme</p>
            <p className="text-xs text-slate-400 mt-0.5">Currently {theme} mode</p>
          </div>
          <Button
            variant="secondary"
            onClick={toggleTheme}
            icon={theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          >
            Switch to {theme === 'light' ? 'Dark' : 'Light'}
          </Button>
        </div>
      </div>

      {/* Notifications */}
      <div className="card p-6">
        <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Bell size={18} /> Notifications
        </h2>
        <div className="space-y-4">
          {[
            { label: 'Payment reminders', desc: 'Get notified when payment is due' },
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
  );
}
