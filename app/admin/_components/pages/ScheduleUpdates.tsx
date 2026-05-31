'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '../PageHeader';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Loader2, Eye, Filter, Search } from 'lucide-react';
import { StatusBadge } from '../StatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from 'sonner';
import Link from 'next/link';

interface ScheduleUpdate {
  id: string;
  doctorId: string;
  doctorName: string;
  slotType: 'parent' | 'sub';
  slotDate: string;
  startTime: string;
  endTime: string;
  status: string;
  isManual: boolean;
  templateId: string | null;
  parentSlotId: string | null;
  hospitalId: string | null;
  hospitalName: string | null;
  assignmentId: string | null;
  updatedAt: string;
}

interface ParentSlotDetail {
  parentSlot: {
    id: string;
    doctorId: string;
    doctorName: string;
    slotDate: string;
    startTime: string;
    endTime: string;
    status: string;
    isManual: boolean;
    templateId: string | null;
    updatedAt: string;
  };
  subSlots: Array<{
    id: string;
    slotDate: string;
    startTime: string;
    endTime: string;
    status: string;
    hospitalId: string | null;
    hospitalName: string | null;
    assignmentId: string | null;
    assignmentStatus: string | null;
    bookedAt: string | null;
    updatedAt: string;
  }>;
  totalSubSlots: number;
}

