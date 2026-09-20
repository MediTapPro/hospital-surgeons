'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '../PageHeader';
import { StatCard } from '../StatCard';
import { Users, Building2, UserCheck, ClipboardList, TrendingUp, DollarSign, Loader2, UserCog, ArrowRight, LogOut } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Button } from '../ui/button';
import { StatusBadge } from '../StatusBadge';
import { HomeVisitOverview } from '../HomeVisitOverview';
import apiClient from '@/lib/api/httpClient';

interface DashboardStats {
  activeDoctors: number;
  activeHospitals: number;
  pendingVerifications: number;
  todayAssignments: number;
  activeSubscriptions: number;
  openTickets: number;
  totalUsers: number;
  pendingUsers: number;
  inactiveUsers: number;
  suspendedUsers: number;
  totalDoctors: number;
  totalHospitals: number;
  totalAdmins: number;
  totalPatients: number;
  activeUsers: number;
  homeVisitsToday: number;
  homeVisitPatientPaymentsCollected: number;
  homeVisitPendingDoctorPayout: number;
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

interface UserStats {
  total: number;
  doctors: number;
  hospitals: number;
  patients: number;
  admins: number;
  active: number;
  pending: number;
  inactive: number;
  suspended: number;
  pendingVerifications: number;
}

export function Dashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [assignmentTrends, setAssignmentTrends] = useState<TrendData[]>([]);
  const [userGrowthTrends, setUserGrowthTrends] = useState<TrendData[]>([]);
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
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

      const [statsResponse, trendsResponse, activityResponse] = await Promise.all([
        apiClient.get('/api/admin/dashboard/stats'),
        apiClient.get('/api/admin/dashboard/trends?months=6'),
        apiClient.get('/api/admin/dashboard/recent-activity?limit=10'),
      ]);

      const statsData = statsResponse.data;
      if (!statsData.success) {
        throw new Error(statsData.message || 'Unable to load dashboard statistics.');
      }
      setStats(statsData.data);
      setUserStats({
        total: statsData.data.totalUsers,
        doctors: statsData.data.totalDoctors,
        hospitals: statsData.data.totalHospitals,
        patients: statsData.data.totalPatients,
        admins: statsData.data.totalAdmins,
        active: statsData.data.activeUsers,
        pending: statsData.data.pendingUsers,
        inactive: statsData.data.inactiveUsers,
        suspended: statsData.data.suspendedUsers,
        pendingVerifications: statsData.data.pendingVerifications,
      });

      const trendsData = trendsResponse.data;
      if (!trendsData.success) {
        throw new Error(trendsData.message || 'Unable to load dashboard trends.');
      }
      setAssignmentTrends(trendsData.data.assignmentTrends || []);
      setUserGrowthTrends(trendsData.data.userGrowthTrends || []);

      const activityData = activityResponse.data;
      if (!activityData.success) {
        throw new Error(activityData.message || 'Unable to load recent activity.');
      }
      setRecentActivity(activityData.data || []);
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

        {stats && (
          <HomeVisitOverview
            homeVisitsToday={stats.homeVisitsToday}
            patientPaymentsCollected={stats.homeVisitPatientPaymentsCollected}
            pendingDoctorPayout={stats.homeVisitPendingDoctorPayout}
          />
        )}

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
        </div>

        {userStats && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-slate-900">Users Overview</h3>
                <p className="text-slate-600 mt-1">Manage platform accounts across doctors, hospitals, patients, and admins.</p>
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
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
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
                <div className="text-sm text-slate-600 mb-1">Patients</div>
                <div className="text-2xl font-bold text-amber-600">{userStats.patients}</div>
              </div>
              <div className="p-4 bg-violet-50 rounded-lg">
                <div className="text-sm text-slate-600 mb-1">Admins</div>
                <div className="text-2xl font-bold text-violet-700">{userStats.admins}</div>
              </div>
            </div>
            <div className="mt-4 border-t border-slate-200 pt-4">
              <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-5">
                <div>
                  <span className="text-slate-600">Active: </span>
                  <span className="font-semibold text-green-600">{userStats.active}</span>
                </div>
                <div>
                  <span className="text-slate-600">Pending: </span>
                  <span className="font-semibold text-amber-600">{userStats.pending}</span>
                </div>
                <div>
                  <span className="text-slate-600">Inactive: </span>
                  <span className="font-semibold text-slate-600">{userStats.inactive}</span>
                </div>
                <div>
                  <span className="text-slate-600">Suspended: </span>
                  <span className="font-semibold text-red-600">{userStats.suspended}</span>
                </div>
                <div>
                  <span className="text-slate-600">Pending verifications: </span>
                  <span className="font-semibold text-amber-600">{userStats.pendingVerifications}</span>
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
