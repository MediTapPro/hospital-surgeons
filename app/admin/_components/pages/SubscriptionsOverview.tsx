'use client';

import { useEffect, useState } from 'react';
import type { ComponentProps } from 'react';
import { AlertCircle, DollarSign, Loader2, Users, XCircle } from 'lucide-react';
import { PageHeader } from '../PageHeader';
import { StatCard } from '../StatCard';
import { StatusBadge } from '../StatusBadge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { AdminDataTable, type AdminDataTableColumn } from '../ui/AdminDataTable';
import { toast } from 'sonner';
import apiClient from '@/lib/api/httpClient';
import { formatPlatformCurrency, PLATFORM_CURRENCY } from '@/lib/utils/constants';

type SubscriptionRole = 'all' | 'doctor' | 'hospital';

interface Subscription {
  id: string;
  user: { id: string; email: string; role: string };
  plan: { id: string; name: string; tier: string; userRole: string; price: number | null; currency: string | null };
  status: string;
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  daysUntilExpiry?: number;
}

function SubscriptionTable({ data, expiring, emptyMessage, pagination }: { data: Subscription[]; expiring?: boolean; emptyMessage: string; pagination?: ComponentProps<typeof AdminDataTable>['pagination'] }) {
  const columns: AdminDataTableColumn<Subscription>[] = expiring ? [
    { id: 'user', label: 'User', widthClassName: 'w-[280px]', cell: (row) => <div><p className="font-medium text-slate-900">{row.user.email}</p><p className="text-xs uppercase tracking-wide text-slate-500">{row.user.role}</p></div> },
    { id: 'plan', label: 'Plan', widthClassName: 'w-[220px]', cell: (row) => <span className="font-medium text-slate-900">{row.plan.name}</span> },
    { id: 'endDate', label: 'End date', widthClassName: 'w-[170px]', cell: (row) => new Date(row.endDate).toLocaleDateString() },
    { id: 'expiry', label: 'Remaining', widthClassName: 'w-[170px]', cell: (row) => <span className={row.daysUntilExpiry !== undefined && row.daysUntilExpiry <= 7 ? 'font-semibold text-red-600' : 'text-slate-700'}>{row.daysUntilExpiry ?? '—'} days</span> },
    { id: 'renew', label: 'Auto-renew', widthClassName: 'w-[150px]', cell: (row) => row.autoRenew ? <span className="text-emerald-600">Enabled</span> : <span className="text-slate-500">Disabled</span> },
  ] : [
    { id: 'user', label: 'User', widthClassName: 'w-[260px]', cell: (row) => <div><p className="font-medium text-slate-900">{row.user.email}</p><p className="text-xs uppercase tracking-wide text-slate-500">{row.user.role}</p></div> },
    { id: 'plan', label: 'Plan', widthClassName: 'w-[190px]', cell: (row) => <span className="font-medium text-slate-900">{row.plan.name}</span> },
    { id: 'tier', label: 'Tier', widthClassName: 'w-[120px]', cell: (row) => <span className="capitalize">{row.plan.tier}</span> },
    { id: 'startDate', label: 'Start date', widthClassName: 'w-[150px]', cell: (row) => new Date(row.startDate).toLocaleDateString() },
    { id: 'endDate', label: 'End date', widthClassName: 'w-[150px]', cell: (row) => new Date(row.endDate).toLocaleDateString() },
    { id: 'status', label: 'Status', widthClassName: 'w-[140px]', cell: (row) => <StatusBadge status={row.status} /> },
    { id: 'renew', label: 'Auto-renew', widthClassName: 'w-[140px]', cell: (row) => row.autoRenew ? <span className="text-emerald-600">Enabled</span> : <span className="text-slate-500">Disabled</span> },
    { id: 'revenue', label: 'Price (INR)', widthClassName: 'w-[150px]', sticky: 'right', cell: (row) => row.plan.tier === 'free' ? <span className="font-medium text-slate-500">Free</span> : <span className="font-semibold text-slate-900">{formatPlatformCurrency(row.plan.price, PLATFORM_CURRENCY)}</span> },
  ];

  return <AdminDataTable columns={columns} data={data} emptyMessage={emptyMessage} getRowKey={(row) => row.id} minWidthClassName={expiring ? 'min-w-[900px]' : 'min-w-[1300px]'} pagination={pagination} />;
}

