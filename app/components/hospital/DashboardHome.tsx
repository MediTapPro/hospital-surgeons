'use client';

import { useState, useEffect } from 'react';
import { Users, ClipboardList, Calendar, TrendingUp, Plus, UserSearch, Eye, Clock, CheckCircle, AlertCircle, Loader2, LogOut, XCircle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { useRouter } from 'next/navigation';
import { PageHeader } from '../../hospital/_components/PageHeader';
import { StatCard } from '../../hospital/_components/StatCard';
import { HospitalUsageWidget } from '../../hospital/_components/HospitalUsageWidget';
import apiClient from '@/lib/api/httpClient';

export function DashboardHome() {
  const router = useRouter();
  const [metrics, setMetrics] = useState([
    {
      title: 'Total Patients',
      value: '248',
      change: '+12.5%',
      trend: 'up',
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Active Assignments',
      value: '34',
      change: '8 pending',
      trend: 'neutral',
      icon: ClipboardList,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Monthly Assignments',
      value: '156',
      change: '+18.2%',
      trend: 'up',
      icon: Calendar,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Subscription Usage',
      value: '18',
      change: 'Unlimited',
      trend: 'neutral',
      icon: TrendingUp,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
  ]);
  const [todaysSchedule, setTodaysSchedule] = useState([
    {
      id: '1',
      time: 'Loading...',
      doctor: '',
      specialty: '',
      patient: '',
      condition: '',
      status: 'pending',
      acceptedAt: null,
      expiresIn: null,
    },
  ]);
  const [pendingActions, setPendingActions] = useState([
    { type: 'unassigned', count: 0, message: 'Patients without assigned doctors', action: 'Assign Now' },
    { type: 'declined', count: 0, message: 'Declined assignments need reassignment', action: 'Find Doctor' },
    { type: 'expiring', count: 0, message: 'Assignments expiring soon', action: 'Send Reminder' },
  ]);
  const [loading, setLoading] = useState(true);

  const [hospitalId, setHospitalId] = useState<string | null>(null);

  useEffect(() => {
    fetchHospitalProfile();
  }, []);

  useEffect(() => {
    if (hospitalId && typeof hospitalId === 'string' && hospitalId.length > 0) {
      fetchDashboardData();
    }
  }, [hospitalId]);

  const fetchHospitalProfile = async () => {
    try {
      const response = await apiClient.get('/api/hospitals/profile');
      if (response.data?.success && response.data?.data?.id) {
        setHospitalId(response.data.data.id);
      } else {
        setLoading(false);
      }
    } catch (error: any) {
      console.error('Error fetching hospital profile:', error);
      setLoading(false);
      if (error.response?.status === 401) {
        router.push('/login');
      }
    }
  };

  const fetchDashboardData = async () => {
    if (!hospitalId || typeof hospitalId !== 'string' || hospitalId.length === 0) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const response = await apiClient.get(`/api/hospitals/${hospitalId}/dashboard`);
      const result = response.data;

      if (result.success && result.data) {
        const data = result.data;
        
        // Update metrics
        setMetrics([
          {
            title: 'Total Patients',
            value: data.metrics.totalPatients.value,
            change: data.metrics.totalPatients.change,
            trend: data.metrics.totalPatients.trend,
            icon: Users,
            color: 'text-teal-600',
            bgColor: 'bg-teal-50',
          },
          {
            title: 'Active Assignments',
            value: data.metrics.activeAssignments.value,
            change: data.metrics.activeAssignments.change,
            trend: data.metrics.activeAssignments.trend,
            icon: ClipboardList,
            color: 'text-teal-600',
            bgColor: 'bg-teal-50',
          },
          {
            title: 'Monthly Assignments',
            value: data.metrics.monthlyAssignments.value,
            change: data.metrics.monthlyAssignments.change,
            trend: data.metrics.monthlyAssignments.trend,
            icon: Calendar,
            color: 'text-teal-600',
            bgColor: 'bg-teal-50',
          },
          {
            title: 'Subscription Usage',
            value: data.metrics.subscriptionUsage.value,
            change: data.metrics.subscriptionUsage.change,
            trend: data.metrics.subscriptionUsage.trend,
            icon: TrendingUp,
            color: 'text-teal-600',
            bgColor: 'bg-teal-50',
          },
        ]);

        // Update today's schedule
        setTodaysSchedule(data.todaysSchedule || []);

        // Update pending actions
        setPendingActions(data.pendingActions || []);
      }
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      if (error.response?.status === 401) {
        // Token expired, will be handled by apiClient interceptor
        return;
      }
    } finally {
      setLoading(false);
    }
  };
  
  const onNavigate = (page: string) => {
    router.push(`/hospital/${page}`);
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('rememberMe');
    router.push('/login');
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

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader 
        title="Dashboard" 
        description="Hospital operations overview and analytics"
        actions={
          <>
            <Button variant="outline" onClick={fetchDashboardData}>
              Refresh
            </Button>
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => onNavigate('patients')}>
              <Plus className="w-4 h-4 mr-2" />
              Add Patient
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
            title="Total Patients"
            value={metrics[0]?.value || '0'}
            icon={Users}
            trend={{ 
              value: metrics[0]?.change || '0%', 
              isPositive: metrics[0]?.trend === 'up' 
            }}
          />
          <StatCard
            title="Active Assignments"
            value={metrics[1]?.value || '0'}
            icon={ClipboardList}
            trend={{ 
              value: metrics[1]?.change || '0 pending', 
              isPositive: metrics[1]?.trend === 'up' 
            }}
          />
          <StatCard
            title="Monthly Assignments"
            value={metrics[2]?.value || '0'}
            icon={Calendar}
            trend={{ 
              value: metrics[2]?.change || '0%', 
              isPositive: metrics[2]?.trend === 'up' 
            }}
          />
          <StatCard
            title="Subscription Usage"
            value={metrics[3]?.value || '0'}
            icon={TrendingUp}
            trend={{ 
              value: metrics[3]?.change || 'N/A', 
              isPositive: true 
            }}
          />
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-slate-900 font-semibold mb-4">Quick Actions</h3>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => onNavigate('patients')} className="bg-teal-600 hover:bg-teal-700 gap-2">
              <Plus className="w-4 h-4" />
              Add New Patient
            </Button>
            <Button onClick={() => onNavigate('find-doctors')} variant="outline" className="gap-2">
              <UserSearch className="w-4 h-4" />
              Find Doctor
            </Button>
            <Button onClick={() => onNavigate('assignments')} variant="outline" className="gap-2">
              <Eye className="w-4 h-4" />
              View All Assignments
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Hospital Usage Widget */}
          <div className="lg:col-span-1">
            <HospitalUsageWidget />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's Assignments */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-slate-900 font-semibold">Today's Assignments</h3>
              </div>
              {todaysSchedule.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onNavigate('assignments')}
                >
                  View All
                </Button>
              )}
            </div>
            <div className="space-y-4">
              {todaysSchedule.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <p>No assignments requested today</p>
                </div>
              ) : (
                todaysSchedule.map((appointment: any, index: number) => (
                  <div 
                    key={appointment.id || index} 
                    className="flex items-start gap-4 p-4 rounded-lg border border-slate-200 hover:border-teal-300 hover:bg-teal-50/50 transition-all cursor-pointer"
                    onClick={() => router.push(`/hospital/assignments?assignmentId=${appointment.id}`)}
                  >
                    <div className="text-center min-w-[80px]">
                      <div className="text-teal-600 font-medium">{appointment.time}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex-1">
                          <p className="text-slate-900 font-medium">{appointment.doctor}</p>
                          <p className="text-slate-600 text-sm">{appointment.specialty}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {appointment.priority && appointment.priority !== 'routine' && (
                            <Badge 
                              variant="outline" 
                              className={
                                appointment.priority === 'emergency' 
                                  ? 'bg-red-50 border-red-200 text-red-700' 
                                  : appointment.priority === 'urgent'
                                  ? 'bg-orange-50 border-orange-200 text-orange-700'
                                  : ''
                              }
                            >
                              {appointment.priority.charAt(0).toUpperCase() + appointment.priority.slice(1)}
                            </Badge>
                          )}
                          {appointment.status === 'accepted' ? (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Accepted
                            </Badge>
                          ) : appointment.status === 'declined' ? (
                            <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-100">
                              Declined
                            </Badge>
                          ) : appointment.status === 'cancelled' ? (
                            <Badge variant="destructive" className="bg-orange-100 text-orange-800 hover:bg-orange-100">
                              <XCircle className="w-3 h-3 mr-1" />
                              Cancelled
                            </Badge>
                          ) : appointment.status === 'completed' ? (
                            <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Completed
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                              <Clock className="w-3 h-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm mb-2">
                        <span className="text-slate-700">Patient: <strong>{appointment.patient}</strong></span>
                        <span className="text-slate-500">• {appointment.condition}</span>
                        {appointment.consultationFee && (
                          <span className="text-slate-600 font-medium">• ₹{appointment.consultationFee}</span>
                        )}
                      </div>
                      {appointment.status === 'accepted' ? (
                        <p className="text-slate-500 text-xs mt-2">Confirmed {appointment.acceptedAt}</p>
                      ) : appointment.status === 'pending' ? (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-yellow-600 text-xs">Expires in {appointment.expiresIn}</span>
                          <Button 
                            variant="link" 
                            size="sm" 
                            className="h-auto p-0 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              // TODO: Implement send reminder
                            }}
                          >
                            Send Reminder
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Pending Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-slate-900 font-semibold mb-4">Pending Actions</h3>
            <div className="space-y-4">
              {pendingActions.map((action, index) => (
                <div key={index} className="p-4 rounded-lg border border-slate-200">
                  <div className="flex items-start justify-between mb-3">
                    <AlertCircle className="w-5 h-5 text-orange-500" />
                    <Badge variant="secondary">{action.count}</Badge>
                  </div>
                  <p className="text-slate-700 text-sm mb-3">{action.message}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => {
                      if (action.type === 'unassigned' || action.type === 'declined') {
                        onNavigate('find-doctors');
                      } else {
                        onNavigate('assignments');
                      }
                    }}
                  >
                    {action.action}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
