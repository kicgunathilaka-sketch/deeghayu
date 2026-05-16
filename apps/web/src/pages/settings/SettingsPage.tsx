import { useUiStore } from '../../store/uiStore';
import { Sun, Moon } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export default function SettingsPage() {
  const { theme, toggleTheme } = useUiStore();

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="page-title">Settings</h1>

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
    </div>
  );
}
