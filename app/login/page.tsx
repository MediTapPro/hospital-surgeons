'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
// import Header from '../components/Header';
import { isAuthenticated, getUserRole, getDashboardPath, decodeToken } from '@/lib/auth/utils';
import apiClient from '@/lib/api/httpClient';

type AccountType = 'doctor' | 'hospital' | 'admin';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get('role') as AccountType | null;
  
  const [accountType, setAccountType] = useState<AccountType>(roleParam || 'doctor');
  const registeredParam = searchParams.get('registered');
  const emailParam = searchParams.get('email');
  const [email, setEmail] = useState(emailParam || '');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(registeredParam === 'true');

  // Check if user is already logged in
  useEffect(() => {
    if (isAuthenticated()) {
      const role = getUserRole();
      const dashboardPath = getDashboardPath(role);
      // If user is logged in, redirect to their dashboard
      router.push(dashboardPath);
    }
  }, [router]);

  // Pre-fill email if coming from registration
  useEffect(() => {
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [emailParam]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await apiClient.post('/api/users/login', {
        email,
        password,
        accountType: accountType, // Send selected account type for API validation
        device: {
          device_type: 'web',
          device_token: 'web-token',
          app_version: '1.0.0',
          os_version: 'web',
          is_active: true,
        },
      });

      const data = response.data;

      if (data.success && data.data?.accessToken) {
        // Decode token to get user role BEFORE storing any tokens
        const decoded = decodeToken(data.data.accessToken);
        const userRole = decoded?.userRole;
        
        // Validate that the selected account type matches the actual user role
        if (userRole && accountType !== 'admin') {
          // Map 'doctor' role to 'doctor' account type, 'hospital' role to 'hospital' account type
          const roleToAccountType: Record<string, AccountType> = {
            'doctor': 'doctor',
            'hospital': 'hospital',
            'admin': 'admin',
          };
          
          const expectedAccountType = roleToAccountType[userRole];
          
          if (expectedAccountType && accountType !== expectedAccountType) {
            // Don't store any tokens - show error and stop
            alert(`This account is registered as a ${userRole}. Please select the "${expectedAccountType}" tab and try again.`);
            setLoading(false);
            return;
          }
        }
        
        // Store tokens only after validation passes
        localStorage.setItem('accessToken', data.data.accessToken);
        if (rememberMe) {
          localStorage.setItem('rememberMe', 'true');
        }
        
        // Store refresh token if provided
        if (data.data?.refreshToken) {
          localStorage.setItem('refreshToken', data.data.refreshToken);
        }
        
        // For hospital users, check if they have an active subscription
        if (userRole === 'hospital') {
          try {
            // Set the token in apiClient headers for the next request
            const subscriptionResponse = await apiClient.get('/api/subscriptions/current');
            const subscriptionData = subscriptionResponse.data;
            
            // If no active subscription, redirect to plan selection
            if (!subscriptionData.success || !subscriptionData.data) {
              router.push('/hospital/subscription');
              return;
            }
          } catch (error) {
            console.error('Error checking subscription:', error);
            // If error checking subscription, still redirect to plan selection to be safe
            router.push('/hospital/subscription');
            return;
          }
        }
        
        // Redirect based on actual user role from token
        // This ensures users go to the correct dashboard based on their actual role
        if (userRole) {
          router.push(getDashboardPath(userRole));
        } else {
          // Fallback to selected account type if role not found
          router.push(getDashboardPath(accountType));
        }
      } else {
        alert(data.message || 'Login failed');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Handle API errors with proper error messages
      if (error.response) {
        const errorData = error.response.data;
        const errorMessage = errorData?.message || 'An error occurred during login';
        
        // Show the error message from the API
        alert(errorMessage);
      } else if (error.request) {
        alert('Unable to connect to the server. Please check your internet connection.');
      } else {
        alert('An unexpected error occurred during login');
      }
    } finally {
      setLoading(false);
    }
  };

  // Get preview content based on account type
  const getPreviewContent = () => {
    if (accountType === 'doctor') {
      return {
        title: 'Surgeon Profile',
        description: 'Manage your availability, accept bookings, and track your schedule.',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        ),
        features: ['Set Availability', 'Accept Bookings', 'Track Schedule', 'View Earnings'],
      };
    } else if (accountType === 'hospital') {
      return {
        title: 'Hospital Management',
        description: 'Find available surgeons, book appointments, and manage your operations.',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        ),
        features: ['Find Surgeons', 'Book Appointments', 'Manage Operations', 'Track Bookings'],
      };
    } else {
      return {
        title: 'Admin Dashboard',
        description: 'Manage users, bookings, and platform settings from one central location.',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        ),
        features: ['User Management', 'Booking Oversight', 'Platform Settings', 'Analytics & Reports'],
      };
    }
  };

  const previewContent = getPreviewContent();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* <Header /> */}

      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] p-6">
        <div className="grid md:grid-cols-2 gap-8 max-w-6xl w-full">
          {/* Left Panel - Login Form */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* Success Message */}
            {showSuccessMessage && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-green-800 font-medium">
                    Registration successful! Please log in to continue.
                  </p>
                </div>
              </div>
            )}

            {/* Logo */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Hospital Surgeons</h1>
              <p className="text-gray-600">Login to access your dashboard</p>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome Back</h2>
              <p className="text-gray-600">Select your account type and login.</p>
            </div>

            {/* Account Type Selector */}
            <div className="mb-6">
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setAccountType('doctor')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md transition-all ${
                    accountType === 'doctor'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="font-medium">Doctor</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAccountType('hospital')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md transition-all ${
                    accountType === 'hospital'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span className="font-medium">Hospital</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAccountType('admin')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md transition-all ${
                    accountType === 'admin'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span className="font-medium">Admin</span>
                </button>
              </div>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-6">
              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    <svg
                      className={`w-5 h-5 ${showPassword ? 'text-gray-600' : 'text-gray-400'}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      {showPassword ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      ) : (
                        <>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </>
                      )}
                    </svg>
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Remember me</span>
                </label>
                <Link href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-700">
                  Forgot password?
                </Link>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>

              {/* Register Links */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-center text-sm text-gray-600 mb-4">
                  Don't have an account? Register as:
                </p>
                <div className="flex gap-3">
                  <Link
                    href="/register/doctor"
                    className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-center font-medium text-sm"
                  >
                    Doctor
                  </Link>
                  <Link
                    href="/register/hospital"
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-center font-medium text-sm"
                  >
                    Hospital
                  </Link>
                </div>
              </div>
            </form>
          </div>

          {/* Right Panel - Features (Dynamic based on account type)
          <div className={`bg-gradient-to-br rounded-2xl shadow-xl p-8 text-white ${
            accountType === 'doctor' 
              ? 'from-blue-600 to-blue-800' 
              : accountType === 'hospital' 
              ? 'from-green-600 to-green-800' 
              : 'from-gray-700 to-gray-900'
          }`}>
            <div className="mb-8"> */}
              {/* <div className="flex items-center gap-3 mb-4">
                {previewContent.icon}
                <h3 className="text-xl font-bold">{previewContent.title}</h3>
              </div>
              <p className="text-blue-100">
                {previewContent.description}
              </p>
            </div>

            <div className="mb-8">
              <h4 className="text-sm font-bold uppercase tracking-wider mb-4">KEY FEATURES.</h4>
              <ul className="space-y-3">
                {previewContent.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div> */}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

