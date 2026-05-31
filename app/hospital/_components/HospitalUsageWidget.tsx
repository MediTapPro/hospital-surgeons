'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, TrendingUp, Calendar, Loader2, Users, ClipboardList } from 'lucide-react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api/httpClient';

interface UsageData {
  patients: {
    used: number;
    limit: number;
    percentage: number;
    status: 'ok' | 'warning' | 'critical' | 'reached';
    remaining: number;
  };
  assignments: {
    used: number;
    limit: number;
    percentage: number;
    status: 'ok' | 'warning' | 'critical' | 'reached';
    remaining: number;
  };
  plan: string;
  resetDate: string;
}

export function HospitalUsageWidget() {
  const router = useRouter();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hospitalId, setHospitalId] = useState<string | null>(null);

  useEffect(() => {
    fetchHospitalId();
  }, []);

  useEffect(() => {
    if (hospitalId) {
      fetchUsage();
    }
  }, [hospitalId]);

  const fetchHospitalId = async () => {
    try {
      const response = await apiClient.get('/api/hospitals/profile');
      if (response.data.success && response.data.data) {
        setHospitalId(response.data.data.id);
      }
    } catch (error) {
      console.error('Error fetching hospital profile:', error);
    }
  };

  const fetchUsage = async () => {
    if (!hospitalId) return;
    
    try {
      setLoading(true);
      const response = await apiClient.get(`/api/hospitals/${hospitalId}/usage`);
      if (response.data.success) {
        setUsage(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching usage:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !usage) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-2 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'reached': return 'bg-red-500';
      case 'critical': return 'bg-orange-500';
      case 'warning': return 'bg-yellow-500';
      default: return 'bg-green-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'reached': return 'Limit Reached';
      case 'critical': return 'Almost Full';
      case 'warning': return 'Getting Close';
      default: return 'On Track';
    }
  };

  const resetDate = new Date(usage.resetDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const isPatientsUnlimited = usage.patients.limit === -1;
  const isAssignmentsUnlimited = usage.assignments.limit === -1;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">
          Monthly Usage
        </h3>
        <span className="text-xs text-gray-500">Plan: {usage.plan}</span>
      </div>

      {/* Patients Usage */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-4 h-4 text-gray-600" />
          <span className="text-xs font-medium text-gray-700">Patients</span>
          <span className={`text-xs px-2 py-0.5 rounded ml-auto ${
            usage.patients.status === 'reached' ? 'bg-red-100 text-red-700' :
            usage.patients.status === 'critical' ? 'bg-orange-100 text-orange-700' :
            usage.patients.status === 'warning' ? 'bg-yellow-100 text-yellow-700' :
            'bg-green-100 text-green-700'
          }`}>
            {getStatusText(usage.patients.status)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
          <span>
            {usage.patients.used} / {isPatientsUnlimited ? '∞' : usage.patients.limit} used
          </span>
          {!isPatientsUnlimited && <span>{usage.patients.percentage}%</span>}
        </div>
        {!isPatientsUnlimited && (
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${getStatusColor(usage.patients.status)}`}
              style={{ width: `${Math.min(usage.patients.percentage, 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* Assignments Usage */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <ClipboardList className="w-4 h-4 text-gray-600" />
          <span className="text-xs font-medium text-gray-700">Assignments</span>
          <span className={`text-xs px-2 py-0.5 rounded ml-auto ${
            usage.assignments.status === 'reached' ? 'bg-red-100 text-red-700' :
            usage.assignments.status === 'critical' ? 'bg-orange-100 text-orange-700' :
            usage.assignments.status === 'warning' ? 'bg-yellow-100 text-yellow-700' :
            'bg-green-100 text-green-700'
          }`}>
            {getStatusText(usage.assignments.status)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
          <span>
            {usage.assignments.used} / {isAssignmentsUnlimited ? '∞' : usage.assignments.limit} used
          </span>
          {!isAssignmentsUnlimited && <span>{usage.assignments.percentage}%</span>}
        </div>
        {!isAssignmentsUnlimited && (
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${getStatusColor(usage.assignments.status)}`}
              style={{ width: `${Math.min(usage.assignments.percentage, 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* Reset Date */}
      <div className="text-xs text-gray-600 mb-3 flex items-center gap-1">
        <Calendar className="w-3 h-3" />
        <span>Resets on {resetDate}</span>
      </div>

      {/* Warning/Upgrade Prompts */}
      {usage.patients.status === 'reached' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-medium text-red-900 mb-1">
                Patient Limit Reached
              </p>
              <p className="text-xs text-red-700 mb-2">
                You've used all {usage.patients.limit} patients this month. New patients will be available on {resetDate}.
              </p>
              <button
                onClick={() => router.push('/hospital/subscriptions')}
                className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded transition-colors font-medium"
              >
                Upgrade Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {usage.assignments.status === 'reached' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-medium text-red-900 mb-1">
                Assignment Limit Reached
              </p>
              <p className="text-xs text-red-700 mb-2">
                You've used all {usage.assignments.limit} assignments this month. New assignments will be available on {resetDate}.
              </p>
              <button
                onClick={() => router.push('/hospital/subscriptions')}
                className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded transition-colors font-medium"
              >
                Upgrade Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {(usage.patients.status === 'critical' || usage.patients.status === 'warning') && (
        <div className={`border rounded-lg p-3 mb-3 ${
          usage.patients.status === 'critical' 
            ? 'bg-orange-50 border-orange-200' 
            : 'bg-yellow-50 border-yellow-200'
        }`}>
          <div className="flex items-start gap-2">
            <TrendingUp className={`w-4 h-4 mt-0.5 ${
              usage.patients.status === 'critical' ? 'text-orange-600' : 'text-yellow-600'
            }`} />
            <div className="flex-1">
              <p className={`text-xs font-medium mb-1 ${
                usage.patients.status === 'critical' ? 'text-orange-900' : 'text-yellow-900'
              }`}>
                {usage.patients.remaining} patient{usage.patients.remaining !== 1 ? 's' : ''} remaining
              </p>
              <button
                onClick={() => router.push('/hospital/subscriptions')}
                className={`text-xs px-3 py-1.5 rounded transition-colors font-medium ${
                  usage.patients.status === 'critical'
                    ? 'bg-orange-600 hover:bg-orange-700 text-white'
                    : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                }`}
              >
                View Plans
              </button>
            </div>
          </div>
        </div>
      )}

      {(usage.assignments.status === 'critical' || usage.assignments.status === 'warning') && (
        <div className={`border rounded-lg p-3 ${
          usage.assignments.status === 'critical' 
            ? 'bg-orange-50 border-orange-200' 
            : 'bg-yellow-50 border-yellow-200'
        }`}>
          <div className="flex items-start gap-2">
            <TrendingUp className={`w-4 h-4 mt-0.5 ${
              usage.assignments.status === 'critical' ? 'text-orange-600' : 'text-yellow-600'
            }`} />
            <div className="flex-1">
              <p className={`text-xs font-medium mb-1 ${
                usage.assignments.status === 'critical' ? 'text-orange-900' : 'text-yellow-900'
              }`}>
                {usage.assignments.remaining} assignment{usage.assignments.remaining !== 1 ? 's' : ''} remaining
              </p>
              <button
                onClick={() => router.push('/hospital/subscriptions')}
                className={`text-xs px-3 py-1.5 rounded transition-colors font-medium ${
                  usage.assignments.status === 'critical'
                    ? 'bg-orange-600 hover:bg-orange-700 text-white'
                    : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                }`}
              >
                View Plans
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

