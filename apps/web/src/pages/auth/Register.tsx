import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';
import { authApi } from '../../api/auth.api';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

const schema = z.object({
  fullName: z.string().min(2, 'Full name required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Min 8 characters').regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Must include upper, lower, and number'),
  nic: z.string().min(9, 'Valid NIC required'),
  phone: z.string().min(9, 'Valid phone required'),
  address: z.string().min(5, 'Address required'),
  occupation: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      await authApi.register(data);
      toast.success('Registration successful! Your account is pending admin approval.');
      navigate('/login');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">Join Deeghayu</h2>
      <p className="text-slate-500 text-sm mb-6">Create your member account</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Input label="Full Name" placeholder="Your full name" error={errors.fullName?.message} {...register('fullName')} />
          </div>
          <div className="col-span-2">
            <Input label="Email" type="email" placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
          </div>
          <div className="col-span-2">
            <Input label="Password" type="password" placeholder="Min 8 chars, upper+lower+number" error={errors.password?.message} {...register('password')} />
          </div>
          <Input label="NIC Number" placeholder="000000000V" error={errors.nic?.message} {...register('nic')} />
          <Input label="Phone" placeholder="+94 77 000 0000" error={errors.phone?.message} {...register('phone')} />
          <div className="col-span-2">
            <Input label="Address" placeholder="Your full address" error={errors.address?.message} {...register('address')} />
          </div>
          <div className="col-span-2">
            <Input label="Occupation (optional)" placeholder="e.g. Teacher, Engineer" error={errors.occupation?.message} {...register('occupation')} />
          </div>
        </div>

        <Button type="submit" loading={isSubmitting} className="w-full" icon={<UserPlus size={16} />}>
          Create Account
        </Button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        Already a member?{' '}
        <Link to="/login" className="text-primary-600 font-medium hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
