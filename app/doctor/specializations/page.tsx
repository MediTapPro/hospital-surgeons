'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { isAuthenticated } from '@/lib/auth/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';

interface Specialty {
  id: string;
  name: string;
}

interface DoctorSpecialty {
  id: string;
  specialtyId: string;
  specialtyName: string;
  addedAt?: string;
  createdAt?: string;
}

export default function SpecializationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [availableSpecialties, setAvailableSpecialties] = useState<Specialty[]>([]);
  const [doctorSpecialties, setDoctorSpecialties] = useState<DoctorSpecialty[]>([]);
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<string>('');

  useEffect(() => {
    if (isAuthenticated()) {
      fetchDoctorProfile();
    } else {
      router.push('/login');
    }
  }, []);

  useEffect(() => {
    if (doctorId) {
      fetchSpecialties();
      fetchDoctorSpecialties();
    }
  }, [doctorId]);

  const fetchDoctorProfile = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/doctors/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (response.status === 404 || !result.success) {
        setError('Please complete your profile first before managing specializations.');
        setLoading(false);
        return;
      }
      if (result.success && result.data) {
        setDoctorId(result.data.id);
      } else {
        setError('Failed to load doctor profile');
        setLoading(false);
      }
    } catch (err) {
      console.error('Error fetching doctor profile:', err);
      setError('Failed to load doctor profile');
      setLoading(false);
    }
  };

  const fetchSpecialties = async () => {
    try {
      const response = await fetch('/api/specialties/active');
      const result = await response.json();
      if (result.success && result.data) {
        setAvailableSpecialties(result.data);
      }
    } catch (err) {
      console.error('Error fetching specialties:', err);
    }
  };

  const fetchDoctorSpecialties = async () => {
    if (!doctorId) return;
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/doctors/${doctorId}/specialties`);
      const result = await response.json();
      if (result.success && result.data) {
        // API returns array with { doctorSpecialty, specialty } structure
        const formattedSpecialties = result.data.map((item: any) => ({
          id: item.doctorSpecialty?.id || item.id,
          specialtyId: item.doctorSpecialty?.specialtyId || item.specialtyId || item.specialty?.id,
          specialtyName: item.specialty?.name || item.specialtyName || item.name,
          addedAt: item.doctorSpecialty?.createdAt || item.createdAt || item.addedAt,
        }));
        setDoctorSpecialties(formattedSpecialties);
      } else {
        setDoctorSpecialties([]);
      }
    } catch (err) {
      console.error('Error fetching doctor specialties:', err);
      setError('Failed to load specializations');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSpecialty = async () => {
    if (!doctorId || !selectedSpecialtyId) {
      setError('Please select a specialty');
      return;
    }

    // Check if already added
    if (doctorSpecialties.some(s => s.specialtyId === selectedSpecialtyId)) {
      setError('This specialty is already added');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch(`/api/doctors/${doctorId}/specialties`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          specialtyId: selectedSpecialtyId,
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setSelectedSpecialtyId('');
        fetchDoctorSpecialties(); // Refresh the list
      } else {
        setError(result.message || 'Failed to add specialty');
      }
    } catch (err) {
      console.error('Error adding specialty:', err);
      setError('Failed to add specialty');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveSpecialty = async (specialtyId: string) => {
    if (!doctorId || removingId) return;
    
    if (!window.confirm('Are you sure you want to remove this specialization?')) {
      return;
    }

    try {
      setRemovingId(specialtyId);
      setError(null);
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch(`/api/doctors/${doctorId}/specialties/${specialtyId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();
      
      if (result.success) {
        fetchDoctorSpecialties(); // Refresh the list
      } else {
        setError(result.message || 'Failed to remove specialty');
      }
    } catch (err) {
      console.error('Error removing specialty:', err);
      setError('Failed to remove specialty');
    } finally {
      setRemovingId(null);
    }
  };

  // Get specialties that are not yet added
  const availableToAdd = availableSpecialties.filter(
    specialty => !doctorSpecialties.some(ds => ds.specialtyId === specialty.id)
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading specializations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-gray-900 mb-2 text-2xl font-bold">Specializations</h1>
        <p className="text-gray-600">Manage your medical specializations</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Add Specialization */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-gray-900 mb-4 font-semibold">Add Specialization</h3>
        <div className="flex gap-3">
          <Select value={selectedSpecialtyId} onValueChange={setSelectedSpecialtyId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select a specialty" />
            </SelectTrigger>
            <SelectContent>
              {availableToAdd.length === 0 ? (
                <SelectItem value="no-specialties" disabled>No available specialties</SelectItem>
              ) : (
                availableToAdd.map((specialty) => (
                  <SelectItem key={specialty.id} value={specialty.id}>
                    {specialty.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <button
            onClick={handleAddSpecialty}
            disabled={!selectedSpecialtyId || saving || availableToAdd.length === 0}
            className="px-6 py-2 bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-lg flex items-center gap-2 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Add
              </>
            )}
          </button>
        </div>
      </div>

      {/* Current Specializations */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-gray-900 mb-4 font-semibold">Your Specializations</h3>
        {doctorSpecialties.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p>No specializations added yet</p>
            <p className="text-sm mt-1">Add your first specialization above</p>
          </div>
        ) : (
          <div className="space-y-3">
            {doctorSpecialties.map((specialty) => (
              <div
                key={specialty.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <h4 className="text-gray-900 font-medium">{specialty.specialtyName}</h4>
                    {specialty.addedAt && (
                      <p className="text-sm text-gray-500">
                        Added on {new Date(specialty.addedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveSpecialty(specialty.specialtyId)}
                  disabled={removingId === specialty.specialtyId}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Remove specialization"
                >
                  {removingId === specialty.specialtyId ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


