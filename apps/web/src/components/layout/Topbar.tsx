import { Menu, Sun, Moon, Bell, Search } from 'lucide-react';
import { useUiStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Topbar() {
  const { toggleSidebar, toggleTheme, theme } = useUiStore();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) navigate(`/members?search=${encodeURIComponent(search)}`);
  };

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
        <button
          onClick={() => navigate('/settings')}
          className="relative p-2 rounded-lg text-slate-500 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
        >
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* Profile */}
        <button
          onClick={() => navigate('/profile')}
          className="flex items-center gap-2 pl-2"
        >
          <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center">
            <span className="text-white text-sm font-medium">
              {user?.member?.fullName?.[0] || user?.email?.[0] || '?'}
            </span>
          </div>
          <span className="hidden md:block text-sm font-medium text-slate-700 dark:text-slate-200">
            {user?.member?.fullName?.split(' ')[0] || 'User'}
          </span>
        </button>
      </div>
    </header>
  );
}
