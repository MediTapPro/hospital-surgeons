'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '../PageHeader';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Loader2, Filter } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api/httpClient';
import { AdminDataTable, type AdminDataTableColumn } from '../ui/AdminDataTable';

interface VacationUpdate {
  id: string;
  doctorId: string;
  doctorName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  reason: string | null;
  createdAt: string;
}

interface Doctor {
  id: string;
  name: string;
}

export function VacationUpdates() {
  const [updates, setUpdates] = useState<VacationUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  
  // Filters
  const [doctorId, setDoctorId] = useState<string>('all');
  const [leaveType, setLeaveType] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // Applied filters (for display)
  const [appliedFilters, setAppliedFilters] = useState({
    doctorId: 'all',
    leaveType: 'all',
    startDate: '',
    endDate: '',
  });
  
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);

  useEffect(() => {
    fetchDoctors();
  }, []);

  useEffect(() => {
    fetchUpdates();
  }, [page, pageSize, appliedFilters]);

  const fetchDoctors = async () => {
    try {
      setLoadingDoctors(true);
      const { data } = await apiClient.get('/api/admin/doctors/list');
      if (data.success) {
        setDoctors(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching doctors:', error);
    } finally {
      setLoadingDoctors(false);
    }
  };

  const fetchUpdates = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
      });

      if (appliedFilters.doctorId !== 'all') {
        params.append('doctorId', appliedFilters.doctorId);
      }
      if (appliedFilters.leaveType !== 'all') {
        params.append('leaveType', appliedFilters.leaveType);
      }
      if (appliedFilters.startDate) {
        params.append('startDate', appliedFilters.startDate);
      }
      if (appliedFilters.endDate) {
        params.append('endDate', appliedFilters.endDate);
      }

      const { data } = await apiClient.get(`/api/admin/vacation-updates?${params.toString()}`);

      if (data.success) {
        setUpdates(data.data || []);
        setTotalCount(data.pagination?.total || 0);
      } else {
        toast.error(data.message || 'Failed to fetch vacation updates');
      }
    } catch (error) {
      console.error('Error fetching vacation updates:', error);
      toast.error('Failed to fetch vacation updates');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = () => {
    setAppliedFilters({
      doctorId,
      leaveType,
      startDate,
      endDate,
    });
    setPage(1);
  };

  const handleClearFilters = () => {
    setDoctorId('all');
    setLeaveType('all');
    setStartDate('');
    setEndDate('');
    setAppliedFilters({
      doctorId: 'all',
      leaveType: 'all',
      startDate: '',
      endDate: '',
    });
    setPage(1);
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

  const getLeaveTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      vacation: 'bg-blue-100 text-blue-700',
      sick: 'bg-red-100 text-red-700',
      personal: 'bg-purple-100 text-purple-700',
      emergency: 'bg-orange-100 text-orange-700',
      other: 'bg-gray-100 text-gray-700',
    };
    return colors[type] || colors.other;
  };

  const columns: AdminDataTableColumn<VacationUpdate>[] = [
    { id: 'createdAt', label: 'Created', widthClassName: 'w-[190px]', cell: (update) => <span className="text-sm text-slate-600">{formatDateTime(update.createdAt)}</span> },
    { id: 'doctor', label: 'Doctor', widthClassName: 'w-[220px]', cell: (update) => <span className="font-medium text-slate-900">{update.doctorName}</span> },
    { id: 'leaveType', label: 'Leave type', widthClassName: 'w-[150px]', cell: (update) => <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${getLeaveTypeColor(update.leaveType)}`}>{update.leaveType}</span> },
    { id: 'startDate', label: 'Start date', widthClassName: 'w-[140px]', cell: (update) => <span className="text-slate-600">{formatDate(update.startDate)}</span> },
    { id: 'endDate', label: 'End date', widthClassName: 'w-[140px]', cell: (update) => <span className="text-slate-600">{formatDate(update.endDate)}</span> },
    { id: 'duration', label: 'Duration', widthClassName: 'w-[120px]', cell: (update) => <span className="text-slate-600">{update.durationDays} day{update.durationDays !== 1 ? 's' : ''}</span> },
    { id: 'reason', label: 'Reason', widthClassName: 'w-[260px]', cell: (update) => <span className="block max-w-[240px] truncate text-sm text-slate-600" title={update.reason || undefined}>{update.reason || '—'}</span> },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader 
        title="Vacation Updates" 
        description="View all doctor vacation and leave updates"
      />

      <div className="p-8 space-y-6">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-slate-600" />
            <h3 className="text-lg font-semibold text-slate-900">Filters</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Doctor Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Doctor</label>
              <Select value={doctorId} onValueChange={setDoctorId} disabled={loadingDoctors}>
                <SelectTrigger>
                  <SelectValue placeholder="All Doctors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Doctors</SelectItem>
                  {doctors.map((doctor) => (
                    <SelectItem key={doctor.id} value={doctor.id}>
                      {doctor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Leave Type Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Leave Type</label>
              <Select value={leaveType} onValueChange={setLeaveType}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="vacation">Vacation</SelectItem>
                  <SelectItem value="sick">Sick</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
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

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {loading ? <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-teal-600" /></div> : <AdminDataTable columns={columns} data={updates} emptyMessage="No vacation updates found" getRowKey={(update) => update.id} minWidthClassName="min-w-[1200px]" pagination={{ page, pageSize, total: totalCount, onPageChange: setPage, onPageSizeChange: (size) => { setPageSize(size); setPage(1); }, disabled: loading }} />}
        </div>
      </div>
    </div>
  );
}
