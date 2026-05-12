import { Link } from 'react-router-dom';

export default function VerifyEmailPage() {
  return (
    <div className="text-center">
      <p className="text-slate-500 text-sm mb-4">This page is no longer in use.</p>
      <Link to="/login" className="text-primary-600 font-medium hover:underline">Go to Login</Link>
    </div>
  );
}
