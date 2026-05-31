'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, getUserRole, getDashboardPath } from '@/lib/auth/utils';

/**
 * Admin login page - redirects to common login with admin role selected
 * This ensures we use a single login page for all user types
 */
export default function AdminLoginPage() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is already logged in
    if (isAuthenticated()) {
      const role = getUserRole();
      if (role === 'admin') {
        // Already logged in as admin, go to dashboard
        router.push('/admin');
      } else {
        // Logged in as different role, go to their dashboard
        router.push(getDashboardPath(role));
      }
    } else {
      // Not logged in, redirect to common login with admin role selected
      router.push('/login?role=admin');
    }
  }, [router]);

  // Show loading while redirecting
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to login...</p>
      </div>
    </div>
  );
}

