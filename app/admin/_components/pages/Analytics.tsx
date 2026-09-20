'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '../PageHeader';
import { Button } from '../ui/button';
import { Calendar, Loader2, RefreshCw } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import apiClient from '@/lib/api/httpClient';
import { formatPlatformCurrency } from '@/lib/utils/constants';
import { toast } from 'sonner';

export function Analytics() {
  const [overview, setOverview] = useState<any>(null);
  const [userAnalytics, setUserAnalytics] = useState<any>(null);
  const [assignmentAnalytics, setAssignmentAnalytics] = useState<any>(null);
  const [revenueAnalytics, setRevenueAnalytics] = useState<any>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState('12');

  useEffect(() => {
    fetchAllAnalytics();
  }, [months]);

  const fetchAllAnalytics = async () => {
    try {
      setLoading(true);
      const query = { params: { months } };
      const [overviewRes, usersRes, assignmentsRes, revenueRes, trendsRes] = await Promise.all([
        apiClient.get('/api/admin/analytics/overview', query),
        apiClient.get('/api/admin/analytics/users', query),
        apiClient.get('/api/admin/analytics/assignments', query),
        apiClient.get('/api/admin/analytics/revenue', query),
        apiClient.get('/api/admin/analytics/trends', query),
      ]);

      if (overviewRes.data.success) setOverview(overviewRes.data.data);
      if (usersRes.data.success) setUserAnalytics(usersRes.data.data);
      if (assignmentsRes.data.success) setAssignmentAnalytics(assignmentsRes.data.data);
      if (revenueRes.data.success) setRevenueAnalytics(revenueRes.data.data);
      if (trendsRes.data.success) setTrends(trendsRes.data.data || []);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Unable to load analytics data.');
    } finally {
      setLoading(false);
    }
  };

  const statusDistributionData = assignmentAnalytics?.byStatus?.map((item: any) => ({
    name: item.status,
    value: item.count,
    color: item.status === 'completed' ? '#10b981' : item.status === 'pending' ? '#f59e0b' : '#ef4444',
  })) || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader 
        title="Analytics Dashboard" 
        description="Comprehensive system analytics and insights"
        actions={
          <>
            <Select value={months} onValueChange={setMonths}>
              <SelectTrigger className="w-[170px] bg-white"><Calendar className="mr-2 size-4 text-slate-500" /><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="6">Last 6 months</SelectItem><SelectItem value="12">Last 12 months</SelectItem><SelectItem value="24">Last 24 months</SelectItem></SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchAllAnalytics} disabled={loading}><RefreshCw className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
          </>
        }
      />

      <div className="p-8 space-y-8">
        {/* Overview Stats */}
        {overview && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-slate-600 text-sm">Total Users</div>
              <div className="text-3xl font-bold text-slate-900 mt-2">{overview.totalUsers}</div>
              <div className="text-sm text-green-600 mt-1">+{overview.newUsers} new</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-slate-600 text-sm">Total Assignments</div>
              <div className="text-3xl font-bold text-slate-900 mt-2">{overview.totalAssignments}</div>
              <div className="text-sm text-green-600 mt-1">+{overview.newAssignments} new</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-slate-600 text-sm">Active Subscriptions</div>
              <div className="text-3xl font-bold text-slate-900 mt-2">{overview.activeSubscriptions}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-slate-600 text-sm">Total Revenue</div>
              <div className="text-3xl font-bold text-slate-900 mt-2">{formatPlatformCurrency(overview.totalRevenue)}</div>
            </div>
          </div>
        )}

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {userAnalytics?.growth && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-slate-900 mb-4">User Growth Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={userAnalytics.growth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke="#0d9488" strokeWidth={2} name="Users" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {assignmentAnalytics?.trends && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-slate-900 mb-4">Assignment Trends</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={assignmentAnalytics.trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0d9488" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {statusDistributionData.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-slate-900 mb-4">Assignment Status Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusDistributionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusDistributionData.map((entry: { name: string; value: number; color: string }, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {revenueAnalytics?.monthly && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-slate-900 mb-4">Monthly Revenue</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueAnalytics.monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#64748b" />
                  <YAxis stroke="#64748b" tickFormatter={(value) => formatPlatformCurrency(Number(value))} />
                  <Tooltip formatter={(value) => formatPlatformCurrency(Number(value))} />
                  <Line type="monotone" dataKey="revenue" stroke="#1e293b" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
