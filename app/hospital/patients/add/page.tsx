'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

export default function AddPatientPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: '',
    contactNumber: '',
    emergencyContact: '',
    admissionDate: '',
    medicalCondition: '',
    roomType: 'general',
    additionalNotes: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hospitalId, setHospitalId] = useState<string | null>(null);

  useEffect(() => {
    fetchHospitalProfile();
  }, []);

  const fetchHospitalProfile = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/login');
        return;
      }
      const response = await fetch('/api/hospitals/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success && data.data) {
        setHospitalId(data.data.id);
      } else {
        setError('Failed to load hospital profile');
      }
    } catch (err) {
      console.error('Error fetching hospital profile:', err);
      setError('Failed to load hospital profile');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (loading) return; // Prevent double-click
    
    if (!hospitalId) {
      setError('Hospital ID not found. Please try again.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('accessToken');

      // Calculate cost per day based on room type
      const costPerDayMap: Record<string, number> = {
        'general': 5000,
        'semi_private': 10000,
        'private': 15000,
        'icu': 20000,
        'emergency': 12000,
      };

      // Calculate date of birth from age
      const today = new Date();
      const birthYear = today.getFullYear() - parseInt(formData.age);
      const dateOfBirth = new Date(birthYear, today.getMonth(), today.getDate()).toISOString().split('T')[0];

      const requestBody = {
        fullName: formData.name,
        dateOfBirth: dateOfBirth,
        gender: formData.gender,
        phone: formData.contactNumber,
        emergencyContact: formData.emergencyContact || null,
        address: null,
        condition: formData.medicalCondition,
        medicalCondition: formData.medicalCondition,
        roomType: formData.roomType,
        costPerDay: costPerDayMap[formData.roomType] || 5000,
        medicalNotes: formData.additionalNotes || null,
      };

      const response = await fetch(`/api/hospitals/${hospitalId}/patients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (data.success) {
        router.push('/hospital/patients');
      } else {
        // Show specific error message for limit reached
        // API now provides detailed messages with usage and reset dates
        const errorMessage = data.message || 'Failed to create patient. Please try again.';
        setError(errorMessage);
      }
    } catch (err) {
      console.error('Error creating patient:', err);
      setError('Failed to create patient. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">DocSchedule</h1>
        <Link href="/hospital/dashboard" className="text-white">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Link>
      </div>

      {/* Form */}
      <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Add New Patient</h2>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Patient Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="John Smith"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Age <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gender <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    required
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                  >
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <input
                    type="tel"
                    required
                    value={formData.contactNumber}
                    onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                    placeholder="+91 9876543210"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Emergency Contact
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <input
                    type="tel"
                    value={formData.emergencyContact}
                    onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                    placeholder="+91 9876543210"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Admission Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <input
                    type="date"
                    required
                    value={formData.admissionDate}
                    onChange={(e) => setFormData({ ...formData, admissionDate: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Medical Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Medical Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Medical Condition <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.medicalCondition}
                  onChange={(e) => setFormData({ ...formData, medicalCondition: e.target.value })}
                  placeholder="e.g., Cardiac Evaluation, Post-Sur.."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Room Type <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'general', label: 'General', price: '₹5,000/day' },
                    { value: 'semi_private', label: 'Semi-Private', price: '₹10,000/day' },
                    { value: 'private', label: 'Private', price: '₹15,000/day' },
                    { value: 'icu', label: 'ICU', price: '₹20,000/day' },
                    { value: 'emergency', label: 'Emergency', price: '₹12,000/day' },
                  ].map((room) => (
                    <button
                      key={room.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, roomType: room.value })}
                      className={`p-4 border-2 rounded-lg text-left ${
                        formData.roomType === room.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200'
                      }`}
                    >
                      <div className="font-semibold text-gray-900">{room.label}</div>
                      <div className="text-sm text-gray-600 mt-1">{room.price}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Additional Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes
            </label>
            <textarea
              value={formData.additionalNotes}
              onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
              placeholder="Any additional medical history or special requirements..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Link
              href="/hospital/dashboard"
              className="flex-1 bg-white border-2 border-gray-300 text-gray-700 py-3 rounded-lg font-semibold text-center"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading || !hospitalId}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Patient...
                </>
              ) : (
                'Add Patient'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}













