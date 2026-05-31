'use client';

import { useState, useEffect } from 'react';
import { DollarSign, CheckCircle, Clock, AlertCircle, Building2, User, Calendar, Search, Filter } from 'lucide-react';
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
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth/utils';
import apiClient from '@/lib/api/httpClient';

interface Payment {
  id: string;
  assignmentId: string;
  consultationFee: number;
  platformCommission: number;
  doctorPayout: number;
  paymentStatus: 'pending' | 'processing' | 'completed' | 'failed';
  paidToDoctorAt: string | null;
  createdAt: string;
  assignment: {
    completedAt: string | null;
    status: string;
  };
  hospital: {
    id: string;
    name: string;
  };
  patient: {
    id: string;
    name: string;
  };
}

export default function EarningsPaymentsPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (isAuthenticated()) {
      fetchDoctorProfile();
    } else {
      router.push('/login');
    }
  }, []);

  useEffect(() => {
    if (doctorId) {
      fetchPayments();
    }
  }, [doctorId, statusFilter, page]);

  const fetchDoctorProfile = async () => {
    try {
      const response = await apiClient.get('/api/doctors/profile');
      const data = response.data;
      if (data.success && data.data) {
        setDoctorId(data.data.id);
      } else {
        setError(data.message || 'Failed to load doctor profile');
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Error fetching doctor profile:', err);
      if (err.response?.status === 401) {
        router.push('/login');
        return;
      }
      setError('Failed to load doctor profile');
      setLoading(false);
    }
  };

  const fetchPayments = async () => {
    if (!doctorId) return;

    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '20');
      
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await apiClient.get(`/api/doctors/${doctorId}/payments?${params.toString()}`);
      const result = response.data;

      if (result.success && result.data) {
        setPayments(result.data.payments || []);
        setTotalPages(result.data.pagination?.totalPages || 1);
        setTotal(result.data.pagination?.total || 0);
      } else {
        setError(result.message || 'Failed to load payments');
        setPayments([]);
      }
    } catch (err: any) {
      console.error('Error fetching payments:', err);
      setError('Failed to load payments');
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800' },
      processing: { label: 'Processing', className: 'bg-blue-100 text-blue-800' },
      completed: { label: 'Completed', className: 'bg-green-100 text-green-800' },
      failed: { label: 'Failed', className: 'bg-red-100 text-red-800' },
    };

    const config = statusConfig[status] || statusConfig.pending;
    return (
      <Badge className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Calculate totals
  const totalEarnings = payments
    .filter(p => p.paymentStatus === 'completed')
    .reduce((sum, p) => sum + p.doctorPayout, 0);
  
  const pendingEarnings = payments
    .filter(p => p.paymentStatus === 'pending' || p.paymentStatus === 'processing')
    .reduce((sum, p) => sum + p.doctorPayout, 0);

  if (loading && !doctorId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-gray-900 mb-2 text-2xl font-bold">Earnings & Payments</h1>
          <p className="text-gray-600">Track your earnings and payment history</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-gray-900 mb-2 text-2xl font-bold">Earnings & Payments</h1>
        <p className="text-gray-600">Track your earnings and payment history</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Earnings</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalEarnings)}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Pending Payments</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(pendingEarnings)}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Payments</p>
              <p className="text-2xl font-bold text-gray-900">{total}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Select value={statusFilter} onValueChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {error && (
          <div className="p-4 bg-red-50 border-b border-red-200">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center">
            <p className="text-gray-500">Loading payments...</p>
          </div>
        ) : payments.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500">No payments found</p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assignment ID</TableHead>
                  <TableHead>Hospital</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>Payout</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Completed At</TableHead>
                  <TableHead>Paid At</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-mono text-sm">
                      {payment.assignmentId.substring(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span>{payment.hospital.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span>{payment.patient.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(payment.consultationFee)}
                    </TableCell>
                    <TableCell className="font-medium text-green-600">
                      {formatCurrency(payment.doctorPayout)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(payment.paymentStatus)}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {formatDate(payment.assignment.completedAt)}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {formatDate(payment.paidToDoctorAt)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedPayment(payment);
                          setShowDetails(true);
                        }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  Page {page} of {totalPages} ({total} total)
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Payment Details Modal */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payment Details</DialogTitle>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-gray-900">Payment Status</h3>
                {getStatusBadge(selectedPayment.paymentStatus)}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-gray-900 mb-2 font-medium">Payment Amounts</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Consultation Fee:</span>
                      <span className="font-medium">{formatCurrency(selectedPayment.consultationFee)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Platform Commission:</span>
                      <span className="font-medium">{formatCurrency(selectedPayment.platformCommission)}</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-200 pt-2">
                      <span className="text-gray-900 font-medium">Your Payout:</span>
                      <span className="font-bold text-green-600">{formatCurrency(selectedPayment.doctorPayout)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-gray-900 mb-2 font-medium">Assignment Info</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">Hospital:</span>
                      <p className="font-medium">{selectedPayment.hospital.name}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Patient:</span>
                      <p className="font-medium">{selectedPayment.patient.name}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Assignment Status:</span>
                      <p className="font-medium capitalize">{selectedPayment.assignment.status}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="text-gray-900 mb-2 font-medium">Timeline</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment Created:</span>
                    <span>{formatDateTime(selectedPayment.createdAt)}</span>
                  </div>
                  {selectedPayment.assignment.completedAt && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Assignment Completed:</span>
                      <span>{formatDateTime(selectedPayment.assignment.completedAt)}</span>
                    </div>
                  )}
                  {selectedPayment.paidToDoctorAt && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Paid to Doctor:</span>
                      <span className="font-medium text-green-600">{formatDateTime(selectedPayment.paidToDoctorAt)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