export function ScheduleUpdates() {
  const [updates, setUpdates] = useState<ScheduleUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filters
  const [doctorSearch, setDoctorSearch] = useState<string>('');
  const [status, setStatus] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // Applied filters (for display)
  const [appliedFilters, setAppliedFilters] = useState({
    doctorSearch: '',
    status: 'all',
    startDate: '',
    endDate: '',
  });
  
  // Modal state
  const [selectedParentSlotId, setSelectedParentSlotId] = useState<string | null>(null);
  const [parentSlotDetail, setParentSlotDetail] = useState<ParentSlotDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchUpdates();
  }, [page, appliedFilters]);

  const fetchUpdates = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });

      if (appliedFilters.doctorSearch) {
        params.append('doctorSearch', appliedFilters.doctorSearch);
      }
      if (appliedFilters.status !== 'all') {
        params.append('status', appliedFilters.status);
      }
      if (appliedFilters.startDate) {
        params.append('startDate', appliedFilters.startDate);
      }
      if (appliedFilters.endDate) {
        params.append('endDate', appliedFilters.endDate);
      }

      const res = await fetch(`/api/admin/schedule-updates?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setUpdates(data.data || []);
        setTotalPages(data.pagination?.totalPages || 1);
      } else {
        toast.error(data.message || 'Failed to fetch schedule updates');
      }
    } catch (error) {
      console.error('Error fetching schedule updates:', error);
      toast.error('Failed to fetch schedule updates');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = () => {
    setAppliedFilters({
      doctorSearch,
      status,
      startDate,
      endDate,
    });
    setPage(1);
  };

  const handleClearFilters = () => {
    setDoctorSearch('');
    setStatus('all');
    setStartDate('');
    setEndDate('');
    setAppliedFilters({
      doctorSearch: '',
      status: 'all',
      startDate: '',
      endDate: '',
    });
    setPage(1);
  };

  const handleViewParentSlot = async (parentSlotId: string) => {
    try {
      setLoadingDetail(true);
      setSelectedParentSlotId(parentSlotId);
      setShowModal(true);

      const res = await fetch(`/api/admin/schedule-updates/parent-slot/${parentSlotId}`);
      const data = await res.json();

      if (data.success) {
        setParentSlotDetail(data.data);
      } else {
        toast.error(data.message || 'Failed to fetch parent slot details');
      }
    } catch (error) {
      console.error('Error fetching parent slot details:', error);
      toast.error('Failed to fetch parent slot details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const formatTime = (time: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader 
        title="Schedule Updates" 
        description="View all doctor schedule updates including parent slots and sub-slots"
      />

      <div className="p-8 space-y-6">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-slate-600" />
            <h3 className="text-lg font-semibold text-slate-900">Filters</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Doctor Search */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Doctor Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search by doctor name..."
                  value={doctorSearch}
                  onChange={(e) => setDoctorSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleApplyFilters();
                    }
                  }}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="booked">Booked</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || undefined}
              />
            </div>
          </div>

          {/* Apply and Clear Buttons */}
          <div className="flex items-center gap-3 mt-4">
            <Button onClick={handleApplyFilters} className="bg-teal-600 hover:bg-teal-700">
              Apply Filters
            </Button>
            <Button 
              onClick={handleClearFilters} 
              variant="outline"
              className="border-slate-300"
            >
              Clear
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-slate-600">Updated At</th>
                    <th className="px-6 py-3 text-left text-slate-600">Doctor</th>
                    <th className="px-6 py-3 text-left text-slate-600">Date</th>
                    <th className="px-6 py-3 text-left text-slate-600">Time Range</th>
                    <th className="px-6 py-3 text-left text-slate-600">Status</th>
                    <th className="px-6 py-3 text-left text-slate-600">Source</th>
                    <th className="px-6 py-3 text-left text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {updates.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                        No schedule updates found
                      </td>
                    </tr>
                  ) : (
                    updates.map((update) => (
                      <tr key={update.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 text-slate-600 text-sm">
                          {formatDateTime(update.updatedAt)}
                        </td>
                        <td className="px-6 py-4 text-slate-900">{update.doctorName}</td>
                        <td className="px-6 py-4 text-slate-600">{formatDate(update.slotDate)}</td>
                        <td className="px-6 py-4 text-slate-600">
                          {formatTime(update.startTime)} - {formatTime(update.endTime)}
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={update.status} />
                        </td>
                        <td className="px-6 py-4 text-slate-600 text-sm">
                          {update.isManual ? 'Manual' : 'Template'}
                        </td>
                        <td className="px-6 py-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewParentSlot(update.id)}
                            className="text-teal-600 hover:text-teal-700"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View Sub-slots
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <div className="text-sm text-slate-600">
                Page {page} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Parent Slot Detail Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Parent Slot Details</DialogTitle>
          </DialogHeader>
          
          {loadingDetail ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            </div>
          ) : parentSlotDetail ? (
            <div className="space-y-6">
              {/* Parent Slot Info */}
              <div className="bg-slate-50 rounded-lg p-4">
                <h3 className="font-semibold text-slate-900 mb-3">Parent Slot</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-600">Doctor:</span>
                    <span className="ml-2 text-slate-900">{parentSlotDetail.parentSlot.doctorName}</span>
                  </div>
                  <div>
                    <span className="text-slate-600">Date:</span>
                    <span className="ml-2 text-slate-900">{formatDate(parentSlotDetail.parentSlot.slotDate)}</span>
                  </div>
                  <div>
                    <span className="text-slate-600">Time Range:</span>
                    <span className="ml-2 text-slate-900">
                      {formatTime(parentSlotDetail.parentSlot.startTime)} - {formatTime(parentSlotDetail.parentSlot.endTime)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600">Status:</span>
                    <span className="ml-2">
                      <StatusBadge status={parentSlotDetail.parentSlot.status} />
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600">Source:</span>
                    <span className="ml-2 text-slate-900">
                      {parentSlotDetail.parentSlot.isManual ? 'Manual' : 'Template'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600">Last Updated:</span>
                    <span className="ml-2 text-slate-900">
                      {formatDateTime(parentSlotDetail.parentSlot.updatedAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sub-slots */}
              <div>
                <h3 className="font-semibold text-slate-900 mb-3">
                  Sub-slots ({parentSlotDetail.totalSubSlots})
                </h3>
                {parentSlotDetail.subSlots.length === 0 ? (
                  <p className="text-slate-500 text-sm">No sub-slots found</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-slate-600">Time Range</th>
                          <th className="px-4 py-2 text-left text-slate-600">Status</th>
                          <th className="px-4 py-2 text-left text-slate-600">Hospital</th>
                          <th className="px-4 py-2 text-left text-slate-600">Assignment</th>
                          <th className="px-4 py-2 text-left text-slate-600">Booked At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {parentSlotDetail.subSlots.map((subSlot) => (
                          <tr key={subSlot.id} className="hover:bg-slate-50">
                            <td className="px-4 py-2 text-slate-900">
                              {formatTime(subSlot.startTime)} - {formatTime(subSlot.endTime)}
                            </td>
                            <td className="px-4 py-2">
                              <StatusBadge status={subSlot.status} />
                            </td>
                            <td className="px-4 py-2 text-slate-600">
                              {subSlot.hospitalName || '-'}
                            </td>
                            <td className="px-4 py-2">
                              {subSlot.assignmentId ? (
                                <Link 
                                  href={`/admin/assignments?search=${subSlot.assignmentId}`}
                                  className="text-teal-600 hover:text-teal-700 underline"
                                >
                                  {subSlot.assignmentId.substring(0, 8)}...
                                </Link>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="px-4 py-2 text-slate-600">
                              {subSlot.bookedAt ? formatDateTime(subSlot.bookedAt) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

