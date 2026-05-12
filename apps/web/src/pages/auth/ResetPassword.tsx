import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';
import { authApi } from '../../api/auth.api';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { register, handleSubmit, watch, formState: { isSubmitting, errors } } = useForm<{ password: string; confirm: string }>();

  const onSubmit = async ({ password }: { password: string }) => {
    try {
      await authApi.resetPassword(token!, password);
      toast.success('Password reset successfully');
      navigate('/login');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Reset failed');
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">Reset password</h2>
      <p className="text-slate-500 text-sm mb-6">Enter your new password below.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="New Password" type="password" placeholder="Min 8 chars" error={errors.password?.message}
          {...register('password', { required: true, minLength: { value: 8, message: 'Min 8 characters' } })} />
        <Input label="Confirm Password" type="password" placeholder="Repeat password" error={errors.confirm?.message}
          {...register('confirm', {
            validate: (val) => val === watch('password') || 'Passwords do not match',
          })} />
        <Button type="submit" loading={isSubmitting} className="w-full" icon={<Lock size={16} />}>Reset Password</Button>
      </form>
    </div>
  );
}
