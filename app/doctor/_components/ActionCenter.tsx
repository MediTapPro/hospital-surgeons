'use client';

import { useState, useEffect } from 'react';
import { Filter, ChevronRight, MapPin, FileText } from 'lucide-react';
import { isAuthenticated } from '@/lib/auth/utils';
import Link from 'next/link';
import apiClient from '@/lib/api/httpClient';

interface PendingRequest {
  id: string;
  hospitalName: string;
  patientName: string;
  patientAge: number | null;
  condition: string;
  priority: string;
  expiresIn: string | null;
  consultationFee: number | null;
  requestedAt: string;
}

export function ActionCenter() {
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated()) {
      fetchPendingRequests();
    }
  }, []);

  const fetchPendingRequests = async () => {
    try {
      const response = await apiClient.get('/api/doctors/pending-assignments?limit=5');
      const result = response.data;
      if (result.success) {
        setPendingRequests(result.data);
      }
    } catch (error) {
      console.error('Error fetching pending requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'emergency':
        return '#EF4444';
      case 'high':
        return '#F59E0B';
      case 'urgent':
        return '#F59E0B';
      default:
        return '#10B981';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today, ' + date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow, ' + date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  const upcomingAssignments = [
    {
      id: 'upcoming-1',
      date: 'Nov 13',
      time: '9:00 AM - 12:00 PM',
      hospital: 'City Heart Hospital',
      patient: 'Ravi P.',
      type: 'Routine checkup'
    },
    {
      id: 'upcoming-2',
      date: 'Nov 13',
      time: '2:00 PM - 4:00 PM',
      hospital: 'Metro General',
      patient: 'Priya M.',
      type: 'Follow-up'
    }
  ];

  const recentActivity = [
    {
      id: 'activity-1',
      time: '2 min ago',
      text: 'Accepted assignment from City Heart',
      icon: '✅'
    },
    {
      id: 'activity-2',
      time: '1 hour ago',
      text: 'Completed: John Doe consultation',
      icon: '✓'
    },
    {
      id: 'activity-3',
      time: '3 hours ago',
      text: 'Assignment expired (no response)',
      icon: '⏰'
    }
  ];

  return (
    <div className="space-y-6 bg-transparent">
      {/* Pending Requests */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200" style={{ backgroundImage: 'none' }}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-gray-900 font-semibold">ACTION REQUIRED ({pendingRequests.length})</h2>
          <button className="p-1 hover:bg-gray-100 rounded transition-colors">
            <Filter className="w-4 h-4 text-gray-600" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          {loading ? (
            <div className="text-center py-4 text-gray-500">Loading...</div>
          ) : pendingRequests.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No pending requests</p>
            </div>
          ) : (
            pendingRequests.map((request, index) => (
              <div
                key={`${request.id}-${index}`}
                className="border-2 rounded-lg p-4"
                style={{ borderColor: getPriorityColor(request.priority) }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="text-xs px-2 py-1 text-white rounded font-medium"
                    style={{ backgroundColor: getPriorityColor(request.priority) }}
                  >
                    {request.priority === 'EMERGENCY' ? '🔴' : '🟡'} {request.priority.toUpperCase()}
                  </span>
                  {request.expiresIn && (
                    <span className="text-xs" style={{ color: getPriorityColor(request.priority) }}>
                      ⏰ Expires in: {request.expiresIn}
                    </span>
                  )}
                </div>

                <div className="space-y-2 mb-4">
                  <div className="text-gray-900 font-medium">{request.hospitalName}</div>
                  <div className="text-sm text-gray-600">
                    Patient: {request.patientName}
                    {request.patientAge && `, Age ${request.patientAge}`}
                  </div>
                  <div className="text-sm text-gray-600">
                    Condition: {request.condition}
                  </div>
                  <div className="text-sm text-gray-600">
                    Date: {formatDate(request.requestedAt)}
                  </div>
                  {request.consultationFee && (
                    <div className="text-sm text-gray-600">
                      Fee: ${request.consultationFee.toFixed(2)}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button className="px-4 py-2 text-sm border border-gray-300 hover:bg-gray-50 rounded transition-colors font-medium">
                    VIEW DETAILS
                  </button>
                  <button
                    className="flex-1 px-4 py-2 text-sm text-white rounded transition-colors font-medium"
                    style={{
                      backgroundColor: getPriorityColor(request.priority) === '#EF4444' ? '#10B981' : '#10B981'
                    }}
                  >
                    {request.priority === 'EMERGENCY' ? '✓ ACCEPT NOW' : 'Accept'}
                  </button>
                  <button className="flex-1 px-4 py-2 text-sm bg-[#EF4444] hover:bg-[#dc2626] text-white rounded transition-colors font-medium">
                    {request.priority === 'EMERGENCY' ? '✗ DECLINE' : 'Decline'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Upcoming Assignments */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200" style={{ backgroundImage: 'none' }}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-gray-900 font-semibold">UPCOMING (5)</h2>
          <Link href="/doctor/assignments" className="text-sm text-[#0066CC] hover:underline font-medium">
            View All
          </Link>
        </div>
        <div className="divide-y divide-gray-200">
          {upcomingAssignments.map((assignment, index) => (
            <div key={`${assignment.id}-${index}`} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="text-sm text-gray-600 mb-2">
                {assignment.date} • {assignment.time}
              </div>
              <div className="text-gray-900 mb-1 flex items-center gap-2 font-medium">
                🏥 {assignment.hospital}
              </div>
              <div className="text-sm text-gray-600 mb-3">
                Patient: {assignment.patient} • {assignment.type}
              </div>
              <div className="flex gap-2">
                <button className="flex items-center gap-1 px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors">
                  <MapPin className="w-3 h-3" /> Directions
                </button>
                <button className="flex items-center gap-1 px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors">
                  <FileText className="w-3 h-3" /> Notes
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200" style={{ backgroundImage: 'none' }}>
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-gray-900 font-semibold">RECENT ACTIVITY</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {recentActivity.map((activity, index) => (
            <div key={`${activity.id}-${index}`} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="text-sm text-gray-500 mb-1">
                {activity.icon} {activity.time}
              </div>
              <div className="text-sm text-gray-700">{activity.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
