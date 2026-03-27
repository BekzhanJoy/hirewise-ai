'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAppPreferences } from '@/components/AppPreferencesProvider';

export default function HomePage() {
  const router = useRouter();
  const { t } = useAppPreferences();

  useEffect(() => {
    router.push('/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-app">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-highlight" />
        <p className="text-muted-app">{t('loadingApp')}</p>
      </div>
    </div>
  );
}
