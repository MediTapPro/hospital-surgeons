'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Phone, Navigation, Eye } from 'lucide-react';
import { isAuthenticated } from '@/lib/auth/utils';
import apiClient from '@/lib/api/httpClient';

interface ScheduleItem {
  time: string;
  type: 'available' | 'accepted' | 'break' | 'pending';
  duration?: string;
  note?: string;
  hospital?: string;
  patient?: string;
  condition?: string;
  expiresIn?: string;
  status?: string;
}

export function TodaySchedule() {
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated()) {
      fetchTodaySchedule();
    }
  }, []);

  const fetchTodaySchedule = async () => {
    try {
      // Get doctor profile first
      const profileResponse = await apiClient.get('/api/doctors/profile');
      const profileData = profileResponse.data;
      
      if (!profileData.success || !profileData.data) {
        setLoading(false);
        return;
      }

      const doctorId = profileData.data.id;
      const today = new Date().toISOString().split('T')[0];

      // Get today's availability
      const availabilityResponse = await apiClient.get(`/api/doctors/${doctorId}/availability?slotDate=${today}`);
      const availabilityData = availabilityResponse.data;

      // Get today's assignments
      const assignmentsResponse = await apiClient.get(`/api/bookings?doctorId=${doctorId}&status=confirmed&limit=10`);
      const assignmentsData = assignmentsResponse.data;

      // Combine and format schedule
      const scheduleItems: ScheduleItem[] = [];
      
      // Add assignments
      if (assignmentsData.success && assignmentsData.data) {
        const bookings = Array.isArray(assignmentsData.data) ? assignmentsData.data : [];
        bookings.forEach((booking: any) => {
          if (booking.bookingDate === today || booking.requestedAt?.startsWith(today)) {
            scheduleItems.push({
              time: booking.startTime || '9:00 AM',
              type: booking.status === 'confirmed' ? 'accepted' : 'pending',
              hospital: booking.hospital?.name || 'Hospital',
              patient: booking.patient?.fullName?.split(' ')[0] + '.' || 'Patient',
              condition: booking.patient?.medicalCondition || booking.specialRequirements || 'Consultation',
              status: booking.status?.toUpperCase(),
            });
          }
        });
      }

      // Add availability slots
      if (availabilityData.success && availabilityData.data) {
        const slots = Array.isArray(availabilityData.data) ? availabilityData.data : [];
        slots.forEach((slot: any) => {
          if (slot.slotDate === today && slot.status === 'available') {
            scheduleItems.push({
              time: slot.startTime || '8:00 AM',
              type: 'available',
              duration: calculateDuration(slot.startTime, slot.endTime),
              note: 'Not booked',
            });
          }
        });
      }

      // Sort by time and add break
      scheduleItems.sort((a, b) => {
        const timeA = parseTime(a.time);
        const timeB = parseTime(b.time);
        return timeA - timeB;
      });

      // Add lunch break if needed
      if (scheduleItems.length > 0) {
        scheduleItems.splice(2, 0, {
          time: '12:00 PM',
          type: 'break',
          note: 'Lunch Break',
        });
      }

      setSchedule(scheduleItems.length > 0 ? scheduleItems : getDefaultSchedule());
    } catch (error) {
      console.error('Error fetching schedule:', error);
      setSchedule(getDefaultSchedule());
    } finally {
      setLoading(false);
    }
  };

  const parseTime = (timeStr: string): number => {
    const [time, period] = timeStr.split(' ');
    const [hours, minutes] = time.split(':');
    let hour = parseInt(hours);
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    return hour * 60 + parseInt(minutes || '0');
  };

  const calculateDuration = (start: string, end: string): string => {
    const startMinutes = parseTime(start);
    const endMinutes = parseTime(end);
    const diff = endMinutes - startMinutes;
    const hours = Math.floor(diff / 60);
    return `${hours} hours`;
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    const parts = timeString.split(':');
    const hours = parseInt(parts[0]);
    const minutes = parts[1] || '00';
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes} ${ampm}`;
  };

  const getDefaultSchedule = (): ScheduleItem[] => [
    {
      time: '08:00 AM',
      type: 'available',
      duration: '3 hours',
      note: 'Not booked'
    },
    {
      time: '12:00 PM',
      type: 'break',
      note: 'Lunch Break'
    },
    {
      time: '05:00 PM',
      type: 'available',
      duration: '2 hours',
      note: 'Available for booking'
    }
  ];

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="text-center py-8 text-gray-500">Loading schedule...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200" style={{ backgroundImage: 'none' }}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-gray-900 mb-3 font-semibold">Today's Schedule</h2>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <div className="flex items-center gap-2">
            <button className="p-1 hover:bg-gray-100 rounded transition-colors">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <button className="px-3 py-1 text-sm bg-[#0066CC] text-white rounded hover:bg-[#0052a3] transition-colors font-medium">
              Today
            </button>
            <button className="p-1 hover:bg-gray-100 rounded transition-colors">
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="p-4 space-y-4 max-h-[700px] overflow-y-auto">
        {schedule.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No schedule items for today</p>
          </div>
        ) : (
          schedule.map((item, index) => (
            <div key={index} className="relative">
              {/* Time Label */}
              <div className="flex items-start gap-4">
                <span className="text-sm text-gray-500 w-20 flex-shrink-0">{formatTime(item.time)}</span>

                <div className="flex-1">
                  {item.type === 'available' && (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 bg-gray-50">
                      <div className="text-sm text-gray-600">[Available Slot]</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {item.duration} • {item.note}
                      </div>
                    </div>
                  )}

                  {item.type === 'break' && (
                    <div className="border border-gray-300 rounded-lg p-3 bg-gray-50">
                      <div className="text-sm text-gray-600">[{item.note}]</div>
                    </div>
                  )}

                  {item.type === 'accepted' && (
                    <div className="border-2 border-[#10B981] rounded-lg p-4 bg-white shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs px-2 py-1 bg-[#10B981] text-white rounded font-medium">
                          ✅ {item.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-900 mb-1 font-medium">{item.hospital}</div>
                      <div className="text-sm text-gray-600 mb-1">Patient: {item.patient}</div>
                      <div className="text-sm text-gray-500 mb-3">{item.condition}</div>
                      <div className="flex gap-2">
                        <button className="flex items-center gap-1 px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors">
                          <Eye className="w-3 h-3" /> View
                        </button>
                        <button className="flex items-center gap-1 px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors">
                          <Phone className="w-3 h-3" /> Call
                        </button>
                        <button className="flex items-center gap-1 px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors">
                          <Navigation className="w-3 h-3" /> Nav
                        </button>
                      </div>
                    </div>
                  )}

                  {item.type === 'pending' && (
                    <div className="border-2 border-[#F59E0B] rounded-lg p-4 bg-white shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs px-2 py-1 bg-[#F59E0B] text-white rounded font-medium">
                          ⏰ {item.status}
                        </span>
                        {item.expiresIn && (
                          <span className="text-xs text-[#F59E0B]">Expires: {item.expiresIn}</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-900 mb-1 font-medium">{item.hospital}</div>
                      <div className="text-sm text-gray-600 mb-1">Patient: {item.patient}</div>
                      <div className="text-sm text-gray-500 mb-3">{item.condition}</div>
                      <div className="flex gap-2">
                        <button className="flex-1 px-3 py-2 text-sm bg-[#10B981] hover:bg-[#059669] text-white rounded transition-colors font-medium">
                          ACCEPT
                        </button>
                        <button className="flex-1 px-3 py-2 text-sm bg-[#EF4444] hover:bg-[#dc2626] text-white rounded transition-colors font-medium">
                          DECLINE
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
