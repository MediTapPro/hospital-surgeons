'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, TrendingUp, Calendar, Loader2, Users, ClipboardList } from 'lucide-react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api/httpClient';

interface SubscriptionUsage {
  assignments: {
    used: number;
    limit: number | null;
    percentage: number;
    remaining: number;
  };
  affiliations: {
    used: number;
    limit: number | null;
    percentage: number;
    remaining: number;
  };
}

export function AssignmentUsageWidget() {
  const router = useRouter();
  const [subscriptionUsage, setSubscriptionUsage] = useState<SubscriptionUsage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscriptionUsage();
  }, []);

  const fetchSubscriptionUsage = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/doctors/dashboard');
      if (response.data.success && response.data.data?.subscriptionUsage) {
        setSubscriptionUsage(response.data.data.subscriptionUsage);
      }
    } catch (error) {
      console.error('Error fetching subscription usage:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !subscriptionUsage) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-2 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    );
  }

  const getStatusColor = (percentage: number, limit: number | null) => {
    if (limit === -1 || limit === null) return 'bg-green-500';
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 80) return 'bg-orange-500';
    if (percentage >= 60) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusText = (percentage: number, limit: number | null) => {
    if (limit === -1 || limit === null) return 'Unlimited';
    if (percentage >= 100) return 'Limit Reached';
    if (percentage >= 80) return 'Almost Full';
    if (percentage >= 60) return 'Getting Close';
    return 'On Track';
  };

  const renderUsageItem = (
    title: string,
    icon: React.ReactNode,
    used: number,
    limit: number | null,
    percentage: number,
    remaining: number
  ) => {
    const isUnlimited = limit === -1 || limit === null;
    const statusColor = getStatusColor(percentage, limit);
    const statusText = getStatusText(percentage, limit);

    return (
      <div className="mb-4 last:mb-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {icon}
            <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
          </div>
          <span className={`text-xs px-2 py-1 rounded ${
            percentage >= 100 ? 'bg-red-100 text-red-700' :
            percentage >= 80 ? 'bg-orange-100 text-orange-700' :
            percentage >= 60 ? 'bg-yellow-100 text-yellow-700' :
            'bg-green-100 text-green-700'
          }`}>
            {statusText}
          </span>
        </div>

        <div className="mb-2">
          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
            <span>
              {used} / {isUnlimited ? '∞' : limit} used
            </span>
            {!isUnlimited && <span>{percentage}%</span>}
          </div>
          {!isUnlimited && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${statusColor}`}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
          )}
        </div>

        {!isUnlimited && remaining <= 5 && remaining > 0 && (
          <div className={`text-xs p-2 rounded ${
            percentage >= 100 
              ? 'bg-red-50 text-red-700 border border-red-200' 
              : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
          }`}>
            {remaining} {title.toLowerCase()} remaining
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">
          Subscription Usage
        </h3>
      </div>

      {/* Assignment Usage */}
      {renderUsageItem(
        'Assignments',
        <ClipboardList className="w-4 h-4 text-blue-600" />,
        subscriptionUsage.assignments.used,
        subscriptionUsage.assignments.limit,
        subscriptionUsage.assignments.percentage,
        subscriptionUsage.assignments.remaining
      )}

      {/* Affiliation Usage */}
      {renderUsageItem(
        'Hospital Affiliations',
        <Users className="w-4 h-4 text-purple-600" />,
        subscriptionUsage.affiliations.used,
        subscriptionUsage.affiliations.limit,
        subscriptionUsage.affiliations.percentage,
        subscriptionUsage.affiliations.remaining
      )}

      {/* Upgrade Prompt if any limit reached */}
      {(subscriptionUsage.assignments.percentage >= 100 || 
        (subscriptionUsage.affiliations.limit !== null && 
         subscriptionUsage.affiliations.percentage >= 100)) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-medium text-red-900 mb-1">
                Limit Reached
              </p>
              <p className="text-xs text-red-700 mb-2">
                {subscriptionUsage.assignments.percentage >= 100 && 'Assignment limit reached. '}
                {subscriptionUsage.affiliations.limit !== null && 
                 subscriptionUsage.affiliations.percentage >= 100 && 'Affiliation limit reached. '}
                Consider upgrading your plan for higher limits.
              </p>
              <button
                onClick={() => router.push('/doctor/subscriptions')}
                className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded transition-colors font-medium"
              >
                Upgrade Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Details Links */}
      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-200">
        <button
          onClick={() => router.push('/doctor/assignments')}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          View Assignments →
        </button>
        <button
          onClick={() => router.push('/doctor/affiliations')}
          className="text-xs text-purple-600 hover:text-purple-700 font-medium"
        >
          View Affiliations →
        </button>
      </div>
    </div>
  );
}








