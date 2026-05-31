'use client';

import { Suspense } from 'react';
import { UsersManagement } from '../_components/pages/UsersManagement';
import { Loader2 } from 'lucide-react';

export default function AdminUsersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    }>
      <UsersManagement />
    </Suspense>
  );
}












