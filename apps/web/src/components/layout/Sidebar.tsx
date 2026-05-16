import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, CreditCard, Calendar, QrCode,
  Users2, BarChart3, Bell, Settings, LogOut, ChevronLeft,
  Shield, Wallet, ClipboardList, Images, FileText, Trophy, ArrowUpRight
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useUiStore } from '../../store/uiStore';
import { cn } from '../../utils/cn';
import { formatRole } from '../../utils/formatters';
import { authApi } from '../../api/auth.api';
import { toast } from 'sonner';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'PRESIDENT', 'VICE_PRESIDENT', 'SECRETARY', 'TREASURER', 'COMMITTEE_MEMBER'];

const allNavItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: '*' },
  { to: '/scan', icon: QrCode, label: 'Scan QR', roles: '*' },
  { to: '/members', icon: Users, label: 'Members', roles: ADMIN_ROLES },
  { to: '/members/approvals', icon: ClipboardList, label: 'Approvals', roles: ['SUPER_ADMIN', 'ADMIN', 'SECRETARY'] },
  { to: '/payments', icon: CreditCard, label: 'Payments', roles: '*' },
  { to: '/payments/treasurer', icon: Wallet, label: 'Treasurer', roles: ['SUPER_ADMIN', 'ADMIN', 'TREASURER'] },
  { to: '/payments/expenses', icon: ArrowUpRight, label: 'Expenses', roles: ['SUPER_ADMIN', 'ADMIN', 'TREASURER'] },
  { to: '/events', icon: Calendar, label: 'Events', roles: '*' },
  { to: '/gallery', icon: Images, label: 'Gallery', roles: '*' },
  { to: '/performance', icon: Trophy, label: 'Performance', roles: '*' },
  { to: '/attendance', icon: QrCode, label: 'Attendance', roles: ADMIN_ROLES },
  { to: '/committee', icon: Users2, label: 'Committee', roles: ['SUPER_ADMIN', 'ADMIN', 'PRESIDENT'] },
  { to: '/reports', icon: BarChart3, label: 'Reports', roles: ADMIN_ROLES },
  { to: '/documents', icon: FileText, label: 'Documents', roles: ['SUPER_ADMIN', 'ADMIN', 'PRESIDENT', 'SECRETARY'] },
  { to: '/settings', icon: Settings, label: 'Settings', roles: '*' },
];

export default function Sidebar() {
  const { user, logout, refreshToken } = useAuthStore();
  const { sidebarOpen, toggleSidebar } = useUiStore();
  const navigate = useNavigate();

  const navItems = allNavItems.filter((item) => {
    if (item.roles === '*') return true;
    return user && (item.roles as string[]).includes(user.role);
  });

  const handleLogout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {}
    logout();
    navigate('/login');
    toast.success('Logged out successfully');
  };

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-20 lg:hidden"
            onClick={toggleSidebar}
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 256 : 72 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className={cn(
          'fixed left-0 top-0 bottom-0 z-30 flex flex-col',
          'bg-surface-900 dark:bg-surface-950 border-r border-surface-800',
          'overflow-hidden',
          'lg:relative lg:flex',
          !sidebarOpen && 'hidden lg:flex'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-surface-800 min-h-[64px]">
          <AnimatePresence mode="wait">
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3"
              >
                <span className="text-2xl">🌿</span>
                <div>
                  <p className="text-white font-bold text-sm">Deeghayu</p>
                  <p className="text-slate-400 text-xs">Community</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {!sidebarOpen && <span className="text-2xl mx-auto">🌿</span>}

          <button
            onClick={toggleSidebar}
            className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-surface-800 transition-colors"
          >
            <motion.div animate={{ rotate: sidebarOpen ? 0 : 180 }}>
              <ChevronLeft size={16} />
            </motion.div>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-surface-800'
                )
              }
            >
              <item.icon size={18} className="shrink-0" />
              <AnimatePresence mode="wait">
                {sidebarOpen && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="truncate"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-surface-800">
          <div className={cn('flex items-center gap-3 px-2 py-2 rounded-lg', sidebarOpen && 'mb-2')}>
            <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center shrink-0">
              <span className="text-white text-sm font-medium">
                {user?.member?.fullName?.[0] || user?.email?.[0] || '?'}
              </span>
            </div>
            <AnimatePresence mode="wait">
              {sidebarOpen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">{user?.member?.fullName || user?.email}</p>
                  <p className="text-slate-400 text-xs truncate">{formatRole(user?.role || '')}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button
            onClick={handleLogout}
            className={cn(
              'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium',
              'text-slate-400 hover:text-red-400 hover:bg-red-900/20 transition-colors'
            )}
          >
            <LogOut size={18} className="shrink-0" />
            <AnimatePresence mode="wait">
              {sidebarOpen && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  Logout
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </motion.aside>
    </>
  );
}
