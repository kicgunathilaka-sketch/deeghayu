import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Mail } from 'lucide-react';
import { authApi } from '../../api/auth.api';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useState } from 'react';

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<{ email: string }>();

  const onSubmit = async ({ email }: { email: string }) => {
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      toast.error('Something went wrong');
    }
  };

  if (sent) {
    return (
      <div className="text-center">
        <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Mail size={24} className="text-primary-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Check your email</h2>
        <p className="text-slate-500 text-sm mb-6">If your email is registered, you'll receive a password reset link shortly.</p>
        <Link to="/login" className="text-primary-600 text-sm font-medium hover:underline">Back to login</Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">Forgot password?</h2>
      <p className="text-slate-500 text-sm mb-6">Enter your email and we'll send a reset link.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Email" type="email" placeholder="you@example.com" {...register('email', { required: true })} />
        <Button type="submit" loading={isSubmitting} className="w-full" icon={<Mail size={16} />}>Send Reset Link</Button>
      </form>
      <p className="text-center text-sm text-slate-500 mt-6">
        <Link to="/login" className="text-primary-600 hover:underline">Back to login</Link>
      </p>
    </div>
  );
}
