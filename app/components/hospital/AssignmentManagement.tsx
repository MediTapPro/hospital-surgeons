'use client';

import { useState, useEffect } from 'react';
import type { DateRange } from 'react-day-picker';
import { Search, Filter, Clock, CheckCircle, XCircle, AlertCircle, MessageSquare, Phone, Calendar as CalendarIcon, Loader2, X, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { Calendar as DateCalendar } from '../../components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Label } from '../../components/ui/label';
import { useRouter } from 'next/navigation';
import { PageHeader } from '../../hospital/_components/PageHeader';
import { cn } from '../../components/ui/utils';
import apiClient from '@/lib/api/httpClient';

export function AssignmentManagement() {
  const formatDateYYYYMMDD = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const router = useRouter();
  
  const onNavigate = (page: string) => {
    router.push(`/hospital/${page}`);
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [tempSearchQuery, setTempSearchQuery] = useState('');
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingAssignment, setCancellingAssignment] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [tempStatusFilter, setTempStatusFilter] = useState('all');
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>(undefined);
  const [tempSelectedDateRange, setTempSelectedDateRange] = useState<DateRange | undefined>(undefined);
  const [hospitalId, setHospitalId] = useState<string | null>(null);
  const [usage, setUsage] = useState<any>(null);
  const [paymentInfo, setPaymentInfo] = useState<any>(null);
  const [completingPayment, setCompletingPayment] = useState(false);

  useEffect(() => {
    fetchHospitalProfile();
  }, []);

  const fetchHospitalProfile = async () => {
    try {
      const response = await apiClient.get('/api/hospitals/profile');
      const data = response.data;
      if (data.success && data.data) {
        setHospitalId(data.data.id);
      } else {
        setError(data.message || 'Failed to load hospital profile');
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Error fetching hospital profile:', err);
      if (err.response?.status === 401) {
        router.push('/login');
        return;
      }
      setError(err.response?.data?.message || 'Failed to load hospital profile');
      setLoading(false);
    }
  };

  const fetchUsage = async () => {
    if (!hospitalId) return;
    
    try {
      const response = await apiClient.get(`/api/hospitals/${hospitalId}/usage`);
      const result = response.data;
      if (result.success && result.data) {
        // Extract assignment usage from the combined usage response
        setUsage({
          used: result.data.assignments.used,
          limit: result.data.assignments.limit,
          percentage: result.data.assignments.percentage,
          status: result.data.assignments.status,
          remaining: result.data.assignments.remaining,
          resetDate: result.data.resetDate,
          plan: result.data.plan,
        });
      }
    } catch (error) {
      console.error('Error fetching usage:', error);
    }
  };

  const fetchAssignments = async (dateRangeOverride?: DateRange, statusOverride?: string, searchOverride?: string) => {
    if (!hospitalId) return;
    
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      const statusToUse = statusOverride !== undefined ? statusOverride : statusFilter;
      if (statusToUse !== 'all') {
        params.append('status', statusToUse);
      }
      const dateRangeToUse = dateRangeOverride || selectedDateRange;
      if (dateRangeToUse?.from) {
        const fromStr = formatDateYYYYMMDD(dateRangeToUse.from);
        const toStr = formatDateYYYYMMDD(dateRangeToUse.to ?? dateRangeToUse.from);
        params.append('from', fromStr);
        params.append('to', toStr);
      }
      const searchToUse = searchOverride !== undefined ? searchOverride : searchQuery;
      if (searchToUse) {
        params.append('search', searchToUse);
      }
      
      const response = await apiClient.get(`/api/hospitals/${hospitalId}/assignments?${params.toString()}`);
      const result = response.data;
      
      if (result.success && result.data) {
        // Format the data to match the component's expected structure
        const formattedAssignments = result.data.map((assignment: any) => {
          // Format time from HH:MM:SS to readable format
          let formattedTime = assignment.time || 'TBD';
          if (formattedTime !== 'TBD' && formattedTime.includes(':')) {
            const [hours, minutes] = formattedTime.split(':');
            const hour = parseInt(hours);
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
            formattedTime = `${displayHour}:${minutes} ${ampm}`;
          }
          
          return {
            id: assignment.id,
            patient: assignment.patient || 'Unknown',
            condition: assignment.condition || 'N/A',
            doctor: assignment.doctor || 'Unknown',
            doctorAddress: assignment.doctorAddress || null,
            specialty: assignment.specialty || 'General',
            date: assignment.date || '',
            time: formattedTime,
            status: assignment.status,
            priority: assignment.priority || 'routine',
            createdAt: assignment.createdAt ? new Date(assignment.createdAt).toLocaleString() : '',
            acceptedAt: assignment.acceptedAt ? new Date(assignment.acceptedAt).toLocaleString() : null,
            declinedAt: assignment.declinedAt ? new Date(assignment.declinedAt).toLocaleString() : null,
            cancelledAt: assignment.cancelledAt ? new Date(assignment.cancelledAt).toLocaleString() : null,
            completedAt: assignment.completedAt ? new Date(assignment.completedAt).toLocaleString() : null,
            expiresIn: assignment.expiresIn || null,
            fee: assignment.fee || 0,
            declineReason: assignment.declineReason || null,
            cancellationReason: assignment.cancellationReason || null,
            treatmentNotes: assignment.treatmentNotes || null,
          };
        });
        setAssignments(formattedAssignments);
      } else {
        setError(result.message || 'Failed to load assignments');
        setAssignments([]);
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
      setError('Failed to load assignments');
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 gap-1">
            <Clock className="w-3 h-3" />
            Pending
          </Badge>
        );
      case 'accepted':
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100 gap-1">
            <CheckCircle className="w-3 h-3" />
            Accepted
          </Badge>
        );
      case 'declined':
        return (
          <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-100 gap-1">
            <XCircle className="w-3 h-3" />
            Declined
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="destructive" className="bg-orange-100 text-orange-800 hover:bg-orange-100 gap-1">
            <XCircle className="w-3 h-3" />
            Cancelled
          </Badge>
        );
      case 'completed':
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 gap-1">
            <CheckCircle className="w-3 h-3" />
            Completed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-slate-100 text-slate-800">
            {status}
          </Badge>
        );
    }
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      routine: 'bg-gray-100 text-gray-800',
      urgent: 'bg-orange-100 text-orange-800',
      emergency: 'bg-red-100 text-red-800',
    };
    return (
      <Badge variant="outline" className={colors[priority as keyof typeof colors] || ''}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </Badge>
    );
  };

  const handleViewDetails = async (assignment: any) => {
    setSelectedAssignment(assignment);
    setShowDetails(true);
    
    // Fetch payment info if assignment is completed
    if (assignment.status === 'completed') {
      try {
        const response = await apiClient.get(`/api/assignments/${assignment.id}/payment`);
        if (response.data.success && response.data.data) {
          setPaymentInfo(response.data.data);
        } else {
          setPaymentInfo(null);
        }
      } catch (error) {
        console.error('Error fetching payment info:', error);
        setPaymentInfo(null);
      }
    } else {
      setPaymentInfo(null);
    }
  };

  const handleCompletePayment = async () => {
    if (!selectedAssignment || completingPayment) return;

    try {
      setCompletingPayment(true);
      const response = await apiClient.patch(`/api/assignments/${selectedAssignment.id}/payment`);
      
      if (response.data.success) {
        // Refresh payment info
        const paymentResponse = await apiClient.get(`/api/assignments/${selectedAssignment.id}/payment`);
        if (paymentResponse.data.success && paymentResponse.data.data) {
          setPaymentInfo(paymentResponse.data.data);
        }
        // Refresh assignments list
        fetchAssignments();
        alert('Payment marked as completed successfully');
      } else {
        alert(response.data.message || 'Failed to complete payment');
      }
    } catch (error: any) {
      console.error('Error completing payment:', error);
      alert(error.response?.data?.message || 'Failed to complete payment');
    } finally {
      setCompletingPayment(false);
    }
  };

  const handleCancelAssignment = (assignment: any) => {
    setSelectedAssignment(assignment);
    setShowCancelModal(true);
  };

  const getCancellationWarning = (hoursUntil: number) => {
    if (hoursUntil > 24) {
      return { color: 'green', message: 'No penalty - Cancellation allowed', severity: 'info' };
    } else if (hoursUntil > 12) {
      return { color: 'yellow', message: 'Warning: Cancellation will be flagged', severity: 'warning' };
    } else if (hoursUntil > 6) {
      return { color: 'orange', message: 'Penalty: Counts toward 3-flag limit', severity: 'warning' };
    } else {
      return { color: 'red', message: 'Cannot cancel - Must contact doctor directly', severity: 'error' };
    }
  };

  // Initial fetch when hospitalId is available
  useEffect(() => {
    if (hospitalId) {
      fetchAssignments();
    }
  }, [hospitalId]);

  const filterByStatus = (status: string) => {
    // API already filters by status, but we can do client-side filtering for 'all'
    if (status === 'all') return assignments;
    return assignments.filter(a => a.status === status);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader 
        title="Assignment Management" 
        description="Track and manage all doctor assignments"
      />
      <div className="p-8">
      {loading && !hospitalId ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading hospital profile...</p>
        </div>
      ) : error && !hospitalId ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      ) : (
      <div className="space-y-6">
        {/* Usage Banner */}
        {usage && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {usage.used} / {usage.limit === -1 ? 'Unlimited' : usage.limit} assignments used this month
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  Resets on {new Date(usage.resetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              {usage.status === 'reached' && (
                <button
                  onClick={() => router.push('/hospital/subscriptions')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
                >
                  Upgrade Plan
                </button>
              )}
            </div>
            {usage.limit !== -1 && (
              <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    usage.status === 'reached' ? 'bg-red-500' :
                    usage.status === 'critical' ? 'bg-orange-500' :
                    usage.status === 'warning' ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(usage.percentage, 100)}%` }}
                />
              </div>
            )}
            {(usage.status === 'critical' || usage.status === 'warning') && (
              <div className={`mt-3 p-3 rounded-lg text-xs ${
                usage.status === 'critical' 
                  ? 'bg-orange-50 text-orange-700 border border-orange-200' 
                  : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
              }`}>
                ⚠️ Almost at limit! {usage.remaining} assignment{usage.remaining !== 1 ? 's' : ''} remaining. 
                <button
                  onClick={() => router.push('/hospital/subscriptions')}
                  className="ml-2 underline font-medium"
                >
                  View Plans
                </button>
              </div>
            )}
          </div>
        )}

        {/* Header Section */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Assignment Management</h2>
              <p className="text-slate-600 text-sm mt-1">Track and manage all doctor assignments</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mb-6">
              {error}
            </div>
          )}

          {/* Search and Filters - All in One Line */}
          <div className="flex items-end gap-3 mb-6">
            {/* Search Bar */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search by patient name, doctor, or condition..."
                value={tempSearchQuery || searchQuery}
                onChange={(e) => setTempSearchQuery(e.target.value)}
                className="pl-10 h-10 text-base"
              />
            </div>

            {/* Date Filter */}
            <div className="w-[200px]">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full h-10 justify-start text-left font-normal border-slate-300"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-slate-500" />
                    {tempSelectedDateRange?.from
                      ? tempSelectedDateRange.to
                        ? `${formatDateYYYYMMDD(tempSelectedDateRange.from)} - ${formatDateYYYYMMDD(tempSelectedDateRange.to)}`
                        : formatDateYYYYMMDD(tempSelectedDateRange.from)
                      : selectedDateRange?.from
                        ? selectedDateRange.to
                          ? `${formatDateYYYYMMDD(selectedDateRange.from)} - ${formatDateYYYYMMDD(selectedDateRange.to)}`
                          : formatDateYYYYMMDD(selectedDateRange.from)
                        : 'Select date range'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <DateCalendar
                    mode="range"
                    selected={tempSelectedDateRange ?? selectedDateRange}
                    onSelect={(range) => {
                      setTempSelectedDateRange(range);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Status Filter */}
            <div className="w-[180px]">
              <Select value={tempStatusFilter} onValueChange={setTempStatusFilter}>
                <SelectTrigger className="w-full h-10">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="declined">Needs Action</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Clear Button */}
            {(tempSearchQuery || tempSelectedDateRange || tempStatusFilter !== 'all' || searchQuery || selectedDateRange || statusFilter !== 'all') && (
              <Button
                variant="outline"
                onClick={() => {
                  setTempSearchQuery('');
                  setTempSelectedDateRange(undefined);
                  setTempStatusFilter('all');
                  setSearchQuery('');
                  setSelectedDateRange(undefined);
                  setStatusFilter('all');
                  fetchAssignments(undefined, 'all', '');
                }}
                className="h-10 px-4 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              >
                Clear
              </Button>
            )}

            {/* Apply Button */}
            <Button
              onClick={() => {
                const dateRangeToApply = tempSelectedDateRange ?? selectedDateRange;
                const statusToApply = tempStatusFilter;
                const searchToApply = tempSearchQuery.trim();
                setSelectedDateRange(dateRangeToApply);
                setStatusFilter(statusToApply);
                setSearchQuery(searchToApply);
                setTempSelectedDateRange(dateRangeToApply);
                setTempStatusFilter(statusToApply);
                setTempSearchQuery('');
                fetchAssignments(dateRangeToApply, statusToApply, searchToApply);
              }}
              className="h-10 px-6 bg-teal-600 hover:bg-teal-700 text-white"
            >
              Apply
            </Button>
          </div>
        </div>

        {/* Assignments Table */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden mt-6 relative z-0">
          <div className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                      <span className="text-slate-600">Loading assignments...</span>
                    </div>
                  </div>
                ) : filterByStatus(statusFilter).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4">
                    <CalendarIcon className="w-12 h-12 text-slate-400 mb-3" />
                    <p className="text-slate-600 font-medium">No assignments found</p>
                    <p className="text-slate-500 text-sm mt-1">Try adjusting your filters or search query</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 hover:bg-slate-50">
                          <TableHead className="font-semibold text-slate-900">Patient</TableHead>
                          <TableHead className="font-semibold text-slate-900">Condition</TableHead>
                          <TableHead className="font-semibold text-slate-900">Doctor</TableHead>
                          <TableHead className="font-semibold text-slate-900">Date & Time</TableHead>
                          <TableHead className="font-semibold text-slate-900">Priority</TableHead>
                          <TableHead className="font-semibold text-slate-900">Status</TableHead>
                          <TableHead className="font-semibold text-slate-900 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filterByStatus(statusFilter).map((assignment) => (
                          <TableRow 
                            key={assignment.id}
                            className="hover:bg-slate-50/50 transition-colors"
                          >
                            <TableCell className="py-4">
                              <div>
                                <p className="font-medium text-slate-900">{assignment.patient}</p>
                              </div>
                            </TableCell>
                            <TableCell className="py-4">
                              <span className="text-slate-700">{assignment.condition}</span>
                            </TableCell>
                            <TableCell className="py-4">
                              <div>
                                <p className="font-medium text-slate-900">{assignment.doctor}</p>
                                <p className="text-sm text-slate-500 mt-0.5">{assignment.specialty}</p>
                                {assignment.doctorAddress && (
                                  <p className="text-xs text-slate-500 mt-0.5">{assignment.doctorAddress}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="py-4">
                              <div className="flex items-center gap-2">
                                <CalendarIcon className="w-4 h-4 text-slate-400" />
                                <div>
                                  <p className="text-slate-900 font-medium">
                                    {assignment.date ? new Date(assignment.date).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric'
                                    }) : 'TBD'}
                                  </p>
                                  <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                                    <Clock className="w-3 h-3" />
                                    {assignment.time}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-4">
                              {getPriorityBadge(assignment.priority)}
                            </TableCell>
                            <TableCell className="py-4">
                              <div className="space-y-1">
                                {getStatusBadge(assignment.status)}
                                {assignment.status === 'pending' && assignment.expiresIn && (
                                  <p className="text-xs text-yellow-600 font-medium">Expires in {assignment.expiresIn}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="py-4">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewDetails(assignment)}
                                  className="text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                                >
                                  View
                                </Button>
                                {assignment.status === 'declined' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onNavigate('find-doctors')}
                                    className="border-teal-300 text-teal-700 hover:bg-teal-50"
                                  >
                                    Find Doctor
                                  </Button>
                                )}
                                {(assignment.status === 'pending' || assignment.status === 'accepted') && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleCancelAssignment(assignment)}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    Cancel
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </div>
      )}
      </div>

      {/* Assignment Details Modal */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assignment Details</DialogTitle>
          </DialogHeader>

          {selectedAssignment && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-gray-900">Status</h3>
                {getStatusBadge(selectedAssignment.status)}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <h3 className="text-gray-900 mb-2">Patient Information</h3>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-gray-500">Name:</span> {selectedAssignment.patient}</p>
                    <p><span className="text-gray-500">Condition:</span> {selectedAssignment.condition}</p>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-lg">
                  <h3 className="text-gray-900 mb-2">Doctor Information</h3>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-gray-500">Name:</span> {selectedAssignment.doctor}</p>
                    <p><span className="text-gray-500">Specialty:</span> {selectedAssignment.specialty}</p>
                    {selectedAssignment.doctorAddress && (
                      <p><span className="text-gray-500">Address:</span> {selectedAssignment.doctorAddress}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg">
                <h3 className="text-gray-900 mb-2">Schedule</h3>
                <div className="space-y-1 text-sm">
                  <p><span className="text-gray-500">Date:</span> {new Date(selectedAssignment.date).toLocaleDateString()}</p>
                  <p><span className="text-gray-500">Time:</span> {selectedAssignment.time}</p>
                  <p><span className="text-gray-500">Priority:</span> <span className="capitalize">{selectedAssignment.priority}</span></p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg">
                <h3 className="text-gray-900 mb-2">Timeline</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                    <span className="text-gray-500">Created:</span>
                    <span>{selectedAssignment.createdAt}</span>
                  </div>
                  {selectedAssignment.acceptedAt && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-600"></div>
                      <span className="text-gray-500">Accepted:</span>
                      <span>{selectedAssignment.acceptedAt}</span>
                    </div>
                  )}
                  {selectedAssignment.declinedAt && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-600"></div>
                      <span className="text-gray-500">Declined:</span>
                      <span>{selectedAssignment.declinedAt}</span>
                    </div>
                  )}
                  {selectedAssignment.cancelledAt && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-orange-600"></div>
                      <span className="text-gray-500">Cancelled:</span>
                      <span>{selectedAssignment.cancelledAt}</span>
                    </div>
                  )}
                  {selectedAssignment.completedAt && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                      <span className="text-gray-500">Completed:</span>
                      <span>{selectedAssignment.completedAt}</span>
                    </div>
                  )}
                </div>
              </div>

              {selectedAssignment.status === 'declined' && selectedAssignment.declineReason && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <span className="font-medium">Decline Reason:</span> {selectedAssignment.declineReason}
                  </AlertDescription>
                </Alert>
              )}

              {selectedAssignment.status === 'cancelled' && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <span className="font-medium">Cancellation Reason:</span>{' '}
                    {selectedAssignment.cancellationReason || 'No reason provided'}
                  </AlertDescription>
                </Alert>
              )}

              {selectedAssignment.status === 'completed' && selectedAssignment.treatmentNotes && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <span className="font-medium">Treatment Notes:</span>
                    <p className="mt-2 whitespace-pre-wrap">{selectedAssignment.treatmentNotes}</p>
                  </AlertDescription>
                </Alert>
              )}

              {selectedAssignment.status === 'accepted' && (
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Message Doctor
                  </Button>
                  <Button variant="outline" className="flex-1 gap-2">
                    <Phone className="w-4 h-4" />
                    Call Doctor
                  </Button>
                </div>
              )}

              {/* Payment Information for Completed Assignments */}
              {selectedAssignment.status === 'completed' && (
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <h3 className="text-gray-900 mb-3 font-medium flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Payment Information
                  </h3>
                  {paymentInfo ? (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Consultation Fee:</span>
                        <span className="font-medium text-gray-900">₹{parseFloat(paymentInfo.consultationFee?.toString() || '0')}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Doctor Payout:</span>
                        <span className="font-medium text-gray-900">₹{parseFloat(paymentInfo.doctorPayout?.toString() || '0')}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-green-200">
                        <span className="text-gray-900 font-medium">Payment Status:</span>
                        <Badge className={
                          paymentInfo.paymentStatus === 'completed' 
                            ? 'bg-green-100 text-green-800'
                            : paymentInfo.paymentStatus === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-blue-100 text-blue-800'
                        }>
                          {paymentInfo.paymentStatus === 'completed' ? 'Completed' : paymentInfo.paymentStatus === 'pending' ? 'Pending' : 'Processing'}
                        </Badge>
                      </div>
                      {paymentInfo.paidToDoctorAt && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Paid to Doctor:</span>
                          <span className="text-gray-900">{new Date(paymentInfo.paidToDoctorAt).toLocaleString()}</span>
                        </div>
                      )}
                      {paymentInfo.paymentStatus === 'pending' && (
                        <Button 
                          onClick={handleCompletePayment}
                          disabled={completingPayment}
                          className="w-full mt-3 bg-green-600 hover:bg-green-700 text-white"
                        >
                          {completingPayment ? 'Completing...' : 'Mark Payment as Completed'}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600">
                      <p>Payment record is being created...</p>
                    </div>
                  )}
                </div>
              )}

              {selectedAssignment.status !== 'completed' && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-blue-900">Consultation Fee</span>
                    <span className="text-blue-900">₹{selectedAssignment.fee}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetails(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Assignment Modal */}
      <Dialog open={showCancelModal} onOpenChange={(open) => {
        if (!cancellingAssignment) {
          setShowCancelModal(open);
          if (!open) {
            setCancellationReason('');
          }
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Assignment</DialogTitle>
            <DialogDescription>
              Review the cancellation policy before proceeding
            </DialogDescription>
          </DialogHeader>

          {selectedAssignment && (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <span className="font-medium">Cancellation Policy:</span> Cancellations within 6 hours of the appointment require direct contact with the doctor.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Cancellation Reason (Optional)</Label>
                <Textarea 
                  placeholder="Please provide a reason for cancellation..." 
                  rows={3}
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                />
              </div>

              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  This will notify the doctor and free up the time slot. The patient will need to be reassigned to another doctor.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              if (!cancellingAssignment) {
                setShowCancelModal(false);
                setCancellationReason('');
              }
            }} disabled={cancellingAssignment}>
              Keep Assignment
            </Button>
            <Button
              variant="destructive"
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={async () => {
                if (cancellingAssignment || !selectedAssignment) return;
                try {
                  setCancellingAssignment(true);
                  
                  const response = await apiClient.patch(
                    `/api/assignments/${selectedAssignment.id}/status`,
                    {
                      status: 'cancelled',
                      cancellationReason: cancellationReason || undefined,
                    }
                  );

                  if (response.data.success) {
                    setShowCancelModal(false);
                    setCancellationReason('');
                    alert('Assignment cancelled successfully');
                    fetchAssignments(); // Refresh the list
                  } else {
                    alert(response.data.message || 'Failed to cancel assignment');
                  }
                } catch (error: any) {
                  console.error('Error cancelling assignment:', error);
                  const errorMessage = error.response?.data?.message || 'Failed to cancel assignment';
                  alert(errorMessage);
                } finally {
                  setCancellingAssignment(false);
                }
              }}
              disabled={cancellingAssignment}
            >
              {cancellingAssignment ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Cancelling...
                </>
              ) : (
                'Confirm Cancellation'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
