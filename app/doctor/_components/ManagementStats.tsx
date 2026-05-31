'use client';

import { useState, useEffect } from 'react';
import { Plus, Settings, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { AddSlotModal } from './AddSlotModal';
import { ManageTemplatesModal } from './ManageTemplatesModal';
import { isAuthenticated } from '@/lib/auth/utils';
import apiClient from '@/lib/api/httpClient';

interface ManagementStatsProps {
  onAddSlot?: () => void;
  onManageTemplates?: () => void;
}

export function ManagementStats({ onAddSlot, onManageTemplates }: ManagementStatsProps) {
  const [showAddSlotModal, setShowAddSlotModal] = useState(false);
  const [showManageTemplates, setShowManageTemplates] = useState(false);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    completed: 0,
    acceptance: 0,
    avgRating: 0,
    revenue: 0,
  });
  const [hospitals, setHospitals] = useState<Array<{ name: string; preferred: boolean }>>([]);
  const [upcomingLeave, setUpcomingLeave] = useState<string | null>(null);
  const [availabilityDates, setAvailabilityDates] = useState<Set<number>>(new Set());
  const [leaveDates, setLeaveDates] = useState<Set<number>>(new Set());
  const [bookedDates, setBookedDates] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated()) {
      fetchStats();
    }
  }, []);

  const fetchStats = async () => {
    try {
      // Get doctor profile
      const profileResponse = await apiClient.get('/api/doctors/profile');
      const profileData = profileResponse.data;
      
      if (profileData.success && profileData.data) {
        const id = profileData.data.id;
        setDoctorId(id);

        // Get stats
        const statsResponse = await apiClient.get(`/api/doctors/${id}/stats`);
        const statsData = statsResponse.data;

        // Get pending assignments to calculate acceptance rate
        let pendingCount = 0;
        let completedCount = 0;
        try {
          const pendingResponse = await apiClient.get(`/api/doctors/pending-assignments?limit=1000`);
          if (pendingResponse.data.success && Array.isArray(pendingResponse.data.data)) {
            pendingCount = pendingResponse.data.data.length;
          }
        } catch (err) {
          console.log('Error fetching pending assignments:', err);
        }

        // Get earnings for revenue
        let revenue = 0;
        try {
          const earningsResponse = await apiClient.get('/api/doctors/earnings');
          if (earningsResponse.data.success && earningsResponse.data.data) {
            revenue = earningsResponse.data.data.totalEarnings || 0;
          }
        } catch (err) {
          console.log('Error fetching earnings:', err);
        }

        if (statsData.success && statsData.data) {
          completedCount = statsData.data.totalBookings || 0;
          const totalRequests = pendingCount + completedCount;
          const acceptanceRate = totalRequests > 0 
            ? Math.round((completedCount / totalRequests) * 100) 
            : 0;

          setStats({
            completed: completedCount,
            acceptance: acceptanceRate,
            avgRating: parseFloat(statsData.data.averageRating || '0'),
            revenue: revenue,
          });
        }

        // Fetch upcoming leaves and mark calendar
        try {
          const leavesResponse = await apiClient.get(`/api/doctors/${id}/unavailability`);
          if (leavesResponse.data.success && Array.isArray(leavesResponse.data.data)) {
            const today = new Date();
            const currentMonth = today.getMonth();
            const currentYear = today.getFullYear();
            const leaveDatesSet = new Set<number>();
            
            const upcoming = leavesResponse.data.data
              .filter((leave: any) => {
                const endDate = new Date(leave.endDate);
                return endDate >= today;
              })
              .sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0];
            
            // Mark leave dates on calendar for current month
            leavesResponse.data.data.forEach((leave: any) => {
              const startDate = new Date(leave.startDate);
              const endDate = new Date(leave.endDate);
              
              // Only mark dates in current month
              if (startDate.getMonth() === currentMonth && startDate.getFullYear() === currentYear) {
                for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                  if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                    leaveDatesSet.add(d.getDate());
                  }
                }
              }
            });
            
            setLeaveDates(leaveDatesSet);
            
            if (upcoming) {
              const startDate = new Date(upcoming.startDate);
              const endDate = new Date(upcoming.endDate);
              const type = upcoming.leaveType || 'Leave';
              setUpcomingLeave(
                `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}-${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} (${type})`
              );
            }
          }
        } catch (err) {
          console.log('Error fetching leaves:', err);
        }

        // Fetch availability slots for current month
        try {
          const availabilityResponse = await apiClient.get(`/api/doctors/${id}/availability`);
          if (availabilityResponse.data.success && Array.isArray(availabilityResponse.data.data)) {
            const today = new Date();
            const currentMonth = today.getMonth();
            const currentYear = today.getFullYear();
            const availabilityDatesSet = new Set<number>();
            const bookedDatesSet = new Set<number>();
            
            availabilityResponse.data.data.forEach((slot: any) => {
              const slotDate = new Date(slot.slotDate);
              
              // Only mark dates in current month
              if (slotDate.getMonth() === currentMonth && slotDate.getFullYear() === currentYear) {
                const day = slotDate.getDate();
                availabilityDatesSet.add(day);
                
                if (slot.status === 'booked') {
                  bookedDatesSet.add(day);
                }
              }
            });
            
            setAvailabilityDates(availabilityDatesSet);
            setBookedDates(bookedDatesSet);
          }
        } catch (err) {
          console.log('Error fetching availability:', err);
        }

        // Fetch hospital affiliations (if API exists)
        // For now, we'll keep the hardcoded list as there's no specific API endpoint
        // This can be updated when the affiliations API is available
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };


  const currentDate = new Date();
  const currentMonth = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  return (
    <div className="space-y-6 bg-transparent">
      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200" style={{ backgroundImage: 'none' }}>
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-gray-900 font-semibold">AVAILABILITY</h3>
        </div>
        <div className="p-4 space-y-3">
          <button
            onClick={() => setShowAddSlotModal(true)}
            className="w-full flex items-center gap-2 px-4 py-3 bg-[#0066CC] hover:bg-[#0052a3] text-white rounded-lg transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            <span>Add Single Slot</span>
          </button>
          <button
            onClick={() => setShowManageTemplates(true)}
            className="w-full flex items-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium"
          >
            <Settings className="w-4 h-4" />
            <span>Manage Templates</span>
          </button>
          <Link
            href="/doctor/schedule"
            className="w-full flex items-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium"
          >
            <CalendarDays className="w-4 h-4" />
            <span>View Calendar</span>
          </Link>
        </div>
      </div>

      {/* Mini Calendar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200" style={{ backgroundImage: 'none' }}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-gray-900 font-semibold">{currentMonth}</h3>
          <div className="flex gap-1">
            <button className="p-1 hover:bg-gray-100 rounded transition-colors">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <button className="p-1 hover:bg-gray-100 rounded transition-colors">
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
              <div key={i} className="text-center text-xs text-gray-500 font-medium">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {[...Array(firstDayOfMonth)].map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}
            {[...Array(daysInMonth)].map((_, i) => {
              const day = i + 1;
              const today = new Date();
              const isToday = day === today.getDate() && 
                            currentDate.getMonth() === today.getMonth() &&
                            currentDate.getFullYear() === today.getFullYear();
              
              let dotColor = '';
              if (leaveDates.has(day)) {
                dotColor = 'bg-[#EF4444]'; // Leave
              } else if (bookedDates.has(day)) {
                dotColor = 'bg-[#0066CC]'; // Booked
              } else if (availabilityDates.has(day)) {
                dotColor = 'bg-[#10B981]'; // Available
              }

              return (
                <div key={i} className="aspect-square flex flex-col items-center justify-center">
                  <span className={`text-sm ${isToday ? 'text-[#0066CC] font-semibold' : 'text-gray-700'}`}>
                    {day}
                  </span>
                  {dotColor && (
                    <div className={`w-1.5 h-1.5 rounded-full ${dotColor} mt-0.5`} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="text-xs text-gray-600 space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#10B981]" />
                <span>Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#0066CC]" />
                <span>Booked</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#EF4444]" />
                <span>Leave</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-gray-300" />
                <span>Blocked</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Leave Management */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200" style={{ backgroundImage: 'none' }}>
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-gray-900 font-semibold">LEAVE MANAGEMENT</h3>
        </div>
        <div className="p-4 space-y-3">
          {upcomingLeave ? (
            <div>
              <div className="text-sm text-gray-600 mb-2">Upcoming Leave:</div>
              <div className="text-sm text-gray-700">🏖️ {upcomingLeave}</div>
            </div>
          ) : (
            <div>
              <div className="text-sm text-gray-600 mb-2">Upcoming Leave:</div>
              <div className="text-sm text-gray-500">No upcoming leaves</div>
            </div>
          )}
          <Link
            href="/doctor/leaves"
            className="w-full block px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-center font-medium"
          >
            Mark New Leave
          </Link>
          <Link
            href="/doctor/leaves"
            className="w-full block px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-center font-medium"
          >
            View All Leaves
          </Link>
        </div>
      </div>

      {/* Performance Stats */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200" style={{ backgroundImage: 'none' }}>
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-gray-900 font-semibold">THIS MONTH</h3>
        </div>
        <div className="p-4 space-y-3">
          {loading ? (
            <div className="text-center py-4 text-gray-500">Loading...</div>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Completed</span>
                <span className="text-gray-900 font-semibold">{stats.completed}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Acceptance</span>
                <span className="text-gray-900 font-semibold">{stats.acceptance}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Avg Rating</span>
                <span className="text-gray-900 font-semibold">
                  {stats.avgRating > 0 ? `${stats.avgRating.toFixed(1)} ⭐` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Revenue</span>
                <span className="text-gray-900 font-semibold">₹{stats.revenue.toLocaleString()}</span>
              </div>
            </>
          )}
          <Link
            href="/doctor/earnings"
            className="w-full mt-2 block px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-center font-medium"
          >
            View Detailed Report
          </Link>
        </div>
      </div>

      {/* Affiliated Hospitals */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200" style={{ backgroundImage: 'none' }}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-gray-900 font-semibold">
            HOSPITALS {hospitals.length > 0 ? `(${hospitals.length}/10)` : ''}
          </h3>
          <Link href="/doctor/hospitals" className="text-[#0066CC] hover:underline">
            <Plus className="w-4 h-4" />
          </Link>
        </div>
        <div className="p-4 space-y-2">
          {hospitals.length > 0 ? (
            hospitals.map((hospital, index) => (
              <div key={index} className="text-sm text-gray-700 flex items-center gap-2">
                {hospital.preferred && <span>⭐</span>}
                <span>{hospital.name}</span>
              </div>
            ))
          ) : (
            <div className="text-sm text-gray-500 text-center py-2">No hospital affiliations yet</div>
          )}
          <Link
            href="/doctor/hospitals"
            className="w-full mt-2 block px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-center font-medium"
          >
            {hospitals.length > 0 ? 'View All' : 'Add Hospital'}
          </Link>
        </div>
      </div>

      {/* Modals */}
      {showAddSlotModal && doctorId && (
        <AddSlotModal 
          doctorId={doctorId}
          onClose={() => setShowAddSlotModal(false)}
          onSuccess={() => {
            setShowAddSlotModal(false);
            fetchStats();
          }}
        />
      )}

      {showManageTemplates && doctorId && (
        <ManageTemplatesModal doctorId={doctorId} onClose={() => setShowManageTemplates(false)} />
      )}
    </div>
  );
}
