'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Stethoscope,
  AlertCircle,
  Heart,
  Search,
  LogOut,
  ChevronLeft,
  FileText,
  Activity,
  Users
} from 'lucide-react';
import { toast } from 'sonner';
import { isAuthenticated, getUserRole } from '@/lib/auth/utils';
import apiClient from '@/lib/api/httpClient';

interface Booking {
  id: string;
  status: string;
  priority: string;
  requestedAt: string | null;
  expiresAt: string | null;
  actualStartTime: string | null;
  actualEndTime: string | null;
  treatmentNotes: string | null;
  consultationFee: string | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  paidAt: string | null;
  doctorId: string;
  doctorFirstName: string;
  doctorLastName: string;
  doctorPrimaryLocation: string | null;
  symptoms: string | null;
  clinicalNotes: string | null;
  prescription: string | null;
  addressLabel: string | null;
  addressText: string | null;
  addressLatitude: string | null;
  addressLongitude: string | null;
  familyMemberId: string | null;
  familyMemberFullName: string | null;
  familyMemberRelationship: string | null;
  slotDate: string | null;
  slotStartTime: string | null;
  slotEndTime: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border border-amber-100',
  confirmed: 'bg-blue-50 text-blue-700 border border-blue-100',
  in_progress: 'bg-indigo-50 text-indigo-700 border border-indigo-100',
  completed: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  cancelled: 'bg-rose-50 text-rose-700 border border-rose-100',
  expired: 'bg-slate-100 text-slate-600 border border-slate-200',
  rejected: 'bg-rose-50 text-rose-700 border border-rose-100',
};

const PRIORITY_STYLES: Record<string, string> = {
  routine: 'bg-slate-100 text-slate-600',
  urgent: 'bg-orange-50 text-orange-700',
  emergency: 'bg-red-50 text-red-700',
};

function formatStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDateTime(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatSlotTime(value: string | null) {
  if (!value) return '—';
  const [hour, minute] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(hour, minute);
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function PatientBookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'bookings' | 'addresses' | 'family' | 'profile'>('bookings');

  useEffect(() => {
    if (!isAuthenticated() || getUserRole() !== 'patient') {
      router.push('/login?role=patient');
      return;
    }
    fetchBookings();
  }, [router]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/patients/bookings');
      if (res.data.success) {
        setBookings(res.data.data);
      } else {
        toast.error(res.data.message || 'Failed to load bookings');
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast.error('Failed to load bookings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('rememberMe');
    toast.success('Logged out successfully');
    router.push('/login?role=patient');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600 font-medium">Loading your bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col md:flex-row">
      {/* Sidebar Component */}
      <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex flex-col justify-between shrink-0">
        <div>
          {/* Logo Area */}
          <div className="p-6 border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-extrabold shadow-md shadow-blue-500/20">
              <Heart className="w-5 h-5 fill-white" />
            </div>
            <div>
              <span className="font-bold text-slate-900 block leading-tight">MediTap Pro</span>
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Patient Portal</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            <button
              onClick={() => router.push('/patient/dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === 'overview'
                  ? 'bg-blue-50 text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Activity className="w-4 h-4" />
              Overview
            </button>

            <button
              onClick={() => setActiveTab('bookings')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === 'bookings'
                  ? 'bg-blue-50 text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Calendar className="w-4 h-4" />
              My Bookings
            </button>

            <button
              onClick={() => router.push('/patient/search')}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            >
              <Search className="w-4 h-4" />
              Find Doctors
            </button>

            <button
              onClick={() => router.push('/patient/dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === 'addresses'
                  ? 'bg-blue-50 text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <MapPin className="w-4 h-4" />
              Manage Addresses
            </button>

            <button
              onClick={() => router.push('/patient/dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === 'family'
                  ? 'bg-blue-50 text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Users className="w-4 h-4" />
              Family Members
            </button>

            <button
              onClick={() => router.push('/patient/dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === 'profile'
                  ? 'bg-blue-50 text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <User className="w-4 h-4" />
              Profile & Settings
            </button>
          </nav>
        </div>

        {/* Footer Area with user profile details & logout */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold shrink-0">
              {(profileName || 'P').charAt(0)}
            </div>
            <div className="overflow-hidden">
              <span className="block text-xs font-semibold text-slate-800 truncate">{profileName || 'Patient'}</span>
              <span className="block text-[10px] text-slate-500 truncate">{profileEmail}</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
            title="Log Out"
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-5xl">
        {/* Header */}
        <header className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <button
              onClick={() => router.push('/patient/dashboard')}
              className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Back to Dashboard
            </button>
            <h2 className="text-2xl font-bold text-slate-900">My Home Visit Bookings</h2>
            <p className="text-sm text-slate-500">
              Track the status of your doctor home visit requests.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-1.5 w-fit shadow-sm">
            <Clock className="w-3.5 h-3.5 text-blue-500" />
            <span>Today: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white/85 backdrop-blur-sm border border-slate-100 rounded-xl p-5 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <span className="block text-2xl font-bold text-slate-950">{bookings.length}</span>
              <span className="text-xs font-semibold text-slate-500">Total Bookings</span>
            </div>
          </div>
          <div className="bg-white/85 backdrop-blur-sm border border-slate-100 rounded-xl p-5 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <span className="block text-2xl font-bold text-slate-950">
                {bookings.filter((b) => ['pending', 'confirmed', 'in_progress'].includes(b.status)).length}
              </span>
              <span className="text-xs font-semibold text-slate-500">Active Visits</span>
            </div>
          </div>
          <div className="bg-white/85 backdrop-blur-sm border border-slate-100 rounded-xl p-5 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <span className="block text-2xl font-bold text-slate-950">
                {bookings.filter((b) => b.status === 'completed').length}
              </span>
              <span className="text-xs font-semibold text-slate-500">Completed Visits</span>
            </div>
          </div>
        </div>

        {/* Bookings List */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900">All Bookings</h3>
            <span className="text-xs font-medium text-slate-400">Showing recent first</span>
          </div>

          {bookings.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 font-medium mb-1">No home visit bookings yet</p>
              <p className="text-xs text-slate-400 mb-4">Book a doctor visit for you or your family members.</p>
              <button
                onClick={() => router.push('/patient/search')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-semibold"
              >
                Find a Doctor
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {bookings.map((booking) => (
                <div key={booking.id} className="p-5 hover:bg-slate-50/55 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    {/* Left: main info */}
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-semibold text-slate-950 text-sm">
                          {booking.slotDate ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-blue-500" />
                              {new Date(booking.slotDate + 'T00:00:00').toLocaleDateString('en-IN', {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                          ) : (
                            'Visit date not set'
                          )}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${STATUS_STYLES[booking.status] || STATUS_STYLES.pending}`}>
                          {formatStatus(booking.status)}
                        </span>
                        {booking.priority && (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${PRIORITY_STYLES[booking.priority] || PRIORITY_STYLES.routine}`}>
                            {booking.priority}
                          </span>
                        )}
                      </div>

                      <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                        <Stethoscope className="w-4 h-4 text-blue-500 shrink-0" />
                        Dr. {booking.doctorFirstName} {booking.doctorLastName}
                        {booking.doctorPrimaryLocation && (
                          <span className="text-xs font-medium text-slate-400">• {booking.doctorPrimaryLocation}</span>
                        )}
                      </p>

                      {booking.slotStartTime && (
                        <p className="text-xs text-slate-500 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {formatSlotTime(booking.slotStartTime)} - {formatSlotTime(booking.slotEndTime)}
                        </p>
                      )}

                      {booking.familyMemberFullName && booking.familyMemberId ? (
                        <p className="text-xs text-slate-500 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          Visit for: <span className="font-semibold">{booking.familyMemberFullName}</span>
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold uppercase tracking-wider">
                            {booking.familyMemberRelationship}
                          </span>
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          Visit for: <span className="font-semibold">Self</span>
                        </p>
                      )}

                      {booking.addressText && (
                        <p className="text-xs text-slate-500 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-semibold">{booking.addressLabel}:</span> {booking.addressText}
                        </p>
                      )}

                      {booking.symptoms && (
                        <p className="text-xs text-slate-600 italic flex items-start gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                          <span>&quot;{booking.symptoms}&quot;</span>
                        </p>
                      )}

                      {booking.treatmentNotes && (
                        <p className="text-xs text-slate-700 flex items-start gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                          <span>
                            <span className="font-semibold">Doctor&apos;s note:</span>{' '}
                            <span className="whitespace-pre-wrap">{booking.treatmentNotes}</span>
                          </span>
                        </p>
                      )}

                      {booking.clinicalNotes && (
                        <p className="text-xs text-slate-600 flex items-start gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                          <span><span className="font-semibold">Doctor's note:</span> {booking.clinicalNotes}</span>
                        </p>
                      )}

                      {booking.prescription && (
                        <p className="text-xs text-slate-600 flex items-start gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-indigo-500 mt-0.5 shrink-0" />
                          <span><span className="font-semibold">Prescription:</span> {booking.prescription}</span>
                        </p>
                      )}

                      {booking.status === 'cancelled' && booking.cancellationReason && (
                        <p className="text-xs text-rose-600 flex items-start gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          <span><span className="font-semibold">Cancellation reason:</span> {booking.cancellationReason}</span>
                        </p>
                      )}
                    </div>

                    {/* Right: meta info */}
                    <div className="flex flex-col gap-1 items-start lg:items-end text-xs text-slate-500 shrink-0">
                      {booking.requestedAt && (
                        <span className="font-medium text-slate-400">
                          Requested: {formatDateTime(booking.requestedAt)}
                        </span>
                      )}
                      {booking.expiresAt && (
                        <span className={`flex items-center gap-1 ${booking.status === 'pending' ? 'text-amber-600 font-semibold' : ''}`}>
                          <Clock className="w-3.5 h-3.5" />
                          Expires: {formatDateTime(booking.expiresAt)}
                        </span>
                      )}
                      {booking.consultationFee && (
                        <span className="font-bold text-slate-800">₹{booking.consultationFee}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
