'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { isAdminOnlyPortal } from '@/lib/config/portal-mode';

export function PortalModeGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(!isAdminOnlyPortal());

  useEffect(() => {
    if (isAdminOnlyPortal()) {
      router.replace('/admin/login');
      return;
    }
    setAllowed(true);
  }, [router]);

  if (!allowed) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50"><p className="text-sm font-medium text-slate-600">Opening admin portal…</p></div>;
  }
  return <>{children}</>;
}
