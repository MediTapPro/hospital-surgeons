'use client';

import { useEffect, useState } from 'react';
import type { ComponentProps } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api/httpClient';
import { PageHeader } from '../_components/PageHeader';
import { Button } from '../_components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../_components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../_components/ui/alert-dialog';
import { AdminDataTable, type AdminDataTableColumn } from '../_components/ui/AdminDataTable';
import { StatusBadge } from '../_components/StatusBadge';
import { formatPlatformCurrency } from '@/lib/utils/constants';

type Payment = {
  id: string;
  paymentSource: 'hospital_assignment' | 'home_visit';
  patientPaymentStatus: string;
  paymentStatus: string;
  consultationFee: number;
  doctorPayout: number;
  doctor: string;
  patient: string;
};

type Pagination = { page: number; limit: number; total: number; totalPages: number };

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

function PaymentsTable({ payments, onSettle, pagination }: { payments: Payment[]; onSettle: (payment: Payment) => void; pagination: ComponentProps<typeof AdminDataTable>['pagination'] }) {
  const columns: AdminDataTableColumn<Payment>[] = [
    { id: 'source', label: 'Source', widthClassName: 'w-[180px]', cell: (payment) => <StatusBadge status={payment.paymentSource === 'home_visit' ? 'home visit' : 'hospital'} /> },
    { id: 'doctor', label: 'Doctor', widthClassName: 'w-[220px]', cell: (payment) => <span className="font-medium text-slate-900">{payment.doctor}</span> },
    { id: 'patient', label: 'Patient', widthClassName: 'w-[200px]', cell: (payment) => payment.patient },
    { id: 'fee', label: 'Fee', widthClassName: 'w-[140px]', cell: (payment) => formatPlatformCurrency(payment.consultationFee) },
    { id: 'patient-payment', label: 'Patient payment', widthClassName: 'w-[170px]', cell: (payment) => payment.paymentSource === 'home_visit' ? formatStatus(payment.patientPaymentStatus) : '—' },
    { id: 'settlement', label: 'Settlement', widthClassName: 'w-[150px]', cell: (payment) => <StatusBadge status={payment.paymentStatus} /> },
    {
      id: 'action',
      label: 'Action',
      widthClassName: 'w-[220px]',
      sticky: 'right',
      cell: (payment) => {
        if (payment.paymentSource !== 'home_visit') return <span className="text-slate-400">Not applicable</span>;
        if (payment.paymentStatus === 'completed') return <span className="font-medium text-emerald-600">Paid</span>;
        if (payment.paymentStatus !== 'pending') return <span className="text-slate-500">Unavailable</span>;
        if (payment.patientPaymentStatus !== 'paid') return <span className="text-amber-600">Awaiting patient payment</span>;
        return <Button size="sm" className="gap-1.5 bg-teal-600 text-white hover:bg-teal-700" onClick={() => onSettle(payment)}><CheckCircle2 className="size-3.5" /> Pay {formatPlatformCurrency(payment.doctorPayout)}</Button>;
      },
    },
  ];

  return <AdminDataTable columns={columns} data={payments} emptyMessage="No payment records found" getRowKey={(payment) => payment.id} minWidthClassName="min-w-[1250px]" pagination={pagination} />;
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [source, setSource] = useState(PAYMENT_SOURCE_ALL);
  const [status, setStatus] = useState(SETTLEMENT_STATUS_ALL);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [paymentToSettle, setPaymentToSettle] = useState<Payment | null>(null);
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    async function loadPayments() {
      try {
        setLoading(true);
        const response = await apiClient.get('/api/admin/payments', { params: { page, limit: pageSize, source: source === PAYMENT_SOURCE_ALL ? undefined : source, status: status === SETTLEMENT_STATUS_ALL ? undefined : status } });
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
  }, [page, pageSize, source, status]);

  const resetPage = (setter: (value: string) => void) => (value: string) => { setter(value); setPage(1); };

  async function settlePayment() {
    if (!paymentToSettle) return;
    try {
      setSettling(true);
      const response = await apiClient.patch(`/api/admin/payments/${paymentToSettle.id}/settle`);
      if (!response.data.success) throw new Error(response.data.message || 'Unable to mark the doctor settlement as paid.');
      toast.success('Doctor settlement marked as paid.');
      setPaymentToSettle(null);
      setPayments((current) => current.map((payment) => payment.id === paymentToSettle.id ? { ...payment, paymentStatus: 'completed' } : payment));
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Unable to mark the doctor settlement as paid.');
    } finally {
      setSettling(false);
    }
  }

  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <PageHeader title="Payments" description="Hospital settlements and patient home-visit collections." />
      <div className="mt-6 space-y-4">
        <PaymentFilters source={source} status={status} onSourceChange={resetPage(setSource)} onStatusChange={resetPage(setStatus)} />
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="size-7 animate-spin text-teal-600" aria-label="Loading payments" /></div> : <PaymentsTable payments={payments} onSettle={setPaymentToSettle} pagination={{ page: pagination.page, pageSize, pageSizeOptions: [10, 20, 50], total: pagination.total, onPageChange: setPage, onPageSizeChange: (size) => { setPageSize(size); setPage(1); }, disabled: loading }} />}
        </section>
      </div>
      <AlertDialog open={Boolean(paymentToSettle)} onOpenChange={(open) => !open && setPaymentToSettle(null)}>
        <AlertDialogContent className="max-w-md border-slate-200 bg-white p-6 shadow-2xl">
          <AlertDialogHeader>
            <p className="text-sm font-semibold text-teal-700">Home-visit payout</p>
            <AlertDialogTitle>Confirm doctor payout</AlertDialogTitle>
            <AlertDialogDescription>
              Confirm this only after transferring the payout to the doctor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <dl className="space-y-3 rounded-lg border border-teal-100 bg-teal-50 p-4 text-sm">
            <div className="flex items-center justify-between gap-4"><dt className="text-slate-600">Doctor</dt><dd className="font-semibold text-slate-900">{paymentToSettle?.doctor}</dd></div>
            <div className="flex items-center justify-between gap-4"><dt className="text-slate-600">Patient</dt><dd className="font-semibold text-slate-900">{paymentToSettle?.patient}</dd></div>
            <div className="flex items-center justify-between gap-4 border-t border-teal-200 pt-3"><dt className="font-semibold text-slate-700">Payout amount</dt><dd className="text-lg font-bold text-teal-800">₹{paymentToSettle?.doctorPayout.toFixed(2)}</dd></div>
          </dl>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={settling}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-teal-600 text-white hover:bg-teal-700" disabled={settling} onClick={settlePayment}>{settling ? 'Saving…' : 'Confirm payout sent'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
