'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  MapPin, 
  Calendar as CalendarIcon, 
  Clock, 
  Stethoscope, 
  ChevronLeft, 
  Plus, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  User, 
  UserPlus,
  AlertTriangle,
  Info
} from 'lucide-react';
import apiClient from '@/lib/api/httpClient';
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group';
import { Textarea } from '@/app/components/ui/textarea';
import { Alert, AlertDescription } from '@/app/components/ui/alert';

interface DoctorDetails {
  id: string;
  firstName: string;
  lastName: string;
  bio: string | null;
  medicalLicenseNumber: string;
  yearsOfExperience: number;
  photoUrl: string | null;
  specialties: Array<{ id: string; name: string }>;
}

interface SavedAddress {
  id: string;
  label: string;
  addressText: string;
  latitude?: string | null;
  longitude?: string | null;
  isDefault: boolean;
}

interface FamilyMember {
  id: string;
  fullName: string;
  phone: string;
  relationship: string;
}

interface ParentSlot {
  id: string;
  start: string;
  end: string;
  slotDate: string;
  slotType: string;
}

interface BookedSubslot {
  id: string;
  start: string;
  end: string;
}

interface SlotDetail {
  parentSlot: ParentSlot;
  bookedSubslots: BookedSubslot[];
}

export default function BookHomeVisitPage() {
  const params = useParams();
  const router = useRouter();
  const doctorId = params.doctorId as string;

  // Global Page states
  const [doctor, setDoctor] = useState<DoctorDetails | null>(null);
  const [loadingDoctor, setLoadingDoctor] = useState(true);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  
  // Booking Form State
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date(Date.now() + 86400000).toISOString().split('T')[0] // Default to tomorrow
  );
  const [slots, setSlots] = useState<SlotDetail[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SlotDetail | null>(null);
  const [availableRanges, setAvailableRanges] = useState<Array<{start: string, end: string}>>([]);
  
  // Selected Time Range
  const [selectedStartTime, setSelectedStartTime] = useState<string>('');
  const [selectedEndTime, setSelectedEndTime] = useState<string>('');

  // Patient details
  const [patientType, setPatientType] = useState<'self' | 'family'>('self');
  const [selectedFamilyMemberId, setSelectedFamilyMemberId] = useState<string>('');
  const [showAddFamilyModal, setShowAddFamilyModal] = useState(false);
  const [newFamilyName, setNewFamilyName] = useState('');
  const [newFamilyPhone, setNewFamilyPhone] = useState('');
  const [newFamilyRelation, setNewFamilyRelation] = useState('');
  const [savingFamily, setSavingFamily] = useState(false);

  // Address Details
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [showAddAddressModal, setShowAddAddressModal] = useState(false);
  const [newAddressLabel, setNewAddressLabel] = useState('');
  const [newAddressText, setNewAddressText] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);

  // General Booking Details
  const [priority, setPriority] = useState<'routine' | 'urgent' | 'emergency'>('routine');
  const [symptoms, setSymptoms] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successBooking, setSuccessBooking] = useState<any | null>(null);

  // Load Doctor Details
  useEffect(() => {
    const fetchDoctor = async () => {
      try {
        setLoadingDoctor(true);
        const response = await apiClient.get(`/api/doctors/${doctorId}`);
        if (response.data.success && response.data.data) {
          const docData = response.data.data;
          const doc = docData.doctor || docData;
          setDoctor({
            id: doc.id,
            firstName: doc.firstName || '',
            lastName: doc.lastName || '',
            bio: doc.bio,
            medicalLicenseNumber: doc.medicalLicenseNumber,
            yearsOfExperience: doc.yearsOfExperience || 0,
            photoUrl: doc.profilePhotoId ? `/api/files/${doc.profilePhotoId}` : null,
            specialties: docData.specialties || doc.specialties || [],
          });
        }
      } catch (err) {
        console.error('Error fetching doctor details:', err);
      } finally {
        setLoadingDoctor(false);
      }
    };

    if (doctorId) {
      fetchDoctor();
    }
  }, [doctorId]);

  // Fetch Patient profile data: Addresses & Family Members
  const loadAddresses = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/patients/addresses');
      if (res.data.success && res.data.data) {
        setAddresses(res.data.data);
        const defaultAddr = res.data.data.find((a: SavedAddress) => a.isDefault);
        if (defaultAddr) {
          setSelectedAddressId(defaultAddr.id);
        } else if (res.data.data.length > 0) {
          setSelectedAddressId(res.data.data[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching addresses:', err);
    }
  }, []);

  const loadFamilyMembers = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/patients/family-members');
      if (res.data.success && res.data.data) {
        setFamilyMembers(res.data.data);
        if (res.data.data.length > 0) {
          setSelectedFamilyMemberId(res.data.data[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching family members:', err);
    }
  }, []);

  useEffect(() => {
    loadAddresses();
    loadFamilyMembers();
  }, [loadAddresses, loadFamilyMembers]);

  // Fetch Available Slots for Date
  useEffect(() => {
    const fetchSlots = async () => {
      if (!selectedDate || !doctorId) return;
      try {
        setLoadingSlots(true);
        setSelectedSlot(null);
        setSelectedStartTime('');
        setSelectedEndTime('');
        setAvailableRanges([]);

        const response = await apiClient.get(`/api/doctors/${doctorId}/availability`, {
          params: {
            date: selectedDate,
            type: 'home_visit',
          },
        });

        if (response.data.success && response.data.data) {
          setSlots(response.data.data);
          if (response.data.data.length > 0) {
            setSelectedSlot(response.data.data[0]);
          }
        }
      } catch (err) {
        console.error('Error fetching slots:', err);
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchSlots();
  }, [selectedDate, doctorId]);

  // Calculate available ranges within the selected parent slot
  useEffect(() => {
    if (!selectedSlot || !selectedSlot.parentSlot) {
      setAvailableRanges([]);
      return;
    }

    const parentStart = selectedSlot.parentSlot.start;
    const parentEnd = selectedSlot.parentSlot.end;
    const booked = selectedSlot.bookedSubslots || [];

    const parseTime = (timeStr: string): number => {
      const parts = timeStr.split(':');
      const hours = parseInt(parts[0], 10) || 0;
      const minutes = parseInt(parts[1], 10) || 0;
      return hours * 60 + minutes;
    };

    const formatTime = (minutes: number): string => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    };

    const parentStartMinutes = parseTime(parentStart);
    const parentEndMinutes = parseTime(parentEnd);

    const bookedRanges = booked
      .map(subSlot => ({
        start: parseTime(subSlot.start),
        end: parseTime(subSlot.end)
      }))
      .sort((a, b) => a.start - b.start);

    const available: Array<{start: string, end: string}> = [];
    let currentStart = parentStartMinutes;

    for (const bookedRange of bookedRanges) {
      if (currentStart < bookedRange.start) {
        available.push({
          start: formatTime(currentStart),
          end: formatTime(bookedRange.start)
        });
      }
      currentStart = Math.max(currentStart, bookedRange.end);
    }

    if (currentStart < parentEndMinutes) {
      available.push({
        start: formatTime(currentStart),
        end: formatTime(parentEndMinutes)
      });
    }

    setAvailableRanges(available);
    setSelectedStartTime('');
    setSelectedEndTime('');
  }, [selectedSlot]);

  // Helper to parse/format times
  const formatTimeDisplay = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hr = parseInt(hours, 10);
    const ampm = hr >= 12 ? 'PM' : 'AM';
    const displayHr = hr % 12 || 12;
    return `${displayHr}:${minutes} ${ampm}`;
  };

  // Add Family Member inline
  const handleAddFamilyMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFamilyName || !newFamilyPhone || !newFamilyRelation) return;
    try {
      setSavingFamily(true);
      const response = await apiClient.post('/api/patients/family-members', {
        fullName: newFamilyName,
        phone: newFamilyPhone,
        relationship: newFamilyRelation,
      });

      if (response.data.success && response.data.data) {
        const created = response.data.data;
        setFamilyMembers(prev => [created, ...prev]);
        setSelectedFamilyMemberId(created.id);
        setShowAddFamilyModal(false);
        setNewFamilyName('');
        setNewFamilyPhone('');
        setNewFamilyRelation('');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save family member');
    } finally {
      setSavingFamily(false);
    }
  };

  // Add Address inline
  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddressLabel || !newAddressText) return;
    try {
      setSavingAddress(true);
      const response = await apiClient.post('/api/patients/addresses', {
        label: newAddressLabel,
        addressText: newAddressText,
        latitude: 19.076, // Mock default coordinates
        longitude: 72.877,
        isDefault: addresses.length === 0,
      });

      if (response.data.success && response.data.data) {
        const created = response.data.data;
        setAddresses(prev => [created, ...prev]);
        setSelectedAddressId(created.id);
        setShowAddAddressModal(false);
        setNewAddressLabel('');
        setNewAddressText('');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save address');
    } finally {
      setSavingAddress(false);
    }
  };

  // Handle Form Submission
  const handleBookHomeVisit = async () => {
    if (!selectedSlot || !selectedStartTime || !selectedEndTime) {
      setSubmitError('Please select a date and time slot.');
      return;
    }
    if (!selectedAddressId) {
      setSubmitError('Please select a home visit address.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const requestBody = {
        doctorId,
        parentSlotId: selectedSlot.parentSlot.id,
        startTime: selectedStartTime,
        endTime: selectedEndTime,
        priority,
        patientAddressId: selectedAddressId,
        patientFamilyMemberId: patientType === 'family' && selectedFamilyMemberId ? selectedFamilyMemberId : undefined,
        symptoms: symptoms || undefined,
      };

      const response = await apiClient.post('/api/bookings/home-visit', requestBody);

      if (response.data.success) {
        setSuccessBooking(response.data.data);
      } else {
        setSubmitError(response.data.message || 'Failed to create booking.');
      }
    } catch (err: any) {
      console.error('Error creating home visit:', err);
      setSubmitError(
        err.response?.data?.message || 'An error occurred during booking. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingDoctor) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Loading booking options...</p>
        </div>
      </div>
    );
  }

  if (successBooking) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-xl text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900">Booking Requested!</h2>
            <p className="text-sm text-slate-500">
              Your request for a doctor home visit has been sent successfully and is awaiting doctor confirmation.
            </p>
          </div>

          {doctor && (
            <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-3 text-left">
              <Avatar className="w-12 h-12">
                <AvatarImage src={doctor.photoUrl || undefined} />
                <AvatarFallback className="bg-blue-600 text-white font-bold">
                  {doctor.firstName[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-bold text-slate-900">Dr. {doctor.firstName} {doctor.lastName}</p>
                <p className="text-xs text-slate-500">{doctor.specialties.map(s => s.name).join(', ')}</p>
              </div>
            </div>
          )}

          <div className="border-t border-slate-100 pt-4 text-left text-xs text-slate-500 space-y-2">
            <div className="flex justify-between">
              <span>Scheduled Date:</span>
              <span className="font-bold text-slate-800">{selectedDate}</span>
            </div>
            <div className="flex justify-between">
              <span>Time Window:</span>
              <span className="font-bold text-slate-800">
                {formatTimeDisplay(selectedStartTime)} - {formatTimeDisplay(selectedEndTime)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Booking ID:</span>
              <span className="font-mono text-slate-800">{successBooking.id}</span>
            </div>
          </div>

          <Button
            onClick={() => router.push('/patient/dashboard')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-6 rounded-2xl shadow-lg shadow-blue-500/25 transition-all"
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-16">
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label="Go back"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Book Home Visit</h1>
              <p className="text-xs text-slate-500">Request a home consultation</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Form Side */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Step 1: Date and Slots */}
            <section className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-blue-600" />
                Select Date & Time
              </h2>
              
              <div className="space-y-2">
                <Label htmlFor="date-input" className="text-xs font-semibold text-slate-500">
                  Appointment Date
                </Label>
                <Input
                  id="date-input"
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-slate-50/50 border-slate-200 focus-visible:ring-2 focus-visible:ring-blue-600"
                />
              </div>

              {loadingSlots ? (
                <div className="flex items-center justify-center py-6 text-sm text-slate-500 gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  Checking doctor availability...
                </div>
              ) : slots.length === 0 ? (
                <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-4 flex gap-3 text-amber-800 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <p>
                    No home-visit slots are configured by the doctor on this day. Please select another date.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <Label className="text-xs font-semibold text-slate-500">
                    Available Windows
                  </Label>
                  <div className="grid grid-cols-1 gap-2">
                    {slots.map((slot) => (
                      <button
                        key={slot.parentSlot.id}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`p-4 border rounded-xl text-left transition-all ${
                          selectedSlot?.parentSlot.id === slot.parentSlot.id
                            ? 'border-blue-600 bg-blue-50/40 text-blue-900 shadow-sm'
                            : 'border-slate-200 hover:border-slate-300 bg-slate-50/30'
                        }`}
                      >
                        <p className="text-sm font-bold">
                          {formatTimeDisplay(slot.parentSlot.start)} - {formatTimeDisplay(slot.parentSlot.end)}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Doctor Availability Session
                        </p>
                      </button>
                    ))}
                  </div>

                  {selectedSlot && availableRanges.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <Label className="text-xs font-bold text-slate-900">
                        Choose Exact Booking Window
                      </Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="start-time" className="text-[10px] uppercase font-bold text-slate-400">
                            Start Time
                          </Label>
                          <select
                            id="start-time"
                            value={selectedStartTime}
                            onChange={(e) => {
                              setSelectedStartTime(e.target.value);
                              // Auto-calculate end time 1 hour later
                              if (e.target.value) {
                                const [h, m] = e.target.value.split(':').map(Number);
                                const endMin = m + 60;
                                const endHour = h + Math.floor(endMin / 60);
                                setSelectedEndTime(
                                  `${String(endHour % 24).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`
                                );
                              }
                            }}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all cursor-pointer"
                          >
                            <option value="">Select</option>
                            {availableRanges.flatMap((range, index) => {
                              const parseMin = (t: string) => {
                                const [h, m] = t.split(':').map(Number);
                                return h * 60 + m;
                              };
                              const fmt = (min: number) => {
                                const h = Math.floor(min / 60);
                                const m = min % 60;
                                return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                              };
                              const start = parseMin(range.start);
                              const end = parseMin(range.end);
                              const opts = [];
                              for (let t = start; t <= end - 60; t += 30) {
                                opts.push(fmt(t));
                              }
                              return opts.map(opt => (
                                <option key={`${index}-${opt}`} value={opt}>
                                  {formatTimeDisplay(opt)}
                                </option>
                              ));
                            })}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor="end-time" className="text-[10px] uppercase font-bold text-slate-400">
                            End Time
                          </Label>
                          <select
                            id="end-time"
                            value={selectedEndTime}
                            onChange={(e) => setSelectedEndTime(e.target.value)}
                            disabled={!selectedStartTime}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <option value="">Select</option>
                            {selectedStartTime && availableRanges.flatMap((range, index) => {
                              const parseMin = (t: string) => {
                                const [h, m] = t.split(':').map(Number);
                                return h * 60 + m;
                              };
                              const fmt = (min: number) => {
                                const h = Math.floor(min / 60);
                                const m = min % 60;
                                return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                              };
                              const startMin = parseMin(selectedStartTime);
                              const endMin = parseMin(range.end);
                              const opts = [];
                              // Custom home-visits are minimum 30 minutes, default 60 minutes
                              for (let t = startMin + 30; t <= endMin; t += 30) {
                                opts.push(fmt(t));
                              }
                              return opts.map(opt => (
                                <option key={`${index}-${opt}`} value={opt}>
                                  {formatTimeDisplay(opt)}
                                </option>
                              ));
                            })}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Step 2: Recipient Selection */}
            <section className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                Who is the Appointment For?
              </h2>

              <RadioGroup
                value={patientType}
                onValueChange={(val: 'self' | 'family') => setPatientType(val)}
                className="grid grid-cols-2 gap-3"
              >
                <label
                  className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all ${
                    patientType === 'self'
                      ? 'border-blue-600 bg-blue-50/40 text-blue-900 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <RadioGroupItem value="self" className="text-blue-600" />
                  <div>
                    <p className="text-sm font-bold">Myself</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Book for your profile</p>
                  </div>
                </label>

                <label
                  className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all ${
                    patientType === 'family'
                      ? 'border-blue-600 bg-blue-50/40 text-blue-900 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <RadioGroupItem value="family" className="text-blue-600" />
                  <div>
                    <p className="text-sm font-bold">Family Member</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Book for relative</p>
                  </div>
                </label>
              </RadioGroup>

              {patientType === 'family' && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-500">
                      Select Saved Member
                    </Label>
                    <button
                      type="button"
                      onClick={() => setShowAddFamilyModal(true)}
                      className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:text-blue-700 transition-colors"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Add Member
                    </button>
                  </div>

                  {familyMembers.length === 0 ? (
                    <div className="text-center py-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                      <p className="text-xs text-slate-500">No family members saved yet.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {familyMembers.map((member) => (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => setSelectedFamilyMemberId(member.id)}
                          className={`p-3 border rounded-xl text-left transition-all ${
                            selectedFamilyMemberId === member.id
                              ? 'border-blue-600 bg-blue-50/20 text-blue-900'
                              : 'border-slate-200 hover:border-slate-300 bg-slate-50/20'
                          }`}
                        >
                          <p className="text-sm font-bold">{member.fullName}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {member.relationship} • {member.phone}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Step 3: Address & Priority */}
            <section className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  Home Visit Address
                </h2>
                <button
                  type="button"
                  onClick={() => setShowAddAddressModal(true)}
                  className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:text-blue-700 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Address
                </button>
              </div>

              {addresses.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-2">
                  <p className="text-xs text-slate-500">No addresses saved to your profile yet.</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddAddressModal(true)}
                    className="h-8 text-xs font-bold"
                  >
                    Add Now
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {addresses.map((address) => (
                    <button
                      key={address.id}
                      type="button"
                      onClick={() => setSelectedAddressId(address.id)}
                      className={`p-4 border rounded-xl text-left transition-all flex items-start gap-3 ${
                        selectedAddressId === address.id
                          ? 'border-blue-600 bg-blue-50/20 text-blue-900'
                          : 'border-slate-200 hover:border-slate-300 bg-slate-50/20'
                      }`}
                    >
                      <MapPin className="w-5 h-5 mt-0.5 text-slate-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-900">{address.label}</p>
                          {address.isDefault && (
                            <Badge className="bg-slate-100 text-slate-700 text-[9px] px-1.5 py-0">Default</Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{address.addressText}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-2 pt-2">
                <Label className="text-xs font-semibold text-slate-500">
                  Priority Level
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {(['routine', 'urgent', 'emergency'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`py-2 px-3 border rounded-xl text-xs font-bold capitalize transition-all ${
                        priority === p
                          ? p === 'emergency'
                            ? 'border-red-600 bg-red-50 text-red-700 shadow-sm'
                            : p === 'urgent'
                            ? 'border-amber-600 bg-amber-50 text-amber-700 shadow-sm'
                            : 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 bg-slate-50/20 text-slate-600'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                {priority === 'emergency' && (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex gap-2 text-red-800 text-[10px]">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                    <p>
                      Emergency priority home visits have an expiry configuration of 1 hour. If the doctor does not accept within 1 hour, it will automatically expire.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-2">
                <Label htmlFor="symptoms-input" className="text-xs font-semibold text-slate-500">
                  Symptoms & Reason for Visit
                </Label>
                <Textarea
                  id="symptoms-input"
                  rows={4}
                  placeholder="Describe symptoms, duration, or special requirements for the doctor..."
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  className="bg-slate-50/50 border-slate-200 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:border-transparent resize-none"
                />
              </div>
            </section>
          </div>

          {/* Right Side Info & Confirmation */}
          <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-24">
            {doctor && (
              <section className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 text-white shadow-xl space-y-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full translate-x-8 -translate-y-8" />
                
                <div className="flex items-center gap-4">
                  <Avatar className="w-16 h-16 border-2 border-white/20 shadow-md">
                    <AvatarImage src={doctor.photoUrl || undefined} />
                    <AvatarFallback className="bg-white text-blue-700 font-bold text-lg">
                      {doctor.firstName?.[0] || 'D'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-lg font-bold">Dr. {doctor.firstName} {doctor.lastName}</h3>
                    <p className="text-xs text-blue-100 flex items-center gap-1 mt-0.5">
                      <Stethoscope className="w-3.5 h-3.5" />
                      {doctor.specialties.map(s => s.name).join(', ')}
                    </p>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-4 space-y-3 text-xs">
                  <div className="flex justify-between text-blue-100">
                    <span>Experience:</span>
                    <span className="font-bold text-white">{doctor.yearsOfExperience} Years</span>
                  </div>
                  <div className="flex justify-between text-blue-100">
                    <span>License No:</span>
                    <span className="font-bold text-white">{doctor.medicalLicenseNumber}</span>
                  </div>
                </div>

                {selectedStartTime && selectedEndTime && (
                  <div className="bg-white/10 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-blue-50">
                      <Clock className="w-4 h-4" />
                      Booking Summary
                    </div>
                    <p className="text-sm font-bold">{selectedDate}</p>
                    <p className="text-xs text-blue-100">
                      {formatTimeDisplay(selectedStartTime)} - {formatTimeDisplay(selectedEndTime)}
                    </p>
                  </div>
                )}

                {submitError && (
                  <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-100">
                    <AlertCircle className="w-4 h-4 text-red-200" />
                    <AlertDescription className="text-xs">{submitError}</AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={handleBookHomeVisit}
                  disabled={submitting || !selectedStartTime || !selectedAddressId}
                  className="w-full bg-white hover:bg-slate-50 text-blue-700 font-bold py-6 rounded-2xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    'Confirm Home Visit Request'
                  )}
                </Button>
              </section>
            )}
          </div>
        </div>
      </main>

      {/* Add Family Member Modal (Inline) */}
      {showAddFamilyModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleAddFamilyMember}
            className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-6 w-full max-w-md space-y-4"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">Add Family Member</h3>
              <button
                type="button"
                onClick={() => setShowAddFamilyModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                Cancel
              </button>
            </div>
            
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="fm-name">Full Name</Label>
                <Input
                  id="fm-name"
                  required
                  placeholder="e.g. John Doe Jr."
                  value={newFamilyName}
                  onChange={(e) => setNewFamilyName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="fm-phone">Phone Number</Label>
                <Input
                  id="fm-phone"
                  required
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={newFamilyPhone}
                  onChange={(e) => setNewFamilyPhone(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="fm-relation">Relationship</Label>
                <Input
                  id="fm-relation"
                  required
                  placeholder="e.g. Son, Spouse, Parent"
                  value={newFamilyRelation}
                  onChange={(e) => setNewFamilyRelation(e.target.value)}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={savingFamily}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-5 rounded-2xl"
            >
              {savingFamily ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Save & Select'}
            </Button>
          </form>
        </div>
      )}

      {/* Add Address Modal (Inline) */}
      {showAddAddressModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleAddAddress}
            className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-6 w-full max-w-md space-y-4"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">Add Saved Address</h3>
              <button
                type="button"
                onClick={() => setShowAddAddressModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                Cancel
              </button>
            </div>
            
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="addr-label">Label</Label>
                <Input
                  id="addr-label"
                  required
                  placeholder="e.g. Home, Work, Parents"
                  value={newAddressLabel}
                  onChange={(e) => setNewAddressLabel(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="addr-text">Address Text</Label>
                <Textarea
                  id="addr-text"
                  required
                  rows={3}
                  placeholder="e.g. Room 102, Building A, Linking Road, Bandra West, Mumbai"
                  value={newAddressText}
                  onChange={(e) => setNewAddressText(e.target.value)}
                  className="resize-none"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={savingAddress}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-5 rounded-2xl"
            >
              {savingAddress ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Save & Select'}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
