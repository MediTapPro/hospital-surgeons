'use client';

import { Bell, Search, Crown, ChevronDown } from 'lucide-react';
import { useState, useEffect } from 'react';
import { decodeToken, isAuthenticated } from '@/lib/auth/utils';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  collapsed?: boolean;
}

export function DoctorHeader({ collapsed }: HeaderProps) {
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [doctorName, setDoctorName] = useState("Dr. Doctor");
  const router = useRouter();

  useEffect(() => {
    const fetchDoctorInfo = async () => {
      if (isAuthenticated()) {
        try {
          const token = localStorage.getItem("accessToken");
          const response = await fetch('/api/doctors/profile', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          const data = await response.json();
          if (data.success && data.data) {
            setDoctorName(`Dr. ${data.data.firstName || ''} ${data.data.lastName || ''}`.trim() || "Dr. Doctor");
          }
        } catch (error) {
          console.error('Error fetching doctor info:', error);
        }
      }
    };
    fetchDoctorInfo();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("rememberMe");
    router.push("/login");
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-[72px] bg-white border-b border-slate-200 z-50">
      <div className="h-full px-6 flex items-center justify-between">
        {/* Left Section */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-semibold">M</span>
            </div>
            <span className="text-xl text-slate-900 font-semibold">MedConnect</span>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <span className="text-slate-700 font-medium">{doctorName}</span>
            <div className="w-5 h-5 bg-teal-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs">✓</span>
            </div>
          </div>
        </div>

        {/* Center - Search */}
        <div className="flex-1 max-w-xl mx-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search patients, assignments, hospitals..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 bg-slate-50"
            />
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4">
          {/* Emergency Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Emergency</span>
            <button
              onClick={() => setEmergencyMode(!emergencyMode)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                emergencyMode ? 'bg-teal-500' : 'bg-slate-300'
              }`}
            >
              <div
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  emergencyMode ? 'translate-x-6' : ''
                }`}
              />
            </button>
          </div>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 hover:bg-slate-100 rounded-lg relative"
            >
              <Bell className="w-5 h-5 text-slate-600" />
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-semibold">
                5
              </span>
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-slate-200 py-2 max-h-96 overflow-y-auto">
                <div className="px-4 py-2 border-b border-slate-200">
                  <span className="text-sm font-medium text-slate-900">Notifications</span>
                </div>
                <div className="divide-y divide-slate-200">
                  <div className="px-4 py-3 hover:bg-slate-50 cursor-pointer">
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-teal-600 rounded-full mt-1.5" />
                      <div>
                        <p className="text-sm text-slate-900">New assignment request</p>
                        <p className="text-xs text-slate-500 mt-1">City Heart Hospital • 5 min ago</p>
                      </div>
                    </div>
                  </div>
                  <div className="px-4 py-3 hover:bg-slate-50 cursor-pointer">
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-teal-500 rounded-full mt-1.5" />
                      <div>
                        <p className="text-sm text-slate-900">Credential verified</p>
                        <p className="text-xs text-slate-500 mt-1">MBBS Certificate • 1 hour ago</p>
                      </div>
                    </div>
                  </div>
                  <div className="px-4 py-3 hover:bg-slate-50 cursor-pointer">
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-amber-500 rounded-full mt-1.5" />
                      <div>
                        <p className="text-sm text-slate-900">Payment received</p>
                        <p className="text-xs text-slate-500 mt-1">$2,500 from Apollo Hospital • 2 hours ago</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Subscription Badge */}
          <div className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 rounded-lg">
            <Crown className="w-4 h-4 text-white" />
            <span className="text-sm text-white font-semibold">Platinum</span>
          </div>

          {/* Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 hover:bg-slate-100 rounded-lg p-2"
            >
              <div className="w-8 h-8 bg-teal-600 rounded-full flex items-center justify-center relative">
                <span className="text-white text-sm font-semibold">{doctorName.split(' ')[1]?.charAt(0) || 'D'}</span>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-teal-500 rounded-full border-2 border-white" />
              </div>
              <ChevronDown className="w-4 h-4 text-slate-600" />
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-slate-200 py-2">
                <div className="px-4 py-3 border-b border-slate-200">
                  <p className="text-sm text-slate-900 font-medium">{doctorName}</p>
                  <p className="text-xs text-slate-500">Cardiology Specialist</p>
                </div>
                <button className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 font-medium text-slate-700">
                  Settings
                </button>
                <button className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 font-medium text-slate-700">
                  Subscription
                </button>
                <hr className="my-2" />
                <button 
                  onClick={handleLogout}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-slate-100 font-medium"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}


