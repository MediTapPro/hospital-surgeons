'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, CheckCircle2, CircleAlert, Clock3, CreditCard, ReceiptText } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api/httpClient';
import { getUserRole, isAuthenticated } from '@/lib/auth/utils';
import { PATIENT_PAYMENTS_DEFAULT_LIMIT } from '@/lib/utils/constants';

interface Payment {
  orderId: string;
  assignmentId: string;
  orderStatus: string;
  orderAmount: number;
  currency: string;
  orderCreatedAt: string;
  orderPaidAt: string | null;
  failureReason: string | null;
  transactionId: string | null;
  transactionStatus: string | null;
  paymentMethod: string | null;
  gatewayName: string | null;
  gatewayPaymentId: string | null;
  transactionCreatedAt: string | null;
  verifiedAt: string | null;
  visitDate: string | null;
  doctorFirstName: string;
  doctorLastName: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function formatDateTime(value: string | null) {
  if (!value) return '—';

  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatPaymentStatus(payment: Payment) {
  const status = payment.transactionStatus ?? payment.orderStatus;
  if (status === 'success' || status === 'paid') return 'Paid';
  if (status === 'failed') return 'Failed';
  if (status === 'refunded') return 'Refunded';
  return 'Pending';
}

function statusClassName(payment: Payment) {
  const status = formatPaymentStatus(payment);
  if (status === 'Paid') return 'bg-emerald-50 text-emerald-700';
  if (status === 'Failed') return 'bg-rose-50 text-rose-700';
  if (status === 'Refunded') return 'bg-violet-50 text-violet-700';
  return 'bg-amber-50 text-amber-700';
}

export default function PatientPaymentsPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: PATIENT_PAYMENTS_DEFAULT_LIMIT,
    total: 0,
    totalPages: 0,
  });

  useEffect(() => {
    if (!isAuthenticated() || getUserRole() !== 'patient') {
      router.replace('/login?role=patient');
      return;
    }

    const loadPayments = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get('/api/patients/payments', {
          params: { page, limit: PATIENT_PAYMENTS_DEFAULT_LIMIT },
        });
        if (!response.data.success) {
          throw new Error(response.data.message || 'Unable to load payment history.');
        }

        setPayments(response.data.data);
        setPagination(response.data.pagination);
        if (response.data.pagination.page !== page) {
          setPage(response.data.pagination.page);
        }
      } catch (error: any) {
        toast.error(error.response?.data?.message || error.message || 'Unable to load payment history.');
      } finally {
        setLoading(false);
      }
    };

    loadPayments();
  }, [page, router]);

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-teal-50 p-3 text-teal-700">
              <ReceiptText className="size-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Payment history</h1>
              <p className="text-sm text-slate-500">Your verified home-visit payment records.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push('/patient/bookings')}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
          >
            <Calendar className="size-4" />
            My bookings
          </button>
        </header>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white">
            <Clock3 className="size-7 animate-spin text-teal-600" aria-label="Loading payment history" />
          </div>
        ) : payments.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <CreditCard className="mx-auto size-11 text-slate-300" />
            <h2 className="mt-4 text-lg font-bold text-slate-900">No payments yet</h2>
              <p className="mt-1 text-sm text-slate-500">Paid, failed, or refunded home-visit payments will appear here.</p>
          </section>
        ) : (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-bold text-slate-900">All transactions</h2>
              <p className="mt-1 text-sm text-slate-500">Most recent verified payment record first.</p>
            </div>
            <div className="divide-y divide-slate-100">
              {payments.map((payment) => {
                const status = formatPaymentStatus(payment);
                const paidAt = payment.verifiedAt ?? payment.orderPaidAt;
                const reference = payment.gatewayPaymentId ?? payment.orderId;

                return (
                  <article key={payment.transactionId} className="p-5 transition-colors hover:bg-slate-50">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 gap-3">
                        <div className={`mt-0.5 rounded-full p-2 ${status === 'Paid' ? 'bg-emerald-50 text-emerald-700' : status === 'Failed' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                          {status === 'Paid' ? <CheckCircle2 className="size-5" /> : <CircleAlert className="size-5" />}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-slate-900">Home visit with Dr. {payment.doctorFirstName} {payment.doctorLastName}</h3>
                          <p className="mt-1 text-sm text-slate-500">Visit completed: {formatDateTime(payment.visitDate)}</p>
                          <p className="mt-1 break-all text-xs text-slate-400">Reference: {reference}</p>
                          {status === 'Failed' && payment.failureReason && (
                            <p className="mt-2 text-sm text-rose-700">{payment.failureReason}</p>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-left sm:text-right">
                        <p className="text-lg font-bold text-slate-900">₹{Number(payment.orderAmount).toFixed(2)}</p>
                        <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClassName(payment)}`}>{status}</span>
                        <p className="mt-2 text-xs text-slate-500">{status === 'Paid' ? `Paid: ${formatDateTime(paidAt)}` : `Recorded: ${formatDateTime(payment.transactionCreatedAt)}`}</p>
                        {payment.paymentMethod && <p className="mt-1 text-xs capitalize text-slate-500">{payment.paymentMethod}</p>}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            {pagination.totalPages > 1 && (
              <nav className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4" aria-label="Payment history pagination">
                <p className="text-sm text-slate-500">Page {pagination.page} of {pagination.totalPages} · {pagination.total} records</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page === 1}
                    onClick={() => setPage((current) => current - 1)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage((current) => current + 1)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
                  >
                    Next
                  </button>
                </div>
              </nav>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
