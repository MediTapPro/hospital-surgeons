'use client';

import { X, Calendar, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import apiClient from '@/lib/api/httpClient';

interface TimeSlot {
  id: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  notes?: string | null;
}

interface AddSlotModalProps {
  doctorId: string;
  onClose: () => void;
  onSuccess?: () => void;
  editingSlot?: TimeSlot | null;
}

export function AddSlotModal({ doctorId, onClose, onSuccess, editingSlot }: AddSlotModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    slotDate: '',
    startTime: '',
    endTime: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Prefill form when editing
  useEffect(() => {
    if (editingSlot) {
      setFormData({
        slotDate: editingSlot.slotDate,
        startTime: editingSlot.startTime,
        endTime: editingSlot.endTime,
        notes: editingSlot.notes || '',
      });
    } else {
      // Reset form when not editing
      setFormData({
        slotDate: '',
        startTime: '',
        endTime: '',
        notes: '',
      });
    }
  }, [editingSlot]);

  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 6; hour <= 22; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time24 = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const hour12 = hour % 12 || 12;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const time12 = `${hour12}:${minute.toString().padStart(2, '0')} ${ampm}`;
        options.push({ value: time24, label: time12 });
      }
    }
    return options;
  };

  const timeOptions = generateTimeOptions();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (loading) return; // Prevent double-click
    
    setErrors({});

    // Validation
    const newErrors: Record<string, string> = {};
    if (!formData.slotDate) newErrors.slotDate = 'Date is required';
    if (!formData.startTime) newErrors.startTime = 'Start time is required';
    if (!formData.endTime) newErrors.endTime = 'End time is required';
    
    if (formData.startTime && formData.endTime) {
      const start = new Date(`2000-01-01 ${formData.startTime}`);
      const end = new Date(`2000-01-01 ${formData.endTime}`);
      if (end <= start) {
        newErrors.endTime = 'End time must be after start time';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setLoading(true);
      
      if (editingSlot) {
        // Update existing slot
        const response = await apiClient.patch(`/api/doctors/availability/${editingSlot.id}`, {
          slotDate: formData.slotDate,
          startTime: formData.startTime,
          endTime: formData.endTime,
          notes: formData.notes || null,
          status: 'available',
        });

        const data = response.data;

        if (data.success) {
          onSuccess?.();
          onClose();
        } else {
          setErrors({ submit: data.message || 'Failed to update slot' });
        }
      } else {
        // Create new slot
        const response = await apiClient.post(`/api/doctors/${doctorId}/availability`, {
          slotDate: formData.slotDate,
          startTime: formData.startTime,
          endTime: formData.endTime,
          notes: formData.notes || null,
          status: 'available',
          isManual: true,
        });

        const data = response.data;

        if (data.success) {
          onSuccess?.();
          onClose();
        } else {
          setErrors({ submit: data.message || 'Failed to create slot' });
        }
      }
    } catch (err) {
      console.error(`Error ${editingSlot ? 'updating' : 'creating'} slot:`, err);
      setErrors({ submit: `Failed to ${editingSlot ? 'update' : 'create'} slot. Please try again.` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-gray-900 font-semibold">{editingSlot ? 'Edit Availability Slot' : 'Add Availability Slot'}</h2>
          <button 
            onClick={onClose}
            disabled={loading}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {/* Date */}
            <div>
              <label className="block text-sm text-gray-700 mb-2 font-medium">
                Date <span className="text-[#EF4444]">*</span>
              </label>
              <div className="relative">
                <input 
                  type="date"
                  value={formData.slotDate || ''}
                  onChange={(e) => setFormData({ ...formData, slotDate: e.target.value })}
                  min={(() => {
                    // Get today's date in local timezone (not UTC) to avoid date shifts
                    const today = new Date();
                    const year = today.getFullYear();
                    const month = String(today.getMonth() + 1).padStart(2, '0');
                    const day = String(today.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                  })()}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC] pr-10 ${
                    errors.slotDate ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              {errors.slotDate && (
                <p className="text-red-600 text-xs mt-1">{errors.slotDate}</p>
              )}
            </div>

            {/* Time Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-700 mb-2 font-medium">
                  Start Time <span className="text-[#EF4444]">*</span>
                </label>
                <select 
                  value={formData.startTime || ''}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC] ${
                    errors.startTime ? 'border-red-300' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select start time</option>
                  {timeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {errors.startTime && (
                  <p className="text-red-600 text-xs mt-1">{errors.startTime}</p>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-2 font-medium">
                  End Time <span className="text-[#EF4444]">*</span>
                </label>
                <select 
                  value={formData.endTime || ''}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC] ${
                    errors.endTime ? 'border-red-300' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select end time</option>
                  {timeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {errors.endTime && (
                  <p className="text-red-600 text-xs mt-1">{errors.endTime}</p>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm text-gray-700 mb-2 font-medium">
                Notes (Optional)
              </label>
              <textarea 
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Special consultation day..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC] resize-none"
              />
            </div>

            {/* Error Message */}
            {errors.submit && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                {errors.submit}
              </div>
            )}

            {/* Warning */}
            <div className="bg-[#FEF3C7] border border-[#F59E0B] rounded-lg p-3 flex gap-2">
              <span className="text-[#F59E0B]">⚠️</span>
              <span className="text-sm text-gray-700">This will create one-time slot</span>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 flex gap-3 justify-end">
            <button 
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-[#0066CC] hover:bg-[#0052a3] text-white rounded-lg transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? (editingSlot ? 'Updating...' : 'Saving...') : (editingSlot ? 'Update Slot' : 'Save Slot')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


