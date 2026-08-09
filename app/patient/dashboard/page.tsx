'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Home, 
  MapPin, 
  Users, 
  User, 
  Calendar, 
  Clock, 
  LogOut, 
  Plus, 
  Check, 
  AlertCircle,
  FileText,
  Activity,
  Heart,
  Search
} from 'lucide-react';
import { toast } from 'sonner';
import { isAuthenticated, getUserRole } from '@/lib/auth/utils';
import apiClient from '@/lib/api/httpClient';

interface Address {
  id: string;
  label: string;
  addressText: string;
  latitude: number | string | null;
  longitude: number | string | null;
  isDefault: boolean;
}

interface FamilyMember {
  id: string;
  fullName: string;
  phone: string;
  relationship: string;
}

interface Profile {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
}

interface Booking {
  id: string;
  patientName: string;
  relationship: string;
  addressLabel: string;
  addressText: string;
  date: string;
  timeSlot: string;
  reason: string;
  status: 'Pending' | 'Confirmed' | 'Completed';
}

export default function PatientDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'book' | 'addresses' | 'family' | 'profile'>('overview');
  
  // State variables
  const [profile, setProfile] = useState<Profile | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([
    {
      id: 'mock-1',
      patientName: 'Self',
      relationship: 'Self',
      addressLabel: 'Home',
      addressText: '123 Main St, Apartment 4B, Central City',
      date: '2026-08-12',
      timeSlot: '10:00 AM - 12:00 PM',
      reason: 'Routine dental checkup and teeth cleaning',
      status: 'Confirmed',
    }
  ]);
  
  const [loading, setLoading] = useState(true);
  
  // Form states
  const [addressForm, setAddressForm] = useState({
    label: '',
    addressText: '',
    latitude: '',
    longitude: '',
    isDefault: false
  });
  
  const [familyForm, setFamilyForm] = useState({
    fullName: '',
    phone: '',
    relationship: 'Spouse'
  });
  
  const [profileForm, setProfileForm] = useState({
    fullName: ''
  });
  
  const [bookingForm, setBookingForm] = useState({
    patientId: 'self',
    addressId: '',
    date: '',
    timeSlot: '09:00 AM - 11:00 AM',
    reason: ''
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formSubmitting, setFormSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated() && getUserRole() === 'patient') {
      fetchInitialData();
    } else {
      router.push('/login?role=patient');
    }
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // Fetch Profile
      const profileRes = await apiClient.get('/api/patients/profile');
      const profileData = profileRes.data;
      if (profileData.success && profileData.data) {
        setProfile(profileData.data);
        setProfileForm({ fullName: profileData.data.fullName });
      }

      // Fetch Addresses
      const addressRes = await apiClient.get('/api/patients/addresses');
      const addressData = addressRes.data;
      if (addressData.success && addressData.data) {
        setAddresses(addressData.data);
        // Pre-select default address for booking form if available
        const defaultAddr = addressData.data.find((a: Address) => a.isDefault);
        if (defaultAddr) {
          setBookingForm(prev => ({ ...prev, addressId: defaultAddr.id }));
        } else if (addressData.data.length > 0) {
          setBookingForm(prev => ({ ...prev, addressId: addressData.data[0].id }));
        }
      }

      // Fetch Family Members
      const familyRes = await apiClient.get('/api/patients/family-members');
      const familyData = familyRes.data;
      if (familyData.success && familyData.data) {
        setFamilyMembers(familyData.data);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data. Please try again.');
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

  // Address Submit Handler
  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    
    if (!addressForm.label.trim()) {
      setFormErrors(prev => ({ ...prev, label: 'Label is required (e.g. Home, Work)' }));
      return;
    }
    if (!addressForm.addressText.trim()) {
      setFormErrors(prev => ({ ...prev, addressText: 'Address details are required' }));
      return;
    }

    setFormSubmitting(true);
    try {
      const payload = {
        label: addressForm.label,
        addressText: addressForm.addressText,
        latitude: addressForm.latitude ? parseFloat(addressForm.latitude) : undefined,
        longitude: addressForm.longitude ? parseFloat(addressForm.longitude) : undefined,
        isDefault: addressForm.isDefault
      };

      const res = await apiClient.post('/api/patients/addresses', payload);
      const data = res.data;

      if (data.success) {
        toast.success('Address saved successfully!');
        setAddressForm({
          label: '',
          addressText: '',
          latitude: '',
          longitude: '',
          isDefault: false
        });
        // Refresh addresses list
        const addressRes = await apiClient.get('/api/patients/addresses');
        const addressData = addressRes.data;
        if (addressData.success && addressData.data) {
          setAddresses(addressData.data);
        }
      } else {
        toast.error(data.message || 'Failed to save address');
      }
    } catch (error) {
      console.error(error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Family Member Submit Handler
  const handleFamilySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    
    if (!familyForm.fullName.trim()) {
      setFormErrors(prev => ({ ...prev, fullName: 'Full name is required' }));
      return;
    }
    if (!familyForm.phone.trim()) {
      setFormErrors(prev => ({ ...prev, phone: 'Phone number is required' }));
      return;
    }
    if (familyForm.phone.replace(/\D/g, '').length < 10) {
      setFormErrors(prev => ({ ...prev, phone: 'Please enter a valid 10-digit phone number' }));
      return;
    }

    setFormSubmitting(true);
    try {
      const res = await apiClient.post('/api/patients/family-members', familyForm);
      const data = res.data;

      if (data.success) {
        toast.success('Family member added successfully!');
        setFamilyForm({
          fullName: '',
          phone: '',
          relationship: 'Spouse'
        });
        // Refresh family list
        const familyRes = await apiClient.get('/api/patients/family-members');
        const familyData = familyRes.data;
        if (familyData.success && familyData.data) {
          setFamilyMembers(familyData.data);
        }
      } else {
        toast.error(data.message || 'Failed to add family member');
      }
    } catch (error) {
      console.error(error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Profile Update Submit Handler
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    
    if (!profileForm.fullName.trim()) {
      setFormErrors(prev => ({ ...prev, profileName: 'Full name cannot be empty' }));
      return;
    }

    setFormSubmitting(true);
    try {
      const res = await apiClient.put('/api/patients/profile', { fullName: profileForm.fullName });
      const data = res.data;

      if (data.success) {
        toast.success('Profile updated successfully!');
        if (profile) {
          setProfile({ ...profile, fullName: profileForm.fullName });
        }
      } else {
        toast.error(data.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error(error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Booking Submit Handler
  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    if (!bookingForm.addressId) {
      setFormErrors(prev => ({ ...prev, bookingAddress: 'Please select or add a saved address first' }));
      return;
    }
    if (!bookingForm.date) {
      setFormErrors(prev => ({ ...prev, bookingDate: 'Date is required' }));
      return;
    }
    if (!bookingForm.reason.trim()) {
      setFormErrors(prev => ({ ...prev, bookingReason: 'Please describe the reason for visit/symptoms' }));
      return;
    }

    setFormSubmitting(true);
    try {
      // Find patient name
      let patientName = 'Self';
      let relationship = 'Self';
      if (bookingForm.patientId !== 'self') {
        const member = familyMembers.find(m => m.id === bookingForm.patientId);
        if (member) {
          patientName = member.fullName;
          relationship = member.relationship;
        }
      }

      // Find address details
      const address = addresses.find(a => a.id === bookingForm.addressId);
      const addressLabel = address?.label || 'Custom';
      const addressText = address?.addressText || '';

      const newBooking: Booking = {
        id: 'mock-' + Date.now(),
        patientName,
        relationship,
        addressLabel,
        addressText,
        date: bookingForm.date,
        timeSlot: bookingForm.timeSlot,
        reason: bookingForm.reason,
        status: 'Pending'
      };

      // Mock adding home visit booking since we don't have database tables for visits yet
      // This allows immediate feedback & functional demonstration without database limits
      setTimeout(() => {
        setBookings(prev => [newBooking, ...prev]);
        toast.success('Home Visit scheduled successfully!');
        setBookingForm(prev => ({
          ...prev,
          date: '',
          reason: ''
        }));
        setActiveTab('overview');
        setFormSubmitting(false);
      }, 1000);

    } catch (error) {
      console.error(error);
      toast.error('Failed to schedule booking.');
      setFormSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600 font-medium">Loading your portal details...</p>
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
              onClick={() => setActiveTab('overview')}
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
              onClick={() => setActiveTab('book')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === 'book'
                  ? 'bg-blue-50 text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Book Home Visit
            </button>

            <button
              onClick={() => router.push('/patient/search')}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            >
              <Search className="w-4 h-4" />
              Find Doctors
            </button>

            <button
              onClick={() => setActiveTab('addresses')}
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
              onClick={() => setActiveTab('family')}
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
              onClick={() => setActiveTab('profile')}
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
              {profile?.fullName.charAt(0) || 'P'}
            </div>
            <div className="overflow-hidden">
              <span className="block text-xs font-semibold text-slate-800 truncate">{profile?.fullName}</span>
              <span className="block text-[10px] text-slate-500 truncate">{profile?.email}</span>
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
        {/* Header Greeting */}
        <header className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Welcome back, {profile?.fullName || 'Patient'}!
            </h2>
            <p className="text-sm text-slate-500">
              Manage your healthcare, saved addresses, and coordinate doctor home visits.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-1.5 w-fit shadow-sm">
            <Clock className="w-3.5 h-3.5 text-blue-500" />
            <span>Today: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
        </header>

        {/* Overview Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white/85 backdrop-blur-sm border border-slate-100 rounded-xl p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <span className="block text-2xl font-bold text-slate-950">{addresses.length}</span>
                  <span className="text-xs font-semibold text-slate-500">Saved Addresses</span>
                </div>
              </div>

              <div className="bg-white/85 backdrop-blur-sm border border-slate-100 rounded-xl p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <span className="block text-2xl font-bold text-slate-950">{familyMembers.length}</span>
                  <span className="text-xs font-semibold text-slate-500">Family Members</span>
                </div>
              </div>

              <div className="bg-white/85 backdrop-blur-sm border border-slate-100 rounded-xl p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <span className="block text-2xl font-bold text-slate-950">{bookings.length}</span>
                  <span className="text-xs font-semibold text-slate-500">Scheduled Visits</span>
                </div>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-500/10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold">Need a doctor's consultation at home?</h3>
                <p className="text-sm text-blue-100 max-w-xl">
                  Quickly schedule a certified surgeon or physician to visit your location. Make sure your addresses and family members are updated.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => router.push('/patient/search')}
                  className="px-5 py-2.5 bg-white text-blue-700 font-bold rounded-lg hover:bg-blue-50 transition-colors text-sm w-fit shrink-0 shadow-sm"
                >
                  Find a Doctor
                </button>
                <button
                  onClick={() => setActiveTab('book')}
                  className="px-5 py-2.5 bg-white/15 border border-white/30 text-white font-bold rounded-lg hover:bg-white/25 transition-colors text-sm w-fit shrink-0"
                >
                  Schedule Visit Now
                </button>
              </div>
            </div>

            {/* Bookings Section */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900">Your Scheduled Home Visits</h3>
                <span className="text-xs font-medium text-slate-400">Showing recent first</span>
              </div>
              
              {bookings.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 font-medium mb-1">No scheduled visits</p>
                  <p className="text-xs text-slate-400 mb-4">Book a doctor visit for you or your family members.</p>
                  <button
                    onClick={() => setActiveTab('book')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-semibold"
                  >
                    Schedule Home Visit
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {bookings.map((booking) => (
                    <div key={booking.id} className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:bg-slate-50/55 transition-colors">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-semibold text-slate-950 text-sm">
                            Patient: {booking.patientName}
                          </span>
                          {booking.relationship !== 'Self' && (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">
                              {booking.relationship}
                            </span>
                          )}
                          <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                            booking.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                            booking.status === 'Confirmed' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                            'bg-amber-50 text-amber-700 border border-amber-100'
                          }`}>
                            {booking.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-semibold">{booking.addressLabel}:</span> {booking.addressText}
                        </p>
                        <p className="text-xs text-slate-600 italic">
                          " {booking.reason} "
                        </p>
                      </div>

                      <div className="flex flex-col gap-1 items-start sm:items-end text-xs text-slate-500 shrink-0">
                        <span className="font-semibold text-slate-800 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-blue-500" />
                          {booking.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {booking.timeSlot}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Book Home Visit Tab Content */}
        {activeTab === 'book' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm max-w-xl animate-fadeIn">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Book a Doctor Home Visit</h3>
            <p className="text-xs text-slate-500 mb-6">Schedule a verified general or specialist surgeon to visit your saved location.</p>

            <form onSubmit={handleBookingSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  For Patient
                </label>
                <select
                  value={bookingForm.patientId}
                  onChange={(e) => setBookingForm(prev => ({ ...prev, patientId: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="self">Myself ({profile?.fullName})</option>
                  {familyMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.fullName} ({member.relationship})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-semibold text-slate-700">
                    Visit Address
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveTab('addresses')}
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                  >
                    + Add New Address
                  </button>
                </div>
                {addresses.length === 0 ? (
                  <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-lg text-xs text-amber-800 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <span>You have no saved addresses. Please go to the </span>
                      <button 
                        type="button" 
                        onClick={() => setActiveTab('addresses')}
                        className="underline font-bold"
                      >
                        Manage Addresses
                      </button>
                      <span> page to add a location first.</span>
                    </div>
                  </div>
                ) : (
                  <select
                    value={bookingForm.addressId}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, addressId: e.target.value }))}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${
                      formErrors.bookingAddress ? 'border-red-500' : 'border-slate-200'
                    }`}
                  >
                    {addresses.map((addr) => (
                      <option key={addr.id} value={addr.id}>
                        {addr.label} - {addr.addressText}
                      </option>
                    ))}
                  </select>
                )}
                {formErrors.bookingAddress && <p className="mt-1 text-xs text-red-500 font-medium">{formErrors.bookingAddress}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Preferred Date
                  </label>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={bookingForm.date}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, date: e.target.value }))}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${
                      formErrors.bookingDate ? 'border-red-500' : 'border-slate-200'
                    }`}
                  />
                  {formErrors.bookingDate && <p className="mt-1 text-xs text-red-500 font-medium">{formErrors.bookingDate}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Time Slot
                  </label>
                  <select
                    value={bookingForm.timeSlot}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, timeSlot: e.target.value }))}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="09:00 AM - 11:00 AM">09:00 AM - 11:00 AM</option>
                    <option value="11:00 AM - 01:00 PM">11:00 AM - 01:00 PM</option>
                    <option value="02:00 PM - 04:00 PM">02:00 PM - 04:00 PM</option>
                    <option value="04:00 PM - 06:00 PM">04:00 PM - 06:00 PM</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Reason for Visit / Symptoms
                </label>
                <textarea
                  rows={4}
                  value={bookingForm.reason}
                  onChange={(e) => setBookingForm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Please describe symptoms, purpose of visit, or medical requests..."
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${
                    formErrors.bookingReason ? 'border-red-500' : 'border-slate-200'
                  }`}
                />
                {formErrors.bookingReason && <p className="mt-1 text-xs text-red-500 font-medium">{formErrors.bookingReason}</p>}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={formSubmitting || addresses.length === 0}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01]"
                >
                  {formSubmitting ? 'Scheduling Visit...' : 'Confirm & Request Visit'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Manage Addresses Tab Content */}
        {activeTab === 'addresses' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start animate-fadeIn">
            {/* Address List */}
            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-lg font-bold text-slate-900">Your Saved Locations</h3>
              {addresses.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-8 text-center shadow-sm">
                  <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 font-medium mb-1">No addresses saved yet</p>
                  <p className="text-xs text-slate-400">Save your home, office, or relative's address for fast booking.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {addresses.map((addr) => (
                    <div 
                      key={addr.id} 
                      className={`bg-white border rounded-xl p-5 shadow-sm relative flex flex-col justify-between gap-4 transition-all duration-300 hover:shadow-md ${
                        addr.isDefault ? 'border-blue-500 shadow-blue-500/5' : 'border-slate-200'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-slate-900 text-sm">{addr.label}</span>
                          {addr.isDefault && (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-extrabold border border-blue-100 flex items-center gap-0.5">
                              <Check className="w-3 h-3" /> Default
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{addr.addressText}</p>
                      </div>
                      
                      {/* Optional coordinates showing */}
                      {(addr.latitude !== null && addr.latitude !== undefined && addr.longitude !== null && addr.longitude !== undefined) && (
                        <div className="text-[10px] font-semibold text-slate-400 flex gap-2">
                          <span>Lat: {Number(addr.latitude).toFixed(4)}</span>
                          <span>Lon: {Number(addr.longitude).toFixed(4)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Address Form */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <h4 className="font-bold text-slate-900 mb-1">Add New Location</h4>
              <p className="text-xs text-slate-500 mb-4">Save coordinates and directions to assist surgeons in finding you.</p>

              <form onSubmit={handleAddressSubmit} className="space-y-4">
                <div>
                  <label htmlFor="label" className="block text-sm font-semibold text-slate-700 mb-1">
                    Label Name *
                  </label>
                  <input
                    id="label"
                    type="text"
                    required
                    value={addressForm.label}
                    onChange={(e) => setAddressForm(prev => ({ ...prev, label: e.target.value }))}
                    placeholder="e.g. Home, Work, Parents"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${
                      formErrors.label ? 'border-red-500' : 'border-slate-200'
                    }`}
                  />
                  {formErrors.label && <p className="mt-1 text-xs text-red-500 font-medium">{formErrors.label}</p>}
                </div>

                <div>
                  <label htmlFor="addressText" className="block text-sm font-semibold text-slate-700 mb-1">
                    Address Details *
                  </label>
                  <textarea
                    id="addressText"
                    required
                    rows={3}
                    value={addressForm.addressText}
                    onChange={(e) => setAddressForm(prev => ({ ...prev, addressText: e.target.value }))}
                    placeholder="Apartment/Flat No, Building, Street, Area, City, Pin Code"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${
                      formErrors.addressText ? 'border-red-500' : 'border-slate-200'
                    }`}
                  />
                  {formErrors.addressText && <p className="mt-1 text-xs text-red-500 font-medium">{formErrors.addressText}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="latitude" className="block text-xs font-semibold text-slate-600 mb-1">
                      Latitude (Optional)
                    </label>
                    <input
                      id="latitude"
                      type="number"
                      step="0.000001"
                      value={addressForm.latitude}
                      onChange={(e) => setAddressForm(prev => ({ ...prev, latitude: e.target.value }))}
                      placeholder="e.g. 19.076"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                    />
                  </div>

                  <div>
                    <label htmlFor="longitude" className="block text-xs font-semibold text-slate-600 mb-1">
                      Longitude (Optional)
                    </label>
                    <input
                      id="longitude"
                      type="number"
                      step="0.000001"
                      value={addressForm.longitude}
                      onChange={(e) => setAddressForm(prev => ({ ...prev, longitude: e.target.value }))}
                      placeholder="e.g. 72.877"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 py-1">
                  <input
                    id="isDefault"
                    type="checkbox"
                    checked={addressForm.isDefault}
                    onChange={(e) => setAddressForm(prev => ({ ...prev, isDefault: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="isDefault" className="text-xs text-slate-700 font-semibold cursor-pointer">
                    Set as default location
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="w-full flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-sm hover:shadow-md transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01]"
                >
                  <Plus className="w-4 h-4" /> Save Location
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Family Members Tab Content */}
        {activeTab === 'family' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start animate-fadeIn">
            {/* Family List */}
            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-lg font-bold text-slate-900">Your Registered Family Members</h3>
              {familyMembers.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-8 text-center shadow-sm">
                  <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 font-medium mb-1">No family members registered</p>
                  <p className="text-xs text-slate-400">Add dependents, parents, or children to schedule visits on their behalf.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {familyMembers.map((member) => (
                    <div 
                      key={member.id} 
                      className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow"
                    >
                      <div className="w-10 h-10 bg-indigo-50 text-indigo-700 rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                        {member.fullName.charAt(0)}
                      </div>
                      <div className="overflow-hidden">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-slate-950 text-sm truncate">{member.fullName}</span>
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 border border-indigo-100/30">
                            {member.relationship}
                          </span>
                        </div>
                        <span className="block text-xs text-slate-500 font-medium">{member.phone}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Family Member Form */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <h4 className="font-bold text-slate-900 mb-1">Add Family Member</h4>
              <p className="text-xs text-slate-500 mb-4">Register your dependents to easily schedule healthcare at home.</p>

              <form onSubmit={handleFamilySubmit} className="space-y-4">
                <div>
                  <label htmlFor="fullName" className="block text-sm font-semibold text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    required
                    value={familyForm.fullName}
                    onChange={(e) => setFamilyForm(prev => ({ ...prev, fullName: e.target.value }))}
                    placeholder="e.g. Jane Doe"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${
                      formErrors.fullName ? 'border-red-500' : 'border-slate-200'
                    }`}
                  />
                  {formErrors.fullName && <p className="mt-1 text-xs text-red-500 font-medium">{formErrors.fullName}</p>}
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-semibold text-slate-700 mb-1">
                    Contact Phone Number *
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    required
                    value={familyForm.phone}
                    onChange={(e) => setFamilyForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="e.g. 9876543210"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${
                      formErrors.phone ? 'border-red-500' : 'border-slate-200'
                    }`}
                  />
                  {formErrors.phone && <p className="mt-1 text-xs text-red-500 font-medium">{formErrors.phone}</p>}
                </div>

                <div>
                  <label htmlFor="relationship" className="block text-sm font-semibold text-slate-700 mb-1">
                    Relationship *
                  </label>
                  <select
                    id="relationship"
                    value={familyForm.relationship}
                    onChange={(e) => setFamilyForm(prev => ({ ...prev, relationship: e.target.value }))}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="Spouse">Spouse</option>
                    <option value="Child">Child</option>
                    <option value="Parent">Parent</option>
                    <option value="Sibling">Sibling</option>
                    <option value="Other">Other Dependency</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="w-full flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-sm hover:shadow-md transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01]"
                >
                  <Plus className="w-4 h-4" /> Add Family Member
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Profile and Settings Tab Content */}
        {activeTab === 'profile' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm max-w-xl animate-fadeIn">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Profile Details & Settings</h3>
            <p className="text-xs text-slate-500 mb-6">Manage your patient registration credentials and profile details.</p>

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  disabled
                  value={profile?.email || ''}
                  className="w-full px-4 py-2 border border-slate-100 bg-slate-50 text-slate-500 rounded-lg text-sm cursor-not-allowed font-medium"
                />
                <p className="mt-1 text-[10px] text-slate-400">Your login email cannot be modified.</p>
              </div>

              <div>
                <label htmlFor="profileFullName" className="block text-sm font-semibold text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  id="profileFullName"
                  type="text"
                  required
                  value={profileForm.fullName}
                  onChange={(e) => setProfileForm({ fullName: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${
                    formErrors.profileName ? 'border-red-500' : 'border-slate-200'
                  }`}
                />
                {formErrors.profileName && <p className="mt-1 text-xs text-red-500 font-medium">{formErrors.profileName}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Contact Phone Number
                </label>
                <input
                  type="tel"
                  disabled
                  value={profile?.phone || 'Not provided'}
                  className="w-full px-4 py-2 border border-slate-100 bg-slate-50 text-slate-500 rounded-lg text-sm cursor-not-allowed font-medium"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01]"
                >
                  {formSubmitting ? 'Updating Settings...' : 'Save Profile Settings'}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
