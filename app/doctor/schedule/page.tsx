'use client';

import { Plus, Trash2, Clock, Calendar, Loader2, RefreshCw, Settings } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AddSlotModal } from '../_components/AddSlotModal';
import { ManageTemplatesModal } from '../_components/ManageTemplatesModal';
import { GenerateSlotsModal } from '../_components/GenerateSlotsModal';
import { isAuthenticated } from '@/lib/auth/utils';
import apiClient from '@/lib/api/httpClient';
import type { AxiosError } from 'axios';

interface TimeSlot {
  id: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  status: 'available' | 'booked';
  notes?: string | null;
  templateId?: string | null;
  isManual?: boolean | null;
}

interface AvailabilityTemplate {
  id: string;
  templateName: string;
  startTime: string;
  endTime: string;
  recurrencePattern: string;
  recurrenceDays: string[];
  validFrom: string;
  validUntil?: string | null;
}

export default function SetAvailabilityPage() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TimeSlot | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<AvailabilityTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);
  const [generatingTemplateId, setGeneratingTemplateId] = useState<string | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showTemplateGenerateModal, setShowTemplateGenerateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    fetchDoctorProfile();
  }, []);

  useEffect(() => {
    if (doctorId) {
      fetchAvailability();
      fetchTemplates();
    }
  }, [doctorId]);

  const fetchDoctorProfile = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await apiClient.get('/api/doctors/profile');
      const data = response.data;

      if (data.success && data.data?.id) {
        setDoctorId(data.data.id);
      } else {
        setError('Failed to load doctor profile. Please refresh the page.');
        setLoading(false);
      }
    } catch (err) {
      const error = err as AxiosError<any>;
      if (error.response?.status === 404) {
        setError('Please complete your profile first to manage availability. You can still add slots, but they will be linked after profile creation.');
        setLoading(false);
        return;
      }
      console.error('Error fetching doctor profile:', error);
      setError('Failed to load doctor profile. Please try again.');
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    if (!doctorId) return;
    try {
      setTemplatesLoading(true);
      setTemplatesError(null);
      const { data } = await apiClient.get(`/api/doctors/${doctorId}/availability/templates`);
      if (data.success && data.data) {
        setTemplates(data.data);
      } else {
        setTemplatesError(data.message || 'Failed to load templates');
      }
    } catch (err) {
      console.error('Error fetching templates:', err);
      setTemplatesError('Failed to load templates');
    } finally {
      setTemplatesLoading(false);
    }
  };

  const fetchAvailability = async () => {
    if (!doctorId) return;
    try {
      setLoading(true);
      setError(null);
      // Fetch only parent slots (not sub-slots) for availability display
      // Parent slots are availability windows - they don't have "booked" status
      const { data } = await apiClient.get(`/api/doctors/${doctorId}/availability`);
      if (data.success && data.data) {
        // API returns: [{ parentSlot: {...}, bookedSubslots: [...] }]
        // Extract only parent slots for display
        const parentSlotsData = Array.isArray(data.data) ? data.data : [];
        const formattedSlots = parentSlotsData.map((item: any) => ({
          id: item.parentSlot?.id,
          slotDate: item.parentSlot?.slotDate,
          startTime: item.parentSlot?.start,
          endTime: item.parentSlot?.end,
          status: 'available' as const, // Parent slots are always "available" (they're just availability windows)
          notes: null,
          templateId: null, // Will need to fetch separately if needed
          isManual: null,
        })).filter((slot: any) => slot.id); // Filter out invalid slots
        setSlots(formattedSlots);
      } else {
        setError('Failed to load availability slots');
      }
    } catch (err) {
      console.error('Error fetching availability:', err);
      setError('Failed to load availability slots');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this slot?') || deletingId) {
      return;
    }

    try {
      setDeletingId(id);
      const { data } = await apiClient.delete(`/api/doctors/availability/${id}`);

      if (data.success) {
        // Refresh the list
        await fetchAvailability();
      } else {
        alert(data.message || 'Failed to delete slot');
      }
    } catch (err) {
      console.error('Error deleting slot:', err);
      alert('Failed to delete slot');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSlotAdded = () => {
    fetchAvailability();
    fetchTemplates();
    setEditingSlot(null);
  };

  const handleEdit = (slot: TimeSlot) => {
    setEditingSlot(slot);
    setShowModal(true);
  };

  const handleGenerateFromTemplates = () => {
    if (!doctorId || generating) return;
    setShowGenerateModal(true);
  };

  const handleConfirmGenerate = async (startDate: string, endDate: string) => {
    if (!doctorId || generating) return; // Prevent double-clicks
    setGenerationMessage(null);
    try {
      setGenerating(true);
      setShowGenerateModal(false);
      
      // Calculate days between start and end date
      const start = new Date(startDate);
      const end = new Date(endDate);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      const { data } = await apiClient.post(`/api/doctors/${doctorId}/availability/templates/generate`, {
        startDate: startDate,
        endDate: endDate,
        days: days
      });
      
      if (data.success) {
        const created = data.data?.slotsCreated ?? 0;
        const processed = data.data?.templatesProcessed ?? 0;
        setGenerationMessage(`Generated ${created} slot${created === 1 ? '' : 's'} from ${processed} template${processed === 1 ? '' : 's'} for ${days} day${days === 1 ? '' : 's'}.`);
        fetchAvailability();
      } else {
        setGenerationMessage(data.message || 'Failed to generate slots');
      }
    } catch (err) {
      console.error('Error generating slots:', err);
      setGenerationMessage('Failed to generate slots. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateFromTemplate = (templateId: string, templateName: string) => {
    if (!doctorId || generatingTemplateId === templateId || generating) return;
    setSelectedTemplate({ id: templateId, name: templateName });
    setShowTemplateGenerateModal(true);
  };

  const handleConfirmTemplateGenerate = async (startDate: string, endDate: string) => {
    if (!doctorId || !selectedTemplate || generatingTemplateId === selectedTemplate.id || generating) return; // Prevent double-clicks
    try {
      setGeneratingTemplateId(selectedTemplate.id);
      setShowTemplateGenerateModal(false);
      
      // Calculate days between start and end date
      const start = new Date(startDate);
      const end = new Date(endDate);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      const { data } = await apiClient.post(`/api/doctors/${doctorId}/availability/templates/generate`, {
        templateId: selectedTemplate.id,
        startDate: startDate,
        endDate: endDate,
        days: days
      });
      
      if (data.success) {
        const created = data.data?.slotsCreated ?? 0;
        setGenerationMessage(`Generated ${created} slot${created === 1 ? '' : 's'} from template "${selectedTemplate.name}" for ${days} day${days === 1 ? '' : 's'}.`);
        fetchAvailability();
      } else {
        setGenerationMessage(data.message || `Failed to generate slots from template "${selectedTemplate.name}"`);
      }
    } catch (err) {
      console.error('Error generating slots from template:', err);
      setGenerationMessage(`Failed to generate slots from template "${selectedTemplate.name}". Please try again.`);
    } finally {
      setGeneratingTemplateId(null);
      setSelectedTemplate(null);
    }
  };

  const formatPattern = (template: AvailabilityTemplate) => {
    if (template.recurrencePattern === 'daily') return 'Daily';
    if (template.recurrencePattern === 'monthly') return 'Monthly (same date)';
    if (template.recurrenceDays?.length) {
      return `${template.recurrencePattern === 'weekly' ? 'Weekly' : 'Custom'} on ${template.recurrenceDays
        .map((day) => day.toUpperCase())
        .join(', ')}`;
    }
    return template.recurrencePattern;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (timeStr: string) => {
    if (timeStr && timeStr.includes(':')) {
      const [hours, minutes] = timeStr.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes || '00'} ${ampm}`;
    }
    return timeStr;
  };

  // All parent slots are "available" (they're just availability windows)
  const availableSlots = slots.length;
  // Sub-slots (actual bookings) are shown in assignments page, not here
  const bookedSlots = 0; // Parent slots don't have "booked" status

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-600 mb-4" />
          <p className="text-slate-600">Loading availability...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 mb-2 text-2xl font-bold">Set Availability</h1>
          <p className="text-gray-600">Manage your available time slots</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-lg flex items-center gap-2 transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Slot
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Recurring Templates */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className="text-gray-900 font-semibold flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Recurring Templates
            </h3>
            <p className="text-sm text-gray-600">
              {templates.length > 0
                ? `${templates.length} template${templates.length === 1 ? '' : 's'} active`
                : 'No templates yet'}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowTemplatesModal(true)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
            >
              Manage Templates
            </button>
            <button
              onClick={handleGenerateFromTemplates}
              disabled={generating || templates.length === 0}
              className="px-4 py-2 bg-[#0066CC] hover:bg-[#0052a3] text-white rounded-lg flex items-center gap-2 transition-colors font-medium disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Generate Slots
            </button>
          </div>
        </div>
        {generationMessage && (
          <div className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3">{generationMessage}</div>
        )}
        {templatesError && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{templatesError}</div>
        )}
        {templatesLoading ? (
          <div className="flex items-center text-gray-600 gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading templates...
          </div>
        ) : templates.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {templates.map((template) => (
              <div key={template.id} className="border border-gray-200 rounded-lg p-3 text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-900">{template.templateName}</p>
                  {template.validUntil ? (
                    <span className="text-xs text-gray-500">Until {template.validUntil}</span>
                  ) : (
                    <span className="text-xs text-green-600">No end date</span>
                  )}
                </div>
                <p className="text-gray-600">
                  {formatTime(template.startTime)} - {formatTime(template.endTime)}
                </p>
                <p className="text-gray-500">{formatPattern(template)}</p>
                <button
                  onClick={() => handleGenerateFromTemplate(template.id, template.templateName)}
                  disabled={generatingTemplateId === template.id || generating}
                  className="w-full mt-2 px-3 py-1.5 bg-[#0066CC] hover:bg-[#0052a3] text-white rounded-lg flex items-center justify-center gap-2 transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generatingTemplateId === template.id ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3 h-3" />
                      Generate Slots
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl text-gray-900 mb-1 font-bold">{slots.length}</div>
          <div className="text-sm text-gray-600">Total Slots</div>
        </div>
        <div className="bg-white border border-green-200 rounded-lg p-4">
          <div className="text-2xl text-green-600 mb-1 font-bold">{availableSlots}</div>
          <div className="text-sm text-gray-600">Available</div>
        </div>
        <div className="bg-white border border-orange-200 rounded-lg p-4">
          <div className="text-2xl text-orange-600 mb-1 font-bold">{bookedSlots}</div>
          <div className="text-sm text-gray-600">Booked</div>
        </div>
      </div>

      {/* Slots List */}
      <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-200">
        {slots.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">No availability slots set yet</p>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-[#2563EB] text-white rounded-lg hover:bg-[#1d4ed8] transition-colors font-medium"
            >
              Add Your First Slot
            </button>
          </div>
        ) : (
          slots.map((slot, index) => (
            <div key={slot.id || `slot-${index}`} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  {/* Icon */}
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-green-100">
                    <Calendar className="w-6 h-6 text-green-600" />
                  </div>

                  {/* Details */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className="text-gray-900 font-semibold">{formatDate(slot.slotDate)}</h4>
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                        Available
                      </span>
                      {slot.templateId && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                          Auto
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span>{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</span>
                    </div>
                    {slot.notes && (
                      <div className="text-xs text-gray-500 mt-1">{slot.notes}</div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {/* Parent slots are always available (they're just availability windows) */}
                <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(slot)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit slot"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(slot.id)}
                      disabled={deletingId === slot.id}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Delete slot"
                    >
                      {deletingId === slot.id ? (
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

      {/* Add/Edit Slot Modal */}
      {showModal && doctorId && (
        <AddSlotModal 
          doctorId={doctorId}
          onClose={() => {
            setShowModal(false);
            setEditingSlot(null);
          }} 
          onSuccess={handleSlotAdded}
          editingSlot={editingSlot}
        />
      )}
      {showTemplatesModal && doctorId && (
        <ManageTemplatesModal
          doctorId={doctorId}
          onClose={() => {
            setShowTemplatesModal(false);
            fetchTemplates();
          }}
        />
      )}
      
      {/* Generate Slots Modal (All Templates) */}
      {showGenerateModal && (
        <GenerateSlotsModal
          onClose={() => setShowGenerateModal(false)}
          onConfirm={handleConfirmGenerate}
          loading={generating}
        />
      )}

      {/* Generate Slots Modal (Specific Template) */}
      {showTemplateGenerateModal && selectedTemplate && (
        <GenerateSlotsModal
          templateName={selectedTemplate.name}
          onClose={() => {
            setShowTemplateGenerateModal(false);
            setSelectedTemplate(null);
          }}
          onConfirm={handleConfirmTemplateGenerate}
          loading={generatingTemplateId === selectedTemplate.id}
        />
      )}
    </div>
  );
}