export function SubscriptionsOverview() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [expiringSubscriptions, setExpiringSubscriptions] = useState<Subscription[]>([]);
  const [summary, setSummary] = useState({ activeCount: 0, monthlyRevenue: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('active');
  const [roleFilter, setRoleFilter] = useState<SubscriptionRole>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (statusFilter === 'expiring') fetchExpiring();
    else fetchSubscriptions();
  }, [statusFilter, roleFilter, page, pageSize]);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: String(pageSize), page: String(page) });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (roleFilter !== 'all') params.set('role', roleFilter);
      const { data } = await apiClient.get(`/api/admin/subscriptions?${params}`);
      if (!data.success) throw new Error(data.message || 'Failed to fetch subscriptions');
      setSubscriptions(data.data || []);
      setTotalCount(data.pagination?.total || 0);
      setSummary(data.summary || { activeCount: 0, monthlyRevenue: 0 });
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to fetch subscriptions');
    } finally { setLoading(false); }
  };

  const fetchExpiring = async () => {
    try {
      setLoading(true);
      const roleQuery = roleFilter === 'all' ? '' : `&role=${roleFilter}`;
      const { data } = await apiClient.get(`/api/admin/subscriptions/expiring?days=30${roleQuery}`);
      if (!data.success) throw new Error(data.message || 'Failed to fetch expiring subscriptions');
      setExpiringSubscriptions(data.data || []);
    } catch (error) {
      console.error('Error fetching expiring subscriptions:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to fetch expiring subscriptions');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader title="Subscriptions Overview" description="Monitor subscriptions for doctors and hospitals" />
      <div className="space-y-8 p-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Active subscriptions" value={String(summary.activeCount)} icon={Users} />
          <StatCard title="Monthly recurring revenue" value={formatPlatformCurrency(summary.monthlyRevenue)} icon={DollarSign} trend={{ value: 'All active paid plans', isPositive: true }} />
          <StatCard title="Expiring soon" value={statusFilter === 'expiring' ? String(expiringSubscriptions.length) : '—'} icon={AlertCircle} />
          <StatCard title="Current view" value={statusFilter === 'expired' || statusFilter === 'cancelled' ? String(totalCount) : '—'} icon={XCircle} />
        </div>

        <Tabs value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }} className="space-y-6">
          <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <TabsList><TabsTrigger value="active">Active</TabsTrigger><TabsTrigger value="expiring">Expiring soon</TabsTrigger><TabsTrigger value="expired">Expired</TabsTrigger><TabsTrigger value="cancelled">Cancelled</TabsTrigger></TabsList>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-600">Account type</span>
              <Select value={roleFilter} onValueChange={(value: SubscriptionRole) => { setRoleFilter(value); setPage(1); }}>
                <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All accounts</SelectItem><SelectItem value="doctor">Doctors</SelectItem><SelectItem value="hospital">Hospitals</SelectItem></SelectContent>
              </Select>
            </div>
          </div>

          {(['active', 'expiring', 'expired', 'cancelled'] as const).map((tab) => (
            <TabsContent key={tab} value={tab} className="space-y-4">
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                {loading ? <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-teal-600" /></div> : <SubscriptionTable data={tab === 'expiring' ? expiringSubscriptions : subscriptions} expiring={tab === 'expiring'} emptyMessage={`No ${tab} subscriptions found`} pagination={tab === 'expiring' ? undefined : { page, pageSize, total: totalCount, onPageChange: setPage, onPageSizeChange: (size) => { setPageSize(size); setPage(1); }, disabled: loading }} />}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
