'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './_components/Sidebar';
import { Toaster } from './_components/ui/sonner';
import { getUserRole, isAuthenticated } from '@/lib/auth/utils';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login?role=admin');
      return;
    }

    if (getUserRole() !== 'admin') {
      router.replace('/login');
      return;
    }

    setAuthorized(true);
  }, [router]);

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm font-medium text-slate-600">Verifying admin access...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="min-w-0 flex-1 bg-slate-50">{children}</main>
      <Toaster />
    </div>
  );
}
