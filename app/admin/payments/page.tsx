'use client';

import { useEffect, useState } from 'react';
import { CreditCard, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api/httpClient';
import { PageHeader } from '../_components/PageHeader';
import { Button } from '../_components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../_components/ui/select';

type Payment = {
  id: string;
  paymentSource: 'hospital_assignment' | 'home_visit';
  patientPaymentStatus: string;
  paymentStatus: string;
  consultationFee: number;
  doctor: string;
  patient: string;
};

type Pagination = { page: number; total: number; totalPages: number };

const PAYMENT_SOURCE_ALL = 'all';
const SETTLEMENT_STATUS_ALL = 'all';

function formatStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function PaymentFilters({ source, status, onSourceChange, onStatusChange }: {
  source: string;
  status: string;
  onSourceChange: (value: string) => void;
  onStatusChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row">
      <Select value={source} onValueChange={onSourceChange}>
        <SelectTrigger className="sm:w-56" aria-label="Filter by payment source">
          <SelectValue placeholder="Payment source" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={PAYMENT_SOURCE_ALL}>All sources</SelectItem>
          <SelectItem value="hospital_assignment">Hospital assignments</SelectItem>
          <SelectItem value="home_visit">Home visits</SelectItem>
        </SelectContent>
      </Select>
      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className="sm:w-52" aria-label="Filter by settlement status">
          <SelectValue placeholder="Settlement status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SETTLEMENT_STATUS_ALL}>All settlement statuses</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="processing">Processing</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="failed">Failed</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function PaymentsTable({ payments, loading }: { payments: Payment[]; loading: boolean }) {
  if (loading) {
    return <div className="flex min-h-64 items-center justify-center"><Loader2 className="size-7 animate-spin text-teal-600" aria-label="Loading payments" /></div>;
  }
  if (payments.length === 0) {
    return <div className="px-6 py-16 text-center text-slate-500"><CreditCard className="mx-auto mb-3 size-10 text-slate-300" />No payment records found.</div>;
  }
  return (
    <table className="min-w-full text-sm">
      <thead className="bg-slate-50 text-left text-slate-600">
        <tr><th className="px-4 py-3">Source</th><th className="px-4 py-3">Doctor</th><th className="px-4 py-3">Patient</th><th className="px-4 py-3">Fee</th><th className="px-4 py-3">Patient payment</th><th className="px-4 py-3">Settlement</th></tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {payments.map((payment) => (
          <tr key={payment.id}>
            <td className="px-4 py-3 font-medium">{payment.paymentSource === 'home_visit' ? 'Home visit' : 'Hospital assignment'}</td>
            <td className="px-4 py-3">{payment.doctor}</td><td className="px-4 py-3">{payment.patient}</td>
            <td className="px-4 py-3">₹{payment.consultationFee.toFixed(2)}</td>
            <td className="px-4 py-3">{payment.paymentSource === 'home_visit' ? formatStatus(payment.patientPaymentStatus) : '—'}</td>
            <td className="px-4 py-3">{formatStatus(payment.paymentStatus)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [source, setSource] = useState(PAYMENT_SOURCE_ALL);
  const [status, setStatus] = useState(SETTLEMENT_STATUS_ALL);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, total: 0, totalPages: 0 });

  useEffect(() => {
    async function loadPayments() {
      try {
        setLoading(true);
        const response = await apiClient.get('/api/admin/payments', { params: { page, source: source === PAYMENT_SOURCE_ALL ? undefined : source, status: status === SETTLEMENT_STATUS_ALL ? undefined : status } });
        if (!response.data.success) throw new Error(response.data.message || 'Unable to load payment records.');
        setPayments(response.data.data);
        setPagination(response.data.pagination);
      } catch (error: any) {
        toast.error(error.response?.data?.message || error.message || 'Unable to load payment records.');
      } finally {
        setLoading(false);
      }
    }
    loadPayments();
  }, [page, source, status]);

  const resetPage = (setter: (value: string) => void) => (value: string) => { setter(value); setPage(1); };

  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <PageHeader title="Payments" description="Hospital settlements and patient home-visit collections." />
      <div className="mt-6 space-y-4">
        <PaymentFilters source={source} status={status} onSourceChange={resetPage(setSource)} onStatusChange={resetPage(setStatus)} />
        <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <PaymentsTable payments={payments} loading={loading} />
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 p-4">
              <span className="text-sm text-slate-500">Page {pagination.page} of {pagination.totalPages} · {pagination.total} records</span>
              <div className="flex gap-2"><Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button></div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
