'use client';

import { useState, useEffect } from 'react';
import { Search, Clock, CheckCircle, XCircle, AlertCircle, Calendar as CalendarIcon, Building2, User, Loader2, DollarSign } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
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
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth/utils';
import apiClient from '@/lib/api/httpClient';

interface Assignment {
  id: string;
  patient: string;
  condition: string;
  hospital: string;
  date: string;
  time: string;
  endTime: string | null;
  status: string;
  priority: string;
  createdAt: string;
  acceptedAt: string | null;
  declinedAt: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  expiresIn: string | null;
  expiresAt?: string | null;
  fee: number;
  declineReason: string | null;
  cancellationReason: string | null;
  treatmentNotes?: string | null;
  hospitalId: string;
  patientId: string;
  parentSlotId?: string | null;
  availabilitySlotId?: string | null;
}

export default function AssignmentsPage() {
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tempSearchQuery, setTempSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [tempFromDate, setTempFromDate] = useState<string>('');
  const [tempToDate, setTempToDate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tempStatusFilter, setTempStatusFilter] = useState('all');
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [treatmentNotes, setTreatmentNotes] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [usage, setUsage] = useState<any>(null);
  const [paymentInfo, setPaymentInfo] = useState<any>(null);

  useEffect(() => {
    if (isAuthenticated()) {
      fetchDoctorProfile();
    } else {
      router.push('/login');
    }
  }, []);

  useEffect(() => {
    if (doctorId) {
      fetchAssignments();
      fetchUsage();
    }
  }, [doctorId]);

  const fetchUsage = async () => {
    if (!doctorId) return;
    
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/doctors/${doctorId}/assignment-usage`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (result.success) {
        setUsage(result.data);
      }
    } catch (error) {
      console.error('Error fetching usage:', error);
    }
  };

  const fetchDoctorProfile = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/doctors/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      
      if (response.status === 404 || !data.success) {
        setError('Please complete your profile first');
        setLoading(false);
        return;
      }
      
      if (data.success && data.data && data.data.id) {
        setDoctorId(data.data.id);
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

  const fetchAssignments = async (
    fromOverride?: string,
    toOverride?: string,
    statusOverride?: string,
    searchOverride?: string
  ) => {
    if (!doctorId) return;
    
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('accessToken');
      const params = new URLSearchParams();
      
      const statusToUse = statusOverride !== undefined ? statusOverride : statusFilter;
      if (statusToUse !== 'all') {
        params.append('status', statusToUse);
      }
      
      const fromToUse = fromOverride !== undefined ? fromOverride : fromDate;
      const toToUse = toOverride !== undefined ? toOverride : toDate;
      if (fromToUse) {
        params.append('from', fromToUse);
      }
      if (toToUse) {
        params.append('to', toToUse);
      }
      
      const searchToUse = searchOverride !== undefined ? searchOverride : searchQuery;
      if (searchToUse) {
        params.append('search', searchToUse);
      }
      
      const response = await fetch(`/api/doctors/${doctorId}/assignments?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      
      if (result.success && result.data) {
        setAssignments(result.data);
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

  const handleApplyFilters = () => {
    setSearchQuery(tempSearchQuery);
    setStatusFilter(tempStatusFilter);
    setFromDate(tempFromDate);
    setToDate(tempToDate);
    fetchAssignments(tempFromDate, tempToDate, tempStatusFilter, tempSearchQuery);
  };

  const handleClearFilters = () => {
    setTempSearchQuery('');
    setTempFromDate('');
    setTempToDate('');
    setTempStatusFilter('all');
    setSearchQuery('');
    setFromDate('');
    setToDate('');
    setStatusFilter('all');
    fetchAssignments('', '', 'all', '');
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
      case 'completed':
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 gap-1">
            <CheckCircle className="w-3 h-3" />
            Completed
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="outline" className="bg-gray-100 text-gray-600 hover:bg-gray-100 gap-1">
            <XCircle className="w-3 h-3" />
            Cancelled
          </Badge>
        );
      default:
        return null;
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

  const handleViewDetails = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setShowDetails(true);
    setDeclineReason('');
    setTreatmentNotes('');
    
    // Fetch payment info if assignment is completed
    if (assignment.status === 'completed') {
      fetchPaymentInfo(assignment.id);
    } else {
      setPaymentInfo(null);
    }
  };

  const handleAcceptAssignment = async () => {
    if (!selectedAssignment) return;

    try {
      setUpdatingStatus(true);
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch(`/api/assignments/${selectedAssignment.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: 'accepted',
        }),
      });

      const result = await response.json();

      if (result.success) {
        setShowDetails(false);
        await fetchAssignments(); // Refresh the list
        alert('Assignment accepted successfully!');
      } else {
        alert(result.message || 'Failed to accept assignment');
      }
    } catch (error) {
      console.error('Error accepting assignment:', error);
      alert('An error occurred while accepting the assignment');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDeclineAssignment = async () => {
    if (!selectedAssignment) return;

    try {
      setUpdatingStatus(true);
      const token = localStorage.getItem('accessToken');
      
      // Determine status based on current assignment status
      const targetStatus = selectedAssignment.status === 'accepted' ? 'cancelled' : 'declined';
      
      const response = await fetch(`/api/assignments/${selectedAssignment.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: targetStatus,
          cancellationReason: declineReason || undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setShowDeclineModal(false);
        setDeclineReason('');
        setShowDetails(false);
        await fetchAssignments(); // Refresh the list
        const successMessage = targetStatus === 'cancelled' 
          ? 'Assignment cancelled successfully' 
          : 'Assignment declined successfully';
        alert(successMessage);
      } else {
        alert(result.message || `Failed to ${targetStatus} assignment`);
      }
    } catch (error) {
      console.error(`Error ${selectedAssignment.status === 'accepted' ? 'cancelling' : 'declining'} assignment:`, error);
      alert(`An error occurred while ${selectedAssignment.status === 'accepted' ? 'cancelling' : 'declining'} the assignment`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const openDeclineModal = () => {
    setShowDeclineModal(true);
  };

  const closeDeclineModal = (open?: boolean) => {
    // Only close if explicitly set to false, or if updatingStatus is false
    if (open === false && !updatingStatus) {
      setShowDeclineModal(false);
      setDeclineReason('');
    } else if (open === true) {
      // Allow opening
      setShowDeclineModal(true);
    }
  };

  const openCompleteModal = () => {
    setShowCompleteModal(true);
  };

  const closeCompleteModal = () => {
    setShowCompleteModal(false);
    setTreatmentNotes('');
  };

  const fetchPaymentInfo = async (assignmentId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/assignments/${assignmentId}/payment`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await response.json();
      if (result.success && result.data) {
        setPaymentInfo(result.data);
      } else {
        setPaymentInfo(null);
      }
    } catch (error) {
      console.error('Error fetching payment info:', error);
      setPaymentInfo(null);
    }
  };

  const handleCompleteAssignment = async () => {
    if (!selectedAssignment) return;

    try {
      setUpdatingStatus(true);
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch(`/api/assignments/${selectedAssignment.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: 'completed',
          treatmentNotes: treatmentNotes || undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setShowDetails(false);
        setShowCompleteModal(false);
        setTreatmentNotes('');
        await fetchAssignments(); // Refresh the list
        alert('Assignment marked as completed successfully!');
      } else {
        alert(result.message || 'Failed to complete assignment');
      }
    } catch (error) {
      console.error('Error completing assignment:', error);
      alert('An error occurred while completing the assignment');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const filteredAssignments = assignments.filter(assignment => {
    if (statusFilter !== 'all' && assignment.status !== statusFilter) {
      return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        assignment.patient.toLowerCase().includes(query) ||
        assignment.hospital.toLowerCase().includes(query) ||
        assignment.condition.toLowerCase().includes(query)
      );
    }
    return true;
  });

  if (loading && !doctorId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-600 mb-4" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !doctorId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-gray-900 mb-2 text-2xl font-bold">Assignments</h1>
          <p className="text-gray-600">View and manage your assignments</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-gray-900 mb-2 text-2xl font-bold">Assignments</h1>
        <p className="text-gray-600">View and manage your assignments</p>
      </div>

      {/* Usage Banner */}
      {usage && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
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
                onClick={() => router.push('/doctor/subscriptions')}
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
                onClick={() => router.push('/doctor/subscriptions')}
                className="ml-2 underline font-medium"
              >
                View Plans
              </button>
            </div>
          )}
        </div>
      )}

      {/* Search and Filters - All in One Line */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-end gap-3">
          {/* Search Bar */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Search by patient, hospital, or condition..."
              value={tempSearchQuery || searchQuery}
              onChange={(e) => setTempSearchQuery(e.target.value)}
              className="pl-10 h-10 text-base"
            />
          </div>

          {/* Date Filter */}
          <div className="w-[200px]">
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <input
                  type="date"
                  value={tempFromDate || fromDate}
                  onChange={(e) => {
                    setTempFromDate(e.target.value);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] pr-10 h-10"
                />
                <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              <div className="relative">
                <input
                  type="date"
                  value={tempToDate || toDate}
                  onChange={(e) => {
                    setTempToDate(e.target.value);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] pr-10 h-10"
                />
                <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
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
                <SelectItem value="declined">Declined</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Clear Button */}
          {(tempSearchQuery || tempFromDate || tempToDate || tempStatusFilter !== 'all' || searchQuery || fromDate || toDate || statusFilter !== 'all') ? (
            <Button
              variant="outline"
              onClick={handleClearFilters}
              className="h-10 px-4 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            >
              Clear
            </Button>
          ) : null}

          {/* Apply Button */}
          <Button
            onClick={handleApplyFilters}
            className="h-10 px-6 bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
          >
            Apply
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Assignments Table */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient</TableHead>
              <TableHead>Condition</TableHead>
              <TableHead>Hospital</TableHead>
              <TableHead>Date & Time</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
                    <span className="text-gray-500">Loading assignments...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : assignments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-gray-500">
                  No assignments found
                </TableCell>
              </TableRow>
            ) : (
              assignments.map((assignment) => (
                <TableRow key={assignment.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span>{assignment.patient}</span>
                    </div>
                  </TableCell>
                  <TableCell>{assignment.condition}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      <span>{assignment.hospital}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="flex items-center gap-1">
                        <CalendarIcon className="w-4 h-4 text-gray-400" />
                        {assignment.date ? new Date(assignment.date).toLocaleDateString() : 'TBD'}
                      </p>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {assignment.time}
                        {assignment.endTime && ` - ${assignment.endTime}`}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>{getPriorityBadge(assignment.priority)}</TableCell>
                  <TableCell>
                    <div>
                      {(() => {
                        // Check if assignment is expired (even if status is still pending)
                        const isExpired = assignment.status === 'pending' && assignment.expiresAt
                          ? new Date(assignment.expiresAt) < new Date()
                          : false;

                        if (isExpired) {
                          return (
                            <div>
                              <Badge variant="outline" className="bg-orange-100 text-orange-800 hover:bg-orange-100 gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Expired
                              </Badge>
                              <p className="text-xs text-orange-600 mt-1">Will be cancelled automatically</p>
                            </div>
                          );
                        }

                        return (
                          <>
                            {getStatusBadge(assignment.status)}
                            {assignment.status === 'pending' && assignment.expiresIn && (
                              <p className="text-xs text-yellow-600 mt-1">Expires in {assignment.expiresIn}</p>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewDetails(assignment)}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Assignment Details Modal */}
      <Dialog open={showDetails} onOpenChange={(open) => {
        setShowDetails(open);
        if (!open) {
          setPaymentInfo(null);
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assignment Details</DialogTitle>
            <DialogDescription>
              View complete assignment information
            </DialogDescription>
          </DialogHeader>

          {selectedAssignment && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-gray-900">Status</h3>
                {getStatusBadge(selectedAssignment.status)}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <h3 className="text-gray-900 mb-2 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Patient Information
                  </h3>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-gray-500">Name:</span> {selectedAssignment.patient}</p>
                    <p><span className="text-gray-500">Condition:</span> {selectedAssignment.condition}</p>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-lg">
                  <h3 className="text-gray-900 mb-2 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Hospital Information
                  </h3>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-gray-500">Name:</span> {selectedAssignment.hospital}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg">
                <h3 className="text-gray-900 mb-2 flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  Schedule
                </h3>
                <div className="space-y-1 text-sm">
                  <p><span className="text-gray-500">Date:</span> {selectedAssignment.date ? new Date(selectedAssignment.date).toLocaleDateString() : 'TBD'}</p>
                  <p><span className="text-gray-500">Time:</span> {selectedAssignment.time}{selectedAssignment.endTime ? ` - ${selectedAssignment.endTime}` : ''}</p>
                  <p><span className="text-gray-500">Priority:</span> <span className="capitalize">{selectedAssignment.priority}</span></p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg">
                <h3 className="text-gray-900 mb-2">Timeline</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                    <span className="text-gray-500">Created:</span>
                    <span>{selectedAssignment.createdAt ? new Date(selectedAssignment.createdAt).toLocaleString() : 'N/A'}</span>
                  </div>
                  {selectedAssignment.acceptedAt && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-600"></div>
                      <span className="text-gray-500">Accepted:</span>
                      <span>{new Date(selectedAssignment.acceptedAt).toLocaleString()}</span>
                    </div>
                  )}
                  {selectedAssignment.declinedAt && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-600"></div>
                      <span className="text-gray-500">Declined:</span>
                      <span>{new Date(selectedAssignment.declinedAt).toLocaleString()}</span>
                    </div>
                  )}
                  {selectedAssignment.cancelledAt && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-orange-600"></div>
                      <span className="text-gray-500">Cancelled:</span>
                      <span>{new Date(selectedAssignment.cancelledAt).toLocaleString()}</span>
                    </div>
                  )}
                  {selectedAssignment.completedAt && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                      <span className="text-gray-500">Completed:</span>
                      <span>{new Date(selectedAssignment.completedAt).toLocaleString()}</span>
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

              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-blue-900">Consultation Fee</span>
                  <span className="text-blue-900 font-semibold">₹{selectedAssignment.fee}</span>
                </div>
              </div>

              {/* Action Buttons for Pending Assignments */}
              {selectedAssignment.status === 'pending' && (
                <div className="space-y-3 pt-4 border-t">
                  {(() => {
                    // Check if assignment is expired
                    const isExpired = selectedAssignment.expiresAt 
                      ? new Date(selectedAssignment.expiresAt) < new Date()
                      : false;

                    if (isExpired) {
                      return (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            <span className="font-medium">This assignment has expired.</span> It will be automatically cancelled. Please contact the hospital for a new assignment.
                          </AlertDescription>
                        </Alert>
                      );
                    }

                    if (selectedAssignment.expiresIn) {
                      return (
                        <Alert>
                          <Clock className="h-4 w-4" />
                          <AlertDescription>
                            This assignment expires in {selectedAssignment.expiresIn}. Please respond before it expires.
                          </AlertDescription>
                        </Alert>
                      );
                    }

                    return null;
                  })()}
                  <div className="flex gap-3">
                    <Button
                      onClick={handleAcceptAssignment}
                      disabled={updatingStatus || (selectedAssignment.expiresAt ? new Date(selectedAssignment.expiresAt) < new Date() : false)}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {updatingStatus ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Accepting...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Accept Assignment
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={openDeclineModal}
                      disabled={updatingStatus}
                      variant="destructive"
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Decline Assignment
                    </Button>
                  </div>
                </div>
              )}

              {/* Action Button for Accepted Assignments */}
              {selectedAssignment.status === 'accepted' && (
                <div className="space-y-3 pt-4 border-t">
                  <Button
                    onClick={openCompleteModal}
                    disabled={updatingStatus}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Mark as Completed
                  </Button>
                  <Button
                    onClick={openDeclineModal}
                    disabled={updatingStatus}
                    variant="destructive"
                    className="w-full bg-red-600 hover:bg-red-700 text-white"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Cancel Assignment
                  </Button>
                </div>
              )}

              {/* Treatment Notes for Completed Assignments */}
              {selectedAssignment.status === 'completed' && selectedAssignment.completedAt && (
                <div className="pt-4 border-t space-y-3">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="font-medium text-green-900">Assignment Completed</span>
                    </div>
                    <p className="text-sm text-green-700">
                      Completed on {new Date(selectedAssignment.completedAt).toLocaleString()}
                    </p>
                  </div>
                  {selectedAssignment.treatmentNotes && (
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-medium text-blue-900 mb-2">Treatment Notes</h4>
                      <p className="text-sm text-blue-800 whitespace-pre-wrap">{selectedAssignment.treatmentNotes}</p>
                    </div>
                  )}
                  
                  {/* Payment Information for Completed Assignments */}
                  {paymentInfo ? (
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <h3 className="text-gray-900 mb-3 font-medium flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Payment Information
                      </h3>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Consultation Fee:</span>
                          <span className="font-medium text-gray-900">₹{parseFloat(paymentInfo.consultationFee?.toString() || '0')}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Your Payout:</span>
                          <span className="font-medium text-green-600">₹{parseFloat(paymentInfo.doctorPayout?.toString() || '0')}</span>
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
                            <span className="text-gray-600">Paid on:</span>
                            <span className="text-gray-900">{new Date(paymentInfo.paidToDoctorAt).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                      <p className="text-sm text-yellow-800">
                        Payment record is being created. Please refresh to see payment details.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowDetails(false);
              setDeclineReason('');
            }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline/Cancel Assignment Modal */}
      <Dialog open={showDeclineModal} onOpenChange={(open) => {
        if (!updatingStatus) {
          setShowDeclineModal(open);
          if (!open) {
            setDeclineReason('');
          }
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedAssignment?.status === 'accepted' ? 'Cancel Assignment' : 'Decline Assignment'}
            </DialogTitle>
            <DialogDescription>
              {selectedAssignment?.status === 'accepted' 
                ? 'Please provide a reason for cancelling this assignment (optional)'
                : 'Please provide a reason for declining this assignment (optional)'}
            </DialogDescription>
          </DialogHeader>

          {selectedAssignment && (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {selectedAssignment?.status === 'accepted'
                    ? 'Cancelling this assignment will notify the hospital and release the time slot for other assignments.'
                    : 'Declining this assignment will notify the hospital and release the time slot for other assignments.'}
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>
                  {selectedAssignment?.status === 'accepted' ? 'Cancellation' : 'Decline'} Reason (Optional)
                </Label>
                <Textarea
                  placeholder={
                    selectedAssignment?.status === 'accepted'
                      ? "e.g., Emergency came up, Patient condition changed, Unable to proceed..."
                      : "e.g., Schedule conflict, Unable to accommodate on requested date..."
                  }
                  rows={4}
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  className="resize-none"
                />
                <p className="text-xs text-gray-500">
                  Providing a reason helps hospitals understand and may improve future assignment matching.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="space-y-1 text-sm">
                  <p><span className="text-gray-500">Patient:</span> {selectedAssignment.patient}</p>
                  <p><span className="text-gray-500">Hospital:</span> {selectedAssignment.hospital}</p>
                  <p><span className="text-gray-500">Date:</span> {selectedAssignment.date ? new Date(selectedAssignment.date).toLocaleDateString() : 'TBD'}</p>
                  <p><span className="text-gray-500">Time:</span> {selectedAssignment.time}</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              if (!updatingStatus) {
                setShowDeclineModal(false);
                setDeclineReason('');
              }
            }} disabled={updatingStatus}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDeclineAssignment}
              disabled={updatingStatus}
            >
              {updatingStatus ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {selectedAssignment?.status === 'accepted' ? 'Cancelling...' : 'Declining...'}
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  {selectedAssignment?.status === 'accepted' ? 'Confirm Cancellation' : 'Confirm Decline'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Assignment Modal */}
      <Dialog open={showCompleteModal} onOpenChange={closeCompleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Assignment as Completed</DialogTitle>
            <DialogDescription>
              Add treatment notes (optional) and mark this assignment as completed
            </DialogDescription>
          </DialogHeader>

          {selectedAssignment && (
            <div className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Marking this assignment as completed will notify the hospital and update your assignment statistics.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="treatmentNotes">Treatment Notes (Optional)</Label>
                <Textarea
                  id="treatmentNotes"
                  placeholder="e.g., Patient responded well to treatment, Follow-up recommended in 2 weeks..."
                  rows={6}
                  value={treatmentNotes}
                  onChange={(e) => setTreatmentNotes(e.target.value)}
                  className="resize-none"
                />
                <p className="text-xs text-gray-500">
                  Add any relevant notes about the consultation or treatment provided. These notes will be visible to the hospital.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="space-y-1 text-sm">
                  <p><span className="text-gray-500">Patient:</span> {selectedAssignment.patient}</p>
                  <p><span className="text-gray-500">Hospital:</span> {selectedAssignment.hospital}</p>
                  <p><span className="text-gray-500">Condition:</span> {selectedAssignment.condition}</p>
                  <p><span className="text-gray-500">Date:</span> {selectedAssignment.date ? new Date(selectedAssignment.date).toLocaleDateString() : 'TBD'}</p>
                  <p><span className="text-gray-500">Time:</span> {selectedAssignment.time}{selectedAssignment.endTime ? ` - ${selectedAssignment.endTime}` : ''}</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeCompleteModal} disabled={updatingStatus}>
              Cancel
            </Button>
            <Button
              onClick={handleCompleteAssignment}
              disabled={updatingStatus}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {updatingStatus ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Completing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Mark as Completed
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
