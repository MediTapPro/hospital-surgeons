'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Notification {
  id: string;
  type: 'doctor_available' | 'appointment_confirmed' | 'appointment_declined';
  title: string;
  message: string;
  timestamp: string;
}

export default function DoctorAlertsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    // Fetch notifications
    fetch('/api/notifications', {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setNotifications(data.data || []);
        }
      });
  }, []);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'doctor_available':
        return (
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        );
      case 'appointment_confirmed':
        return (
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
      case 'appointment_declined':
        return (
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4">
        <h1 className="text-xl font-bold">DocSchedule</h1>
      </div>

      {/* Notifications Section */}
      <div className="p-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Notifications</h2>

        <div className="space-y-4">
          {notifications.length === 0 ? (
            // Mock notifications for UI
            <>
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex items-start gap-4">
                  {getNotificationIcon('doctor_available')}
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">Doctor Available</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Dr. Sarah Johnson is now available for appointments today from 3:00 PM to 5:00 PM
                    </p>
                    <p className="text-xs text-gray-500 mt-2 text-right">5 minutes ago</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex items-start gap-4">
                  {getNotificationIcon('appointment_confirmed')}
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">Appointment Confirmed</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Dr. Michael Chen has confirmed the appointment for today at 11:30 AM
                    </p>
                    <p className="text-xs text-gray-500 mt-2 text-right">30 minutes ago</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex items-start gap-4">
                  {getNotificationIcon('appointment_declined')}
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">Appointment Declined</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Dr. Lisa Patel has declined the appointment request for tomorrow
                    </p>
                    <p className="text-xs text-gray-500 mt-2 text-right">2 hours ago</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            notifications.map((notification) => (
              <div key={notification.id} className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex items-start gap-4">
                  {getNotificationIcon(notification.type)}
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{notification.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                    <p className="text-xs text-gray-500 mt-2 text-right">{notification.timestamp}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around py-2">
        <Link href="/doctor/dashboard" className="flex flex-col items-center gap-1">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-xs text-gray-400">Schedule</span>
        </Link>
        <Link href="/doctor/alerts" className="flex flex-col items-center gap-1">
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="text-xs text-blue-600 font-medium">Alerts</span>
        </Link>
        <Link href="/doctor/profile" className="flex flex-col items-center gap-1">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-xs text-gray-400">Profile</span>
        </Link>
      </div>
    </div>
  );
}









































