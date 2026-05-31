'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '../PageHeader';
import { StatCard } from '../StatCard';
import { DollarSign, Users, AlertCircle, XCircle, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { StatusBadge } from '../StatusBadge';
import { Button } from '../ui/button';
import { toast } from 'sonner';

interface Subscription {
  id: string;
  user: { id: string; email: string; role: string };
  plan: { id: string; name: string; tier: string; userRole: string; price: number; currency: string };
  status: string;
  startDate: string;
  endDate: string;
  autoRenew: boolean;
}

export function SubscriptionsOverview() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [expiringSubscriptions, setExpiringSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 50;

  useEffect(() => {
    if (statusFilter === 'expiring') {
      fetchExpiring();
    } else {
      fetchSubscriptions();
    }
  }, [statusFilter, page]);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all' && statusFilter !== 'expiring') {
        params.append('status', statusFilter);
      }
      params.append('limit', limit.toString());
      params.append('page', page.toString());

      const res = await fetch(`/api/admin/subscriptions?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setSubscriptions(data.data || []);
        setTotalPages(data.pagination?.totalPages || 1);
      } else {
        toast.error(data.message || 'Failed to fetch subscriptions');
      }
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      toast.error('Failed to fetch subscriptions');
    } finally {
      setLoading(false);
    }
  };

  const fetchExpiring = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/subscriptions/expiring?days=30');
      const data = await res.json();

      if (data.success) {
        setExpiringSubscriptions(data.data || []);
      } else {
        toast.error(data.message || 'Failed to fetch expiring subscriptions');
      }
    } catch (error) {
      console.error('Error fetching expiring subscriptions:', error);
      toast.error('Failed to fetch expiring subscriptions');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (value: string) => {
    setStatusFilter(value);
    setPage(1); // Reset to first page when switching tabs
  };

  // Calculate MRR (Monthly Recurring Revenue) - only from active subscriptions
  const mrr = subscriptions
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + s.plan.price, 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader 
        title="Subscriptions Overview" 
        description="Monitor and manage all subscription plans"
      />

      <div className="p-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Active Subscriptions"
            value={statusFilter === 'active' ? subscriptions.length.toString() : '-'}
            icon={Users}
          />
          <StatCard
            title="Monthly Recurring Revenue"
            value={`$${mrr.toFixed(2)}`}
            icon={DollarSign}
            trend={{ value: "Active subscriptions", isPositive: true }}
          />
          <StatCard
            title="Expiring Soon"
            value={statusFilter === 'expiring' ? expiringSubscriptions.length.toString() : '-'}
            icon={AlertCircle}
          />
          <StatCard
            title="Current View"
            value={statusFilter === 'expired' ? subscriptions.length.toString() : statusFilter === 'cancelled' ? subscriptions.length.toString() : '-'}
            icon={XCircle}
          />
        </div>

        <Tabs value={statusFilter} onValueChange={handleTabChange} className="space-y-6">
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="expiring">Expiring Soon</TabsTrigger>
            <TabsTrigger value="expired">Expired</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            <div className="bg-white rounded-lg shadow">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-slate-600">User</th>
                          <th className="px-6 py-3 text-left text-slate-600">Plan</th>
                          <th className="px-6 py-3 text-left text-slate-600">Tier</th>
                          <th className="px-6 py-3 text-left text-slate-600">Start Date</th>
                          <th className="px-6 py-3 text-left text-slate-600">End Date</th>
                          <th className="px-6 py-3 text-left text-slate-600">Status</th>
                          <th className="px-6 py-3 text-left text-slate-600">Auto-Renew</th>
                          <th className="px-6 py-3 text-left text-slate-600">Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {subscriptions.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                              No active subscriptions found
                            </td>
                          </tr>
                        ) : (
                          subscriptions.map((sub) => (
                            <tr key={sub.id} className="hover:bg-slate-50">
                              <td className="px-6 py-4">
                                <div>
                                  <div className="text-slate-900">{sub.user.email}</div>
                                  <div className="text-slate-500 text-sm">{sub.user.role}</div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-slate-900">{sub.plan.name}</td>
                              <td className="px-6 py-4 text-slate-600">{sub.plan.tier}</td>
                              <td className="px-6 py-4 text-slate-600">
                                {new Date(sub.startDate).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 text-slate-600">
                                {new Date(sub.endDate).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4">
                                <StatusBadge status={sub.status} />
                              </td>
                              <td className="px-6 py-4">
                                <span className={sub.autoRenew ? 'text-green-600' : 'text-slate-600'}>
                                  {sub.autoRenew ? 'Yes' : 'No'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-slate-900">
                                {sub.plan.currency} {sub.plan.price != null ? sub.plan.price.toFixed(2) : 'N/A'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                      <div className="text-sm text-slate-600">
                        Page {page} of {totalPages}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page === 1 || loading}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                          disabled={page === totalPages || loading}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="expiring" className="space-y-4">
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
                        <th className="px-6 py-3 text-left text-slate-600">User</th>
                        <th className="px-6 py-3 text-left text-slate-600">Plan</th>
                        <th className="px-6 py-3 text-left text-slate-600">End Date</th>
                        <th className="px-6 py-3 text-left text-slate-600">Days Until Expiry</th>
                        <th className="px-6 py-3 text-left text-slate-600">Auto-Renew</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {expiringSubscriptions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                            No subscriptions expiring soon
                          </td>
                        </tr>
                      ) : (
                        expiringSubscriptions.map((sub: any) => (
                          <tr key={sub.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4">
                              <div>
                                <div className="text-slate-900">{sub.user.email}</div>
                                <div className="text-slate-500 text-sm">{sub.user.role}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-slate-900">{sub.plan.name}</td>
                            <td className="px-6 py-4 text-slate-600">
                              {new Date(sub.endDate).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 text-slate-600">
                              <span className={sub.daysUntilExpiry <= 7 ? 'text-red-600 font-semibold' : ''}>
                                {sub.daysUntilExpiry} days
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={sub.autoRenew ? 'text-green-600' : 'text-slate-600'}>
                                {sub.autoRenew ? 'Yes' : 'No'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="expired" className="space-y-4">
            <div className="bg-white rounded-lg shadow">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-slate-600">User</th>
                          <th className="px-6 py-3 text-left text-slate-600">Plan</th>
                          <th className="px-6 py-3 text-left text-slate-600">Tier</th>
                          <th className="px-6 py-3 text-left text-slate-600">Start Date</th>
                          <th className="px-6 py-3 text-left text-slate-600">End Date</th>
                          <th className="px-6 py-3 text-left text-slate-600">Status</th>
                          <th className="px-6 py-3 text-left text-slate-600">Auto-Renew</th>
                          <th className="px-6 py-3 text-left text-slate-600">Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {subscriptions.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                              No expired subscriptions found
                            </td>
                          </tr>
                        ) : (
                          subscriptions.map((sub) => (
                            <tr key={sub.id} className="hover:bg-slate-50">
                              <td className="px-6 py-4">
                                <div>
                                  <div className="text-slate-900">{sub.user.email}</div>
                                  <div className="text-slate-500 text-sm">{sub.user.role}</div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-slate-900">{sub.plan.name}</td>
                              <td className="px-6 py-4 text-slate-600">{sub.plan.tier}</td>
                              <td className="px-6 py-4 text-slate-600">
                                {new Date(sub.startDate).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 text-slate-600">
                                {new Date(sub.endDate).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4">
                                <StatusBadge status={sub.status} />
                              </td>
                              <td className="px-6 py-4">
                                <span className={sub.autoRenew ? 'text-green-600' : 'text-slate-600'}>
                                  {sub.autoRenew ? 'Yes' : 'No'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-slate-900">
                                {sub.plan.currency} {sub.plan.price != null ? sub.plan.price.toFixed(2) : 'N/A'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                      <div className="text-sm text-slate-600">
                        Page {page} of {totalPages}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page === 1 || loading}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                          disabled={page === totalPages || loading}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="cancelled" className="space-y-4">
            <div className="bg-white rounded-lg shadow">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-slate-600">User</th>
                          <th className="px-6 py-3 text-left text-slate-600">Plan</th>
                          <th className="px-6 py-3 text-left text-slate-600">Tier</th>
                          <th className="px-6 py-3 text-left text-slate-600">Start Date</th>
                          <th className="px-6 py-3 text-left text-slate-600">End Date</th>
                          <th className="px-6 py-3 text-left text-slate-600">Status</th>
                          <th className="px-6 py-3 text-left text-slate-600">Auto-Renew</th>
                          <th className="px-6 py-3 text-left text-slate-600">Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {subscriptions.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                              No cancelled subscriptions found
                            </td>
                          </tr>
                        ) : (
                          subscriptions.map((sub) => (
                            <tr key={sub.id} className="hover:bg-slate-50">
                              <td className="px-6 py-4">
                                <div>
                                  <div className="text-slate-900">{sub.user.email}</div>
                                  <div className="text-slate-500 text-sm">{sub.user.role}</div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-slate-900">{sub.plan.name}</td>
                              <td className="px-6 py-4 text-slate-600">{sub.plan.tier}</td>
                              <td className="px-6 py-4 text-slate-600">
                                {new Date(sub.startDate).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 text-slate-600">
                                {new Date(sub.endDate).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4">
                                <StatusBadge status={sub.status} />
                              </td>
                              <td className="px-6 py-4">
                                <span className={sub.autoRenew ? 'text-green-600' : 'text-slate-600'}>
                                  {sub.autoRenew ? 'Yes' : 'No'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-slate-900">
                                {sub.plan.currency} {sub.plan.price != null ? sub.plan.price.toFixed(2) : 'N/A'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                      <div className="text-sm text-slate-600">
                        Page {page} of {totalPages}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page === 1 || loading}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                          disabled={page === totalPages || loading}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
