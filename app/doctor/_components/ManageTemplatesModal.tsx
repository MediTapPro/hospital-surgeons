'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, X, Loader2, Trash2, Pencil, CheckCircle2, AlertTriangle } from 'lucide-react';
import apiClient from '@/lib/api/httpClient';
import { toast } from 'sonner';

type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'custom';

interface AvailabilityTemplate {
  id: string;
  templateName: string;
  startTime: string;
  endTime: string;
  recurrencePattern: RecurrencePattern;
  recurrenceDays: string[];
  validFrom: string;
  validUntil?: string | null;
}

interface ManageTemplatesModalProps {
  doctorId: string;
  onClose: () => void;
}

const DAY_OPTIONS = [
  { label: 'Mon', value: 'mon' },
  { label: 'Tue', value: 'tue' },
  { label: 'Wed', value: 'wed' },
  { label: 'Thu', value: 'thu' },
  { label: 'Fri', value: 'fri' },
  { label: 'Sat', value: 'sat' },
  { label: 'Sun', value: 'sun' },
];

const RECURRENCE_OPTIONS: { label: string; value: RecurrencePattern }[] = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly (select days)', value: 'weekly' },
  { label: 'Monthly (same date)', value: 'monthly' },
  { label: 'Custom (manual days)', value: 'custom' },
];

const formatTime = (time: string) => {
  if (!time) return '';
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const normalizedHours = hours % 12 || 12;
  return `${normalizedHours}:${minutes.toString().padStart(2, '0')} ${period}`;
};

