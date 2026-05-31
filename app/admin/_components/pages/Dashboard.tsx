'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '../PageHeader';
import { StatCard } from '../StatCard';
import { Users, Building2, UserCheck, ClipboardList, TrendingUp, DollarSign, Loader2, UserCog, ArrowRight, LogOut } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Button } from '../ui/button';
import { StatusBadge } from '../StatusBadge';

interface DashboardStats {
  activeDoctors: number;
  activeHospitals: number;
  pendingVerifications: number;
  todayAssignments: number;
  activeSubscriptions: number;
  openTickets: number;
  totalUsers: number;
  pendingUsers: number;
}

interface TrendData {
  month: string;
  assignments?: number;
  doctors?: number;
  hospitals?: number;
}

interface Activity {
  id: string;
  type: string;
  message: string;
  time: string;
  status: string;
  priority?: string;
}

interface Alert {
  id: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  time: string;
  type?: string;
  count?: number;
}

interface UserStats {
  total: number;
  doctors: number;
  hospitals: number;
  admins: number;
  active: number;
  pending: number;
  suspended: number;
  pendingVerifications: number;
}

export function Dashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [assignmentTrends, setAssignmentTrends] = useState<TrendData[]>([]);
  const [userGrowthTrends, setUserGrowthTrends] = useState<TrendData[]>([]);
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('rememberMe');
    router.push('/login');
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all data in parallel
      const [statsRes, trendsRes, activityRes, usersRes] = await Promise.all([
        fetch('/api/admin/dashboard/stats'),
        fetch('/api/admin/dashboard/trends?months=6'),
        fetch('/api/admin/dashboard/recent-activity?limit=10'),
        // fetch('/api/admin/dashboard/alerts'), // COMMENTED OUT
        fetch('/api/admin/users?limit=100'), // Get user counts
      ]);

      // Handle stats
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData.success) {
          setStats(statsData.data);
        }
      }

      // Handle trends
      if (trendsRes.ok) {
        const trendsData = await trendsRes.json();
        if (trendsData.success) {
          setAssignmentTrends(trendsData.data.assignmentTrends || []);
          setUserGrowthTrends(trendsData.data.userGrowthTrends || []);
        }
      }

      // Handle recent activity
      if (activityRes.ok) {
        const activityData = await activityRes.json();
        if (activityData.success) {
          setRecentActivity(activityData.data || []);
        }
      }

      // Handle alerts - COMMENTED OUT
      // if (alertsRes.ok) {
      //   const alertsData = await alertsRes.json();
      //   if (alertsData.success) {
      //     setAlerts(alertsData.data || []);
      //   }
      // }

      // Handle user stats
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        if (usersData.success) {
          const users = usersData.data || [];
          const pagination = usersData.pagination || {};
          const userStatsData: UserStats = {
            total: pagination.total || users.length,
            doctors: users.filter((u: any) => u.role.toLowerCase() === 'doctor').length,
            hospitals: users.filter((u: any) => u.role.toLowerCase() === 'hospital').length,
            admins: users.filter((u: any) => u.role.toLowerCase() === 'admin').length,
            active: users.filter((u: any) => u.status.toLowerCase() === 'active').length,
            pending: users.filter((u: any) => u.status.toLowerCase() === 'pending').length,
            suspended: users.filter((u: any) => u.status.toLowerCase() === 'suspended').length,
            pendingVerifications: users.filter((u: any) => u.verificationStatus && u.verificationStatus.toLowerCase() === 'pending').length,
          };
          setUserStats(userStatsData);
        }
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-600 mb-4" />
          <p className="text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={fetchDashboardData}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader 
        title="Dashboard" 
        description="Healthcare system overview and analytics"
        actions={
          <>
            <Button variant="outline" onClick={fetchDashboardData}>
              Refresh
            </Button>
            <Button className="bg-navy-600 hover:bg-navy-700">
              Quick Actions
            </Button>
            <Button variant="outline" onClick={handleLogout} className="text-red-600 hover:text-red-700 hover:bg-red-50">
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </>
        }
      />

      <div className="p-8 space-y-8">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Active Doctors"
            value={stats?.activeDoctors?.toString() || '0'}
            icon={Users}
            trend={{ value: "Active doctors", isPositive: true }}
          />
          <StatCard
            title="Active Hospitals"
            value={stats?.activeHospitals?.toString() || '0'}
            icon={Building2}
            trend={{ value: "Active hospitals", isPositive: true }}
          />
          <StatCard
            title="Pending Verifications"
            value={stats?.pendingVerifications?.toString() || '0'}
            icon={UserCheck}
            trend={{ value: "Require review", isPositive: false }}
          />
          <StatCard
            title="Today's Assignments"
            value={stats?.todayAssignments?.toString() || '0'}
            icon={ClipboardList}
            trend={{ value: "Today", isPositive: true }}
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-slate-900">Assignment Trends</h3>
                <p className="text-slate-600 mt-1">Monthly assignment volume</p>
              </div>
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <ResponsiveContainer width="100%" height={240}>
              {assignmentTrends.length > 0 ? (
                <LineChart data={assignmentTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip />
                  <Line type="monotone" dataKey="assignments" stroke="#0d9488" strokeWidth={2} />
                </LineChart>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500">
                  No data available
                </div>
              )}
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-slate-900">User Growth</h3>
                <p className="text-slate-600 mt-1">Doctors and hospitals registered</p>
              </div>
              <Users className="w-5 h-5 text-teal-600" />
            </div>
            <ResponsiveContainer width="100%" height={240}>
              {userGrowthTrends.length > 0 ? (
                <BarChart data={userGrowthTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="doctors" fill="#0d9488" name="Doctors" />
                  <Bar dataKey="hospitals" fill="#1e293b" name="Hospitals" />
                </BarChart>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500">
                  No data available
                </div>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Activity and Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-slate-900">Recent Activity</h3>
                <p className="text-slate-600 mt-1">Latest system events and updates</p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => router.push('/admin/audit-logs')}
                className="flex items-center gap-2"
              >
                View All
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-6 max-h-[400px] overflow-y-auto">
              {recentActivity.length > 0 ? (
                <div className="space-y-4">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-4 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                      <div className="w-2 h-2 rounded-full bg-teal-600 mt-2 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-900">{activity.message}</p>
                        <p className="text-slate-500 mt-1">{activity.time}</p>
                      </div>
                      <StatusBadge status={activity.status} variant="small" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  No recent activity
                </div>
              )}
            </div>
          </div>

          {/* Alerts section - COMMENTED OUT */}
          {/* <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-slate-900">Alerts</h3>
              <p className="text-slate-600 mt-1">Critical notifications</p>
            </div>
            <div className="p-6">
              {alerts.length > 0 ? (
                <div className="space-y-4">
                  {alerts.map((alert) => (
                    <div key={alert.id} className={`p-3 rounded-lg border ${
                      alert.priority === 'high' 
                        ? 'bg-red-50 border-red-200' 
                        : alert.priority === 'medium'
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-blue-50 border-blue-200'
                    }`}>
                      <div className="flex items-start gap-2">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                          alert.priority === 'high' ? 'bg-red-600' : 
                          alert.priority === 'medium' ? 'bg-amber-600' : 'bg-blue-600'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-900">{alert.message}</p>
                          <p className="text-slate-600 mt-1">{alert.time}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  No alerts at this time
                </div>
              )}
            </div>
          </div> */}
        </div>

        {/* Users Overview Widget */}
        {userStats && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-slate-900">Users Overview</h3>
                <p className="text-slate-600 mt-1">Manage all users, doctors, and hospitals</p>
              </div>
              <Button 
                variant="outline" 
                onClick={() => router.push('/admin/users')}
                className="flex items-center gap-2"
              >
                Manage Users
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-teal-50 rounded-lg">
                <div className="text-sm text-slate-600 mb-1">Total Users</div>
                <div className="text-2xl font-bold text-slate-900">{userStats.total}</div>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-sm text-slate-600 mb-1">Doctors</div>
                <div className="text-2xl font-bold text-slate-900">{userStats.doctors}</div>
              </div>
              <div className="p-4 bg-navy-50 rounded-lg">
                <div className="text-sm text-slate-600 mb-1">Hospitals</div>
                <div className="text-2xl font-bold text-slate-900">{userStats.hospitals}</div>
              </div>
              <div className="p-4 bg-amber-50 rounded-lg">
                <div className="text-sm text-slate-600 mb-1">Pending Verifications</div>
                <div className="text-2xl font-bold text-amber-600">{userStats.pendingVerifications}</div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-slate-600">Active: </span>
                  <span className="font-semibold text-green-600">{userStats.active}</span>
                </div>
                <div>
                  <span className="text-slate-600">Pending: </span>
                  <span className="font-semibold text-amber-600">{userStats.pending}</span>
                </div>
                <div>
                  <span className="text-slate-600">Suspended: </span>
                  <span className="font-semibold text-red-600">{userStats.suspended}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-slate-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button 
              variant="outline" 
              className="justify-start h-auto py-4"
              onClick={() => router.push('/admin/users')}
            >
              <UserCog className="w-5 h-5 mr-2" />
              Manage Users
            </Button>
            <Button 
              variant="outline" 
              className="justify-start h-auto py-4"
              onClick={() => router.push('/admin/verifications')}
            >
              <UserCheck className="w-5 h-5 mr-2" />
              Verify Users
            </Button>
            <Button 
              variant="outline" 
              className="justify-start h-auto py-4"
              onClick={() => router.push('/admin/assignments')}
            >
              <ClipboardList className="w-5 h-5 mr-2" />
              View Assignments
            </Button>
            <Button 
              variant="outline" 
              className="justify-start h-auto py-4"
              onClick={() => router.push('/admin/plans')}
            >
              <DollarSign className="w-5 h-5 mr-2" />
              Manage Plans
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
