'use client';

import { X, Calendar, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';

interface GenerateSlotsModalProps {
  templateName?: string;
  onClose: () => void;
  onConfirm: (startDate: string, endDate: string) => void;
  loading?: boolean;
}

export function GenerateSlotsModal({ templateName, onClose, onConfirm, loading = false }: GenerateSlotsModalProps) {
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Set default: today as start date, 7 days from today as end date
  const today = new Date();
  const nextWeek = new Date();
  nextWeek.setDate(today.getDate() + 7);

  const [startDate, setStartDate] = useState(formatDate(today));
  const [endDate, setEndDate] = useState(formatDate(nextWeek));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const newErrors: Record<string, string> = {};

    if (!startDate) {
      newErrors.startDate = 'Start date is required';
    }

    if (!endDate) {
      newErrors.endDate = 'End date is required';
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (start > end) {
        newErrors.endDate = 'End date must be after start date';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // If dates are provided, use them; otherwise default to 7 days from today
    if (startDate && endDate) {
      onConfirm(startDate, endDate);
    } else {
      // Default to 7 days from today
      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);
      
      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      onConfirm(formatDate(today), formatDate(nextWeek));
    }
  };

  const getMinDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-gray-900 font-semibold">
            {templateName ? `Generate Slots: ${templateName}` : 'Generate Slots'}
          </h2>
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
            <p className="text-sm text-gray-600">
              Select the start date and end date to generate availability slots for your templates. Slots will be generated for all dates between the selected range based on each template's recurrence pattern.
            </p>

            {/* Start Date */}
            <div>
              <label className="block text-sm text-gray-700 mb-2 font-medium">
                Start Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input 
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  min={getMinDate()}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC] pr-10 ${
                    errors.startDate ? 'border-red-300' : 'border-gray-300'
                  }`}
                  required
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              {errors.startDate && (
                <p className="text-red-500 text-xs mt-1">{errors.startDate}</p>
              )}
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm text-gray-700 mb-2 font-medium">
                End Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input 
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || getMinDate()}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC] pr-10 ${
                    errors.endDate ? 'border-red-300' : 'border-gray-300'
                  }`}
                  required
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              {errors.endDate && (
                <p className="text-red-500 text-xs mt-1">{errors.endDate}</p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-[#0066CC] hover:bg-[#0052a3] text-white rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Slots'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