export function ManageTemplatesModal({ doctorId, onClose }: ManageTemplatesModalProps) {
  const [templates, setTemplates] = useState<AvailabilityTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    templateName: '',
    startTime: '',
    endTime: '',
    recurrencePattern: 'weekly' as RecurrencePattern,
    recurrenceDays: [] as string[],
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: '',
  });

  const timeOptions = useMemo(() => {
    const options = [];
    for (let hour = 6; hour <= 22; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const value = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        options.push({ value, label: formatTime(value) });
      }
    }
    return options;
  }, []);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.get(`/api/doctors/${doctorId}/availability/templates`);
        const data = response.data;
        if (data.success) {
          setTemplates(data.data || []);
        } else {
          setError(data.message || 'Failed to load templates');
        }
      } catch (err: any) {
        console.error('Failed to load templates', err);
        const errorMessage = err.response?.data?.message || err.message || 'Failed to load templates';
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    if (doctorId) {
      fetchTemplates();
    }
  }, [doctorId]);

  const resetForm = () => {
    setFormError(null);
    setEditingTemplateId(null);
    setFormData({
      templateName: '',
      startTime: '',
      endTime: '',
      recurrencePattern: 'weekly',
      recurrenceDays: [],
      validFrom: new Date().toISOString().split('T')[0],
      validUntil: '',
    });
  };

  const validateForm = () => {
    if (!formData.templateName.trim()) {
      return 'Template name is required';
    }
    if (!formData.startTime || !formData.endTime) {
      return 'Start and end time are required';
    }
    if (formData.endTime <= formData.startTime) {
      return 'End time must be after start time';
    }
    if (!formData.validFrom) {
      return 'Valid from date is required';
    }
    if (formData.validUntil && formData.validUntil < formData.validFrom) {
      return 'Valid until must be after valid from';
    }
    if (
      formData.recurrencePattern !== 'daily' &&
      formData.recurrencePattern !== 'monthly' &&
      formData.recurrenceDays.length === 0
    ) {
      return 'Select at least one day';
    }
    return null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;

    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    try {
      setSaving(true);
      setFormError(null);

      const payload = {
        templateName: formData.templateName.trim(),
        startTime: formData.startTime,
        endTime: formData.endTime,
        recurrencePattern: formData.recurrencePattern,
        recurrenceDays:
          formData.recurrencePattern === 'daily' || formData.recurrencePattern === 'monthly'
            ? []
            : formData.recurrenceDays,
        validFrom: formData.validFrom,
        validUntil: formData.validUntil || undefined,
      };

      const url = editingTemplateId
        ? `/api/doctors/${doctorId}/availability/templates/${editingTemplateId}`
        : `/api/doctors/${doctorId}/availability/templates`;

      const response = editingTemplateId
        ? await apiClient.patch(url, payload)
        : await apiClient.post(url, payload);

      const data = response.data;
      if (!data.success) {
        // Show detailed error message as toast
        toast.error(data.message || 'Failed to save template', {
          duration: 5000, // Show for 5 seconds to allow reading the detailed message
        });
        setFormError(data.message || 'Failed to save template');
        return;
      }

      // Show success toast
      if (editingTemplateId) {
        toast.success('Template updated successfully');
        setTemplates((prev) => prev.map((tpl) => (tpl.id === editingTemplateId ? data.data : tpl)));
      } else {
        toast.success('Template created successfully');
        setTemplates((prev) => [data.data, ...prev]);
      }
      resetForm();
    } catch (err: any) {
      console.error('Failed to save template', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to save template. Please try again.';
      toast.error(errorMessage, {
        duration: 5000,
      });
      setFormError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (template: AvailabilityTemplate) => {
    setEditingTemplateId(template.id);
    setFormError(null);
    setFormData({
      templateName: template.templateName,
      startTime: template.startTime,
      endTime: template.endTime,
      recurrencePattern: template.recurrencePattern,
      recurrenceDays: template.recurrenceDays || [],
      validFrom: template.validFrom,
      validUntil: template.validUntil || '',
    });
  };

  const handleDelete = async (templateId: string) => {
    if (!window.confirm('Delete this template? Generated slots will stay untouched.')) return;
    try {
      await apiClient.delete(`/api/doctors/${doctorId}/availability/templates/${templateId}`);
      setTemplates((prev) => prev.filter((tpl) => tpl.id !== templateId));
      if (editingTemplateId === templateId) {
        resetForm();
      }
      toast.success('Template deleted successfully');
    } catch (err: any) {
      console.error('Failed to delete template', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to delete template. Please try again.';
      toast.error(errorMessage);
      setError(errorMessage);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-gray-900 font-semibold">Recurring Availability</h2>
            <p className="text-sm text-gray-500">Create templates so the system can auto-generate slots daily.</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded transition-colors">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] divide-x divide-gray-200 flex-1 overflow-hidden">
          <div className="p-4 overflow-y-auto">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">
                  {editingTemplateId ? 'Edit template' : 'Create template'}
                </h3>
                {editingTemplateId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    Cancel edit
                  </button>
                )}
              </div>

              <div>
                <label className="text-sm text-gray-700 font-medium">Template name</label>
                <input
                  type="text"
                  value={formData.templateName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, templateName: e.target.value }))}
                  placeholder="e.g., Morning rounds"
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-700 font-medium">Start time</label>
                  <select
                    value={formData.startTime}
                    onChange={(e) => setFormData((prev) => ({ ...prev, startTime: e.target.value }))}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                  >
                    <option value="">Select</option>
                    {timeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-700 font-medium">End time</label>
                  <select
                    value={formData.endTime}
                    onChange={(e) => setFormData((prev) => ({ ...prev, endTime: e.target.value }))}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                  >
                    <option value="">Select</option>
                    {timeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-700 font-medium">Recurrence</label>
                <select
                  value={formData.recurrencePattern}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      recurrencePattern: e.target.value as RecurrencePattern,
                      recurrenceDays: e.target.value === 'daily' || e.target.value === 'monthly' ? [] : prev.recurrenceDays,
                    }))
                  }
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                >
                  {RECURRENCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {(formData.recurrencePattern === 'weekly' || formData.recurrencePattern === 'custom') && (
                <div>
                  <p className="text-sm text-gray-700 font-medium mb-2">Select days</p>
                  <div className="flex flex-wrap gap-2">
                    {DAY_OPTIONS.map((day) => {
                      const selected = formData.recurrenceDays.includes(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              recurrenceDays: selected
                                ? prev.recurrenceDays.filter((d) => d !== day.value)
                                : [...prev.recurrenceDays, day.value],
                            }))
                          }
                          className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                            selected
                              ? 'bg-[#0066CC] text-white border-[#0066CC]'
                              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-700 font-medium">Valid from</label>
                  <input
                    type="date"
                    value={formData.validFrom}
                    onChange={(e) => setFormData((prev) => ({ ...prev, validFrom: e.target.value }))}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-700 font-medium">Valid until (optional)</label>
                  <input
                    type="date"
                    value={formData.validUntil}
                    onChange={(e) => setFormData((prev) => ({ ...prev, validUntil: e.target.value }))}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                  />
                </div>
              </div>

              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{formError}</div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#0066CC] hover:bg-[#0052a3] text-white rounded-lg transition-colors font-medium disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {editingTemplateId ? 'Update template' : 'Save template'}
              </button>
              <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg p-3 text-sm text-[#1E3A8A] flex gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Auto job runs daily at noon to fill the next seven days based on these templates.
              </div>
            </form>
          </div>

          <div className="p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-gray-900 font-medium">Active templates</h3>
              <span className="text-sm text-gray-500">{templates.length} total</span>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4">{error}</div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-8 text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Loading templates...
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-10 border border-dashed rounded-lg">
                <AlertTriangle className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-700 font-medium mb-1">No templates yet</p>
                <p className="text-sm text-gray-500">
                  Create a template on the left to keep your availability filled automatically.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {templates.map((template) => (
                  <div key={template.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-gray-900">{template.templateName}</h4>
                        <p className="text-sm text-gray-500">
                          {formatTime(template.startTime)} - {formatTime(template.endTime)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(template)}
                          className="p-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                          title="Edit template"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(template.id)}
                          className="p-2 border border-red-200 rounded-lg text-red-600 hover:bg-red-50"
                          title="Delete template"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="text-sm text-gray-600 space-y-1">
                      <p className="font-medium capitalize">
                        Pattern:{' '}
                        {template.recurrencePattern === 'daily'
                          ? 'Daily'
                          : template.recurrencePattern === 'monthly'
                          ? 'Monthly (same date)'
                          : template.recurrencePattern === 'weekly'
                          ? `Weekly on ${template.recurrenceDays.map((day) => day.toUpperCase()).join(', ')}`
                          : `Custom days: ${template.recurrenceDays.map((day) => day.toUpperCase()).join(', ')}`}
                      </p>
                      <p>
                        Valid: {template.validFrom}{' '}
                        {template.validUntil ? `→ ${template.validUntil}` : '(no end date)'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 flex justify-end">
          <button onClick={onClose} className="px-6 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

