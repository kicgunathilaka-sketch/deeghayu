import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import logo from '../../assets/logo.png';

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-accent-600 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur rounded-2xl mb-4 p-1">
            <img src={logo} alt="Deeghayu" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-white">Deeghayu</h1>
          <p className="text-primary-200 mt-1">Community Management</p>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-surface-800 rounded-2xl shadow-2xl p-8"
        >
          <Outlet />
        </motion.div>
      </div>
    </div>
  );
}
