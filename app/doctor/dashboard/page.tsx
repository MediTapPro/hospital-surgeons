'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, TrendingUp, Calendar, CheckCircle, Star, Award, DollarSign, Activity, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ActionCenter } from '../_components/ActionCenter';
import { TodaySchedule } from '../_components/TodaySchedule';
import { ManagementStats } from '../_components/ManagementStats';
import { AssignmentUsageWidget } from '../_components/AssignmentUsageWidget';
import { isAuthenticated } from '@/lib/auth/utils';
import apiClient from '@/lib/api/httpClient';
import type { AxiosError } from 'axios';

interface DashboardData {
  totalAssignments: number;
  pendingAssignments: number;
  completedAssignments: number;
  averageRating: number;
  totalRatings: number;
  totalEarnings: number;
  thisMonthEarnings: number;
  thisMonthAssignments: number;
  upcomingSlots: number;
  profileCompletion: number;
  credentials: {
    verified: number;
    pending: number;
    rejected: number;
  };
  activeAffiliations: number;
  licenseVerificationStatus: string;
  subscription?: {
    planName: string;
    visibilityWeight: number;
    maxAffiliations: number;
    featured: boolean;
    renewalDate: string;
  };
}

export default function DoctorDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('rememberMe');
    router.push('/login');
  };

  useEffect(() => {
    if (isAuthenticated()) {
      fetchDashboardData();
    }
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch dashboard stats
      const dashboardResponse = await apiClient.get('/api/doctors/dashboard');
      const dashboardResult = dashboardResponse.data;
      
      // If profile doesn't exist (404), show empty state
      if (!dashboardResult.success) {
        setDashboardData(null);
        setLoading(false);
        return;
      }
      
      // Fetch earnings (optional - don't fail if it returns 404)
      let earningsResult: any = { success: false, data: null };
      try {
        const earningsResponse = await apiClient.get('/api/doctors/earnings');
        earningsResult = earningsResponse.data;
      } catch (err) {
        const axiosError = err as AxiosError;
        if (axiosError.response?.status !== 404) {
          console.log('Earnings endpoint not available:', err);
        }
      }

      // Fetch subscription (optional - don't fail if it returns 404)
      let subscriptionResult: any = { success: false, data: null };
      try {
        const subscriptionResponse = await apiClient.get('/api/subscriptions?status=active&limit=1');
        subscriptionResult = subscriptionResponse.data;
      } catch (err) {
        const axiosError = err as AxiosError;
        if (axiosError.response?.status !== 404) {
          console.log('Subscription endpoint not available:', err);
        }
      }

      if (dashboardResult.success && dashboardResult.data) {
        const data = { ...dashboardResult.data };
        // Merge earnings data if available
        if (earningsResult.success && earningsResult.data) {
          data.totalEarnings = (earningsResult.data as any).totalEarnings || 0;
          data.thisMonthEarnings = (earningsResult.data as any).thisMonthEarnings || 0;
          data.thisMonthAssignments = (earningsResult.data as any).thisMonthAssignments || 0;
        }
        // Merge subscription data if available
        if (subscriptionResult.success && subscriptionResult.data && Array.isArray(subscriptionResult.data) && subscriptionResult.data.length > 0) {
          const subscription = subscriptionResult.data[0];
          // Fetch plan details if planId exists
          if (subscription.planId) {
            try {
              const planResponse = await apiClient.get(`/api/subscriptions/plans/${subscription.planId}`);
              const planData = planResponse.data;
              if (planData.success && planData.data) {
                const plan = planData.data;
                const doctorFeatures = plan.doctorFeatures;
                data.subscription = {
                  planName: plan.name || 'PLATINUM',
                  visibilityWeight: doctorFeatures?.visibilityWeight || 100,
                  maxAffiliations: doctorFeatures?.maxAffiliations || 10,
                  featured: false, // Not stored in database currently
                  renewalDate: subscription.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                };
              }
            } catch (err) {
              console.log('Plan details not available:', err);
            }
          }
        }
        setDashboardData(data);
      }
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 404) {
        setDashboardData(null);
      } else {
        console.error('Error fetching dashboard data:', error);
        setDashboardData(null);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Profile Not Complete</h2>
        <p className="text-slate-600 mb-6">
          Please complete your doctor profile to access the dashboard.
        </p>
        <Link
          href="/doctor/profile"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#2563EB] text-white rounded-lg hover:bg-[#1d4ed8] transition-colors font-medium"
        >
          Complete Profile
        </Link>
      </div>
    );
  }

  const credentialsTotal = dashboardData.credentials.verified + dashboardData.credentials.pending + dashboardData.credentials.rejected;
  const credentialsStatus = dashboardData.credentials.pending > 0 
    ? `${dashboardData.credentials.pending} Pending, ${dashboardData.credentials.verified} Verified`
    : `${dashboardData.credentials.verified} Verified`;

  return (
    <div className="space-y-6 bg-transparent">
      {/* Logout Button */}
      <div className="flex justify-end">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg transition-colors font-medium"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
      {/* Profile Completion Alert */}
      {dashboardData.profileCompletion < 100 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-amber-900 mb-2 font-semibold">Complete Your Profile</h3>
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-amber-800 font-medium">Progress: {dashboardData.profileCompletion}%</span>
                </div>
                <div className="w-full bg-amber-200 rounded-full h-2">
                  <div 
                    className="bg-amber-600 h-2 rounded-full transition-all" 
                    style={{ width: `${dashboardData.profileCompletion}%` }} 
                  />
                </div>
              </div>
              <Link 
                href="/doctor/profile"
                className="inline-block px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm transition-colors font-medium"
              >
                Complete Now
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Verification Status */}
      <div className="bg-white border border-gray-200 rounded-lg p-6" style={{ backgroundImage: 'none' }}>
        <h3 className="text-gray-900 mb-4 font-semibold">Verification Status</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-700">Profile</span>
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle className="w-4 h-4" /> Verified
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-700">Medical License</span>
            <span className={`flex items-center gap-1 ${
              dashboardData.licenseVerificationStatus === 'verified' ? 'text-green-600' :
              dashboardData.licenseVerificationStatus === 'pending' ? 'text-amber-600' :
              'text-red-600'
            }`}>
              <CheckCircle className="w-4 h-4" /> 
              {dashboardData.licenseVerificationStatus === 'verified' ? 'Verified' :
               dashboardData.licenseVerificationStatus === 'pending' ? 'Pending' :
               'Rejected'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-700">Credentials</span>
            <span className={`flex items-center gap-1 ${
              dashboardData.credentials.pending > 0 ? 'text-amber-600' : 'text-green-600'
            }`}>
              <AlertCircle className="w-4 h-4" /> {credentialsStatus}
            </span>
          </div>
        </div>
        <Link 
          href="/doctor/profile"
          className="mt-4 w-full inline-block px-4 py-2 border border-gray-300 hover:bg-gray-50 rounded-lg text-sm transition-colors text-center font-medium"
        >
          View Details
        </Link>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Profile Strength */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <Award className="w-6 h-6" />
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="text-3xl mb-1 font-bold">{dashboardData.profileCompletion}</div>
          <div className="text-purple-100 text-sm">Profile Strength</div>
          <div className="text-xs text-purple-200 mt-2">Out of 100</div>
        </div>

        {/* Total Assignments */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <Activity className="w-6 h-6" />
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="text-3xl mb-1 font-bold">{dashboardData.totalAssignments}</div>
          <div className="text-blue-100 text-sm">Total Assignments</div>
          <div className="text-xs text-blue-200 mt-2">
            {dashboardData.completedAssignments} completed • {dashboardData.pendingAssignments} pending
          </div>
        </div>

        {/* Average Rating */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <Star className="w-6 h-6" />
            <span className="text-xs">↑ 0.2</span>
          </div>
          <div className="text-3xl mb-1 flex items-center gap-1 font-bold">
            {dashboardData.averageRating > 0 ? dashboardData.averageRating.toFixed(1) : 'N/A'} 
            {dashboardData.averageRating > 0 && <Star className="w-5 h-5 fill-white" />}
          </div>
          <div className="text-orange-100 text-sm">Average Rating</div>
          <div className="text-xs text-orange-200 mt-2">Based on {dashboardData.totalRatings} reviews</div>
        </div>

        {/* This Month Earnings */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-6 h-6" />
            <span className="text-xs">+12%</span>
          </div>
          <div className="text-3xl mb-1 font-bold">${dashboardData.thisMonthEarnings.toLocaleString()}</div>
          <div className="text-green-100 text-sm">This Month</div>
          <div className="text-xs text-green-200 mt-2">
            {dashboardData.thisMonthAssignments} assignments
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4" style={{ backgroundImage: 'none' }}>
          <div className="text-2xl text-gray-900 mb-1 font-bold">{dashboardData.pendingAssignments}</div>
          <div className="text-sm text-gray-600">Pending Assignments</div>
          <div className="text-xs text-gray-500 mt-1">Awaiting your response</div>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4" style={{ backgroundImage: 'none' }}>
          <div className="text-2xl text-gray-900 mb-1 font-bold">{dashboardData.upcomingSlots}</div>
          <div className="text-sm text-gray-600">Upcoming Slots</div>
          <div className="text-xs text-gray-500 mt-1">Available for booking</div>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4" style={{ backgroundImage: 'none' }}>
          <div className="text-2xl text-gray-900 mb-1 font-bold">
            {dashboardData.totalAssignments > 0 
              ? Math.round((dashboardData.completedAssignments / dashboardData.totalAssignments) * 100)
              : 0}%
          </div>
          <div className="text-sm text-gray-600">Completion Rate</div>
          <div className="text-xs text-gray-500 mt-1">
            {dashboardData.completedAssignments}/{dashboardData.totalAssignments} completed
          </div>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4" style={{ backgroundImage: 'none' }}>
          <div className="text-2xl text-gray-900 mb-1 font-bold">{dashboardData.activeAffiliations}</div>
          <div className="text-sm text-gray-600">Hospital Affiliations</div>
          <div className="text-xs text-gray-500 mt-1">Active partnerships</div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Action Center & Today Schedule */}
        <div className="lg:col-span-2 space-y-6">
          <ActionCenter />
          <TodaySchedule />
        </div>

        {/* Right Column - Management Stats & Assignment Usage */}
        <div className="space-y-6">
          <AssignmentUsageWidget />
          <ManagementStats />
        </div>
      </div>

      {/* Subscription Widget */}
      {dashboardData.subscription && (
        <div className="bg-gradient-to-br from-amber-400 to-amber-500 rounded-lg p-6 text-white">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-5 h-5 fill-white" />
                <span className="text-xl font-semibold">Your Plan: {dashboardData.subscription.planName.toUpperCase()}</span>
              </div>
              <div className="space-y-1 text-sm text-amber-100">
                <div>• Visibility Weight: {dashboardData.subscription.visibilityWeight} {dashboardData.subscription.visibilityWeight >= 100 ? '(Highest)' : ''}</div>
                <div>• Max Affiliations: {dashboardData.subscription.maxAffiliations}</div>
                {dashboardData.subscription.featured && <div>• Featured badge on profile</div>}
                <div>• Priority support</div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-amber-100">
              Renewal: {new Date(dashboardData.subscription.renewalDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <Link 
              href="/doctor/subscriptions"
              className="px-4 py-2 bg-white text-amber-600 rounded-lg text-sm hover:bg-amber-50 transition-colors font-medium"
            >
              Manage Subscription
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
