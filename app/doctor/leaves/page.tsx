'use client';

import { useState, useEffect } from 'react';
import { Plus, Calendar, Trash2, Edit2, Loader2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth/utils';
import apiClient from '@/lib/api/httpClient';
import type { AxiosError } from 'axios';

interface Leave {
  id: string;
  leaveType: 'sick' | 'vacation' | 'personal' | 'emergency' | 'other';
  startDate: string;
  endDate: string;
  reason?: string | null;
  createdAt: string;
}

export default function LeavesTimeOffPage() {
  const router = useRouter();
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingLeave, setEditingLeave] = useState<Leave | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    leaveType: 'vacation' as 'sick' | 'vacation' | 'personal' | 'emergency' | 'other',
    reason: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    fetchDoctorProfile();
  }, []);

  useEffect(() => {
    if (doctorId) {
      fetchLeaves();
    }
  }, [doctorId]);

  const fetchDoctorProfile = async () => {
    try {
      const response = await apiClient.get('/api/doctors/profile');
      const data = response.data;
      
      if (data.success && data.data?.id) {
        setDoctorId(data.data.id);
      } else {
        setLoading(false);
      }
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status !== 404) {
        console.error('Error fetching doctor profile:', error);
      }
      setLoading(false);
    }
  };

  const fetchLeaves = async () => {
    if (!doctorId) return;
    try {
      setLoading(true);
      const response = await apiClient.get(`/api/doctors/${doctorId}/unavailability`);
      const data = response.data;
      
      if (data.success && data.data) {
        setLeaves(Array.isArray(data.data) ? data.data : []);
      }
    } catch (error) {
      console.error('Error fetching leaves:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSubmitting(true);

    // Validation
    const newErrors: Record<string, string> = {};
    if (!formData.startDate) newErrors.startDate = 'Start date is required';
    if (!formData.endDate) newErrors.endDate = 'End date is required';
    
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      if (end < start) {
        newErrors.endDate = 'End date must be after start date';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setSubmitting(false);
      return;
    }

    try {
      if (!doctorId) return;

      if (editingLeave) {
        // Update existing leave
        const response = await apiClient.patch(
          `/api/doctors/unavailability/${editingLeave.id}`,
          {
            startDate: formData.startDate,
            endDate: formData.endDate,
            leaveType: formData.leaveType,
            reason: formData.reason || null,
          }
        );
        
        if (response.data.success) {
          await fetchLeaves();
          handleCloseModal();
        } else {
          setErrors({ submit: response.data.message || 'Failed to update leave' });
        }
      } else {
        // Create new leave
        const response = await apiClient.post(`/api/doctors/${doctorId}/unavailability`, {
          startDate: formData.startDate,
          endDate: formData.endDate,
          leaveType: formData.leaveType,
          reason: formData.reason || null,
        });
        
        if (response.data.success) {
          await fetchLeaves();
          handleCloseModal();
        } else {
          setErrors({ submit: response.data.message || 'Failed to create leave' });
        }
      }
    } catch (error) {
      console.error('Error saving leave:', error);
      setErrors({ submit: 'Failed to save leave. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this leave?')) return;
    
    try {
      setDeletingId(id);
      const response = await apiClient.delete(`/api/doctors/unavailability/${id}`);
      
      if (response.data.success) {
        await fetchLeaves();
      } else {
        alert(response.data.message || 'Failed to delete leave');
      }
    } catch (error) {
      console.error('Error deleting leave:', error);
      alert('Failed to delete leave');
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (leave: Leave) => {
    setEditingLeave(leave);
    setFormData({
      startDate: leave.startDate,
      endDate: leave.endDate,
      leaveType: leave.leaveType,
      reason: leave.reason || '',
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingLeave(null);
    setFormData({
      startDate: '',
      endDate: '',
      leaveType: 'vacation',
      reason: '',
    });
    setErrors({});
  };

  const getLeaveTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      sick: 'Sick Leave',
      vacation: 'Vacation',
      personal: 'Personal',
      emergency: 'Emergency',
      other: 'Other',
    };
    return labels[type] || type;
  };

  const getLeaveTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      sick: 'bg-red-100 text-red-700',
      vacation: 'bg-blue-100 text-blue-700',
      personal: 'bg-purple-100 text-purple-700',
      emergency: 'bg-orange-100 text-orange-700',
      other: 'bg-gray-100 text-gray-700',
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const calculateDays = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-600 mb-4" />
          <p className="text-slate-600">Loading leaves...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 mb-2 text-2xl font-bold">Leaves & Time Off</h1>
          <p className="text-gray-600">Manage your leave requests and time off periods</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-lg flex items-center gap-2 transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Leave
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Calendar className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-blue-900 mb-1 font-semibold">How Leaves Work</h3>
            <p className="text-sm text-blue-800">
              When you mark dates as leave, the system will automatically skip generating availability slots for those dates. 
              Existing slots on leave dates will remain, but no new slots will be created from templates.
            </p>
          </div>
        </div>
      </div>

      {/* Leaves List */}
      <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-200">
        {leaves.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">No leaves scheduled yet</p>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-[#2563EB] text-white rounded-lg hover:bg-[#1d4ed8] transition-colors font-medium"
            >
              Add Your First Leave
            </button>
          </div>
        ) : (
          leaves.map((leave) => (
            <div key={leave.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`px-3 py-1 rounded text-sm font-medium ${getLeaveTypeColor(leave.leaveType)}`}>
                      {getLeaveTypeLabel(leave.leaveType)}
                    </span>
                    <span className="text-sm text-gray-600">
                      {calculateDays(leave.startDate, leave.endDate)} day{calculateDays(leave.startDate, leave.endDate) !== 1 ? 's' : ''}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span>
                        {formatDate(leave.startDate)} - {formatDate(leave.endDate)}
                      </span>
                    </div>
                    {leave.reason && (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Reason:</span> {leave.reason}
                      </div>
                    )}
                    <div className="text-xs text-gray-500">
                      Created: {formatDate(leave.createdAt)}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(leave)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit leave"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(leave.id)}
                    disabled={deletingId === leave.id}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete leave"
                  >
                    {deletingId === leave.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-gray-900 font-semibold">
                {editingLeave ? 'Edit Leave' : 'Add Leave'}
              </h2>
              <button
                onClick={handleCloseModal}
                disabled={submitting}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                {/* Leave Type */}
                <div>
                  <label className="block text-sm text-gray-700 mb-2 font-medium">
                    Leave Type <span className="text-[#EF4444]">*</span>
                  </label>
                  <select
                    value={formData.leaveType}
                    onChange={(e) => setFormData({ ...formData, leaveType: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                  >
                    <option value="vacation">Vacation</option>
                    <option value="sick">Sick Leave</option>
                    <option value="personal">Personal</option>
                    <option value="emergency">Emergency</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-2 font-medium">
                      Start Date <span className="text-[#EF4444]">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC] ${
                        errors.startDate ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                    {errors.startDate && (
                      <p className="text-red-600 text-xs mt-1">{errors.startDate}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-2 font-medium">
                      End Date <span className="text-[#EF4444]">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      min={formData.startDate || new Date().toISOString().split('T')[0]}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC] ${
                        errors.endDate ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                    {errors.endDate && (
                      <p className="text-red-600 text-xs mt-1">{errors.endDate}</p>
                    )}
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-sm text-gray-700 mb-2 font-medium">
                    Reason (Optional)
                  </label>
                  <textarea
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    placeholder="Brief reason for leave..."
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
              </div>

              <div className="p-4 border-t border-gray-200 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={submitting}
                  className="px-4 py-2 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#0066CC] hover:bg-[#0052a3] text-white rounded-lg transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitting ? 'Saving...' : editingLeave ? 'Update Leave' : 'Add Leave'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
