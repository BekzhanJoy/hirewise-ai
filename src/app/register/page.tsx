'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { FileSearch, Mail, Lock, User } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth-context';
import { useAppPreferences } from '@/components/AppPreferencesProvider';

const registerSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { signUp } = useAuth();
  const { t } = useAppPreferences();
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterFormData>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    try {
      const { error } = await signUp(data.email, data.password, data.fullName);
      if (error) {
        toast.error(error.message || 'Failed to create account');
        return;
      }
      toast.success(t('createAccount'));
      router.push('/login');
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-app flex items-center justify-center p-4">
      <div className="absolute inset-0 header-gradient opacity-80" />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative z-10 w-full max-w-md">
        <Card className="bg-surface border-app shadow-2xl">
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto w-16 h-16 bg-surface-soft rounded-full flex items-center justify-center">
              <FileSearch className="w-8 h-8 text-highlight" />
            </div>
            <CardTitle className="text-2xl font-bold text-white">{t('appName')}</CardTitle>
            <CardDescription className="text-muted-app">{t('registerSubtitle')}</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-muted-app">{t('fullName')}</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-app" />
                  <Input id="fullName" type="text" placeholder="John Doe" className="pl-10 bg-surface-2 border-app text-white placeholder:text-muted-app" {...register('fullName')} />
                </div>
                {errors.fullName && <p className="text-sm text-red-400">{errors.fullName.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-muted-app">{t('email')}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-app" />
                  <Input id="email" type="email" placeholder="you@example.com" className="pl-10 bg-surface-2 border-app text-white placeholder:text-muted-app" {...register('email')} />
                </div>
                {errors.email && <p className="text-sm text-red-400">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-muted-app">{t('password')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-app" />
                  <Input id="password" type="password" placeholder="Min. 6 characters" className="pl-10 bg-surface-2 border-app text-white placeholder:text-muted-app" {...register('password')} />
                </div>
                {errors.password && <p className="text-sm text-red-400">{errors.password.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-muted-app">{t('confirmPassword')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-app" />
                  <Input id="confirmPassword" type="password" placeholder={t('confirmPassword')} className="pl-10 bg-surface-2 border-app text-white placeholder:text-muted-app" {...register('confirmPassword')} />
                </div>
                {errors.confirmPassword && <p className="text-sm text-red-400">{errors.confirmPassword.message}</p>}
              </div>

              <Button type="submit" disabled={isLoading} className="w-full bg-accent-app text-on-accent font-semibold transition-colors hover:opacity-90">
                {isLoading ? `${t('createAccount')}...` : t('createAccount')}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="justify-center">
            <p className="text-sm text-muted-app">
              {t('alreadyHaveAccount')} <a href="/login" className="text-accent font-medium transition-colors">{t('signIn')}</a>
            </p>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}
