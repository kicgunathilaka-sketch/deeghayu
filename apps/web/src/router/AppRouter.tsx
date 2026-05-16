import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppLayout from '../components/layout/AppLayout';
import AuthLayout from '../components/layout/AuthLayout';

// Auth pages
import LoginPage from '../pages/auth/Login';
import RegisterPage from '../pages/auth/Register';
import ForgotPasswordPage from '../pages/auth/ForgotPassword';
import ResetPasswordPage from '../pages/auth/ResetPassword';

// Public
import LandingPage from '../pages/Landing';

// Dashboard
import AdminDashboard from '../pages/dashboard/AdminDashboard';
import MemberDashboard from '../pages/dashboard/MemberDashboard';

// Members
import MembersPage from '../pages/members/MembersPage';
import MemberProfilePage from '../pages/members/MemberProfile';
import MemberApprovalsPage from '../pages/members/MemberApprovals';

// Payments
import PaymentsPage from '../pages/payments/PaymentsPage';
import TreasurerDashboardPage from '../pages/payments/TreasurerDashboard';
import ExpensesPage from '../pages/payments/ExpensesPage';

// Events
import EventsPage from '../pages/events/EventsPage';
import EventDetailPage from '../pages/events/EventDetail';
import EventCreatePage from '../pages/events/EventCreate';

// Attendance
import AttendancePage from '../pages/attendance/AttendancePage';
import QRScanPage from '../pages/attendance/QRScanPage';

// Committee
import CommitteePage from '../pages/committee/CommitteePage';

// Reports
import ReportsPage from '../pages/reports/ReportsPage';

// Gallery
import GalleryPage from '../pages/gallery/GalleryPage';

// Documents
import DocumentsPage from '../pages/documents/DocumentsPage';

// Performance
import PerformancePage from '../pages/performance/PerformancePage';

// Settings
import SettingsPage from '../pages/settings/SettingsPage';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'PRESIDENT', 'VICE_PRESIDENT', 'SECRETARY', 'TREASURER', 'COMMITTEE_MEMBER'];

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (!ADMIN_ROLES.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <>{children}</>;
}

export default function AppRouter() {
  const { user } = useAuthStore();

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />

      {/* Auth */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
      </Route>

      {/* Protected App */}
      <Route element={<PrivateRoute><AppLayout /></PrivateRoute>}>
        <Route path="/dashboard" element={
          ADMIN_ROLES.includes(user?.role || '') ? <AdminDashboard /> : <MemberDashboard />
        } />

        {/* Members */}
        <Route path="/members" element={<AdminRoute><MembersPage /></AdminRoute>} />
        <Route path="/members/approvals" element={<AdminRoute><MemberApprovalsPage /></AdminRoute>} />
        <Route path="/members/:id" element={<MemberProfilePage />} />
        <Route path="/profile" element={<MemberProfilePage />} />

        {/* Payments */}
        <Route path="/payments" element={<PaymentsPage />} />
        <Route path="/payments/treasurer" element={<AdminRoute><TreasurerDashboardPage /></AdminRoute>} />
        <Route path="/payments/expenses" element={<AdminRoute><ExpensesPage /></AdminRoute>} />

        {/* Events */}
        <Route path="/events" element={<EventsPage />} />
        <Route path="/events/create" element={<AdminRoute><EventCreatePage /></AdminRoute>} />
        <Route path="/events/:id" element={<EventDetailPage />} />
        <Route path="/events/:id/edit" element={<AdminRoute><EventCreatePage /></AdminRoute>} />

        {/* Attendance */}
        <Route path="/attendance" element={<AdminRoute><AttendancePage /></AdminRoute>} />
        <Route path="/scan" element={<QRScanPage />} />

        {/* Committee */}
        <Route path="/committee" element={<AdminRoute><CommitteePage /></AdminRoute>} />

        {/* Reports */}
        <Route path="/reports" element={<AdminRoute><ReportsPage /></AdminRoute>} />

        {/* Gallery */}
        <Route path="/gallery" element={<GalleryPage />} />

        {/* Performance */}
        <Route path="/performance" element={<PerformancePage />} />

        {/* Documents */}
        <Route path="/documents" element={<AdminRoute><DocumentsPage /></AdminRoute>} />

        {/* Settings */}
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
