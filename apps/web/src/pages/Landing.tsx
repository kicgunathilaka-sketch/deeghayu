import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, QrCode, CreditCard, BarChart3, Calendar, Shield, ArrowRight, CheckCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';

const features = [
  { icon: Users, title: 'Member Management', desc: 'Complete member profiles with QR identity, attendance history, and payment tracking.' },
  { icon: QrCode, title: 'QR Attendance', desc: 'Members scan event QR codes with their mobile for instant, secure check-in.' },
  { icon: CreditCard, title: 'Payment Tracking', desc: 'Monthly fees, donations, receipts, and financial analytics in one place.' },
  { icon: Calendar, title: 'Event Management', desc: 'Create events, manage RSVPs, QR check-in, and post-event galleries.' },
  { icon: BarChart3, title: 'Analytics & Reports', desc: 'Detailed PDF/Excel reports for members, finance, and attendance.' },
  { icon: Shield, title: 'Secure & Role-Based', desc: 'JWT authentication with granular role permissions for every action.' },
];

const highlights = [
  'QR-based event attendance',
  'Yearly committee panels',
  'PDF receipt generation',
  'Dark & light mode',
  'Mobile-first design',
  'Real-time analytics',
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white dark:bg-surface-900">
      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 dark:bg-surface-900/80 backdrop-blur border-b border-surface-200 dark:border-surface-800">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌿</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">Deeghayu Community</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>Login</Button>
            <Button size="sm" onClick={() => navigate('/register')}>Join Now</Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 text-center bg-gradient-to-br from-primary-900 via-primary-800 to-accent-700">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/10 text-white text-sm px-4 py-1.5 rounded-full mb-6">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            Community Management Platform
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-6 leading-tight">
            Manage Your Community<br />
            <span className="text-primary-300">Smarter & Faster</span>
          </h1>
          <p className="text-xl text-primary-200 mb-8 max-w-xl mx-auto">
            Members, payments, QR attendance, committee panels, and reports — all in one elegant platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" className="!bg-white !text-primary-700 hover:!bg-primary-50" icon={<ArrowRight size={18} />} onClick={() => navigate('/register')}>
              Get Started Free
            </Button>
            <Button size="lg" variant="ghost" className="!text-white !border !border-white/30 hover:!bg-white/10" onClick={() => navigate('/login')}>
              Sign In
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Highlights */}
      <section className="py-12 px-4 bg-surface-50 dark:bg-surface-900">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {highlights.map((h, i) => (
              <motion.div
                key={h}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
              >
                <CheckCircle size={16} className="text-emerald-500 shrink-0" />
                {h}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">Everything you need</h2>
            <p className="text-slate-500 text-lg">A complete toolkit for modern community management</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className="card p-6 hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center mb-4">
                  <f.icon size={22} className="text-primary-600" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-gradient-to-r from-primary-600 to-accent-600 text-white text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to modernize your community?</h2>
        <p className="text-primary-100 mb-8 text-lg">Join Deeghayu Community today</p>
        <Button size="lg" className="!bg-white !text-primary-700 hover:!bg-primary-50" onClick={() => navigate('/register')}>
          Register Now
        </Button>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-surface-200 dark:border-surface-800 text-center text-sm text-slate-400">
        <p>© {new Date().getFullYear()} Deeghayu Community. Built with ❤️</p>
      </footer>
    </div>
  );
}
