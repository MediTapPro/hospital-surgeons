'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHeader } from '../PageHeader';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Search, Plus, Loader2 } from 'lucide-react';
import { StatusBadge } from '../StatusBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { UsersDataTable } from './UsersDataTable';
import { toast } from 'sonner';
import apiClient from '@/lib/api/httpClient';
import { USER_ACCOUNT_STATUS_ACTIONS, type UserAccountStatus } from '@/lib/enums/users.enums';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  verificationStatus: string;
  subscriptionStatus: string | null;
  subscriptionTier: string | null;
  subscriptionPlanName: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  phone: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  doctorId?: string | null;
  hospitalId?: string | null;
}

interface UserDetail extends User {
  profileData?: any;
  activeSubscription?: any;
  recentAuditLogs?: any[];
  assignmentStats?: {
    total: number;
    completed: number;
    pending: number;
    cancelled: number;
  };
}

export function UsersManagement() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [roleFilter, setRoleFilter] = useState(searchParams.get('role') || 'all');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [activeTab, setActiveTab] = useState('all');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1'));
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [showUserDetail, setShowUserDetail] = useState(false);
  const [loadingUserDetail, setLoadingUserDetail] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [page, pageSize, roleFilter, statusFilter, searchQuery, activeTab]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set('page', page.toString());
    if (activeTab !== 'all') {
      params.set('role', activeTab === 'doctors' ? 'doctor' : activeTab === 'hospitals' ? 'hospital' : activeTab === 'patients' ? 'patient' : 'admin');
    } else if (roleFilter !== 'all') {
      params.set('role', roleFilter);
    }
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (searchQuery) params.set('search', searchQuery);

    const newUrl = params.toString() ? `/admin/users?${params.toString()}` : '/admin/users';
    router.replace(newUrl, { scroll: false });
  }, [page, roleFilter, statusFilter, searchQuery, activeTab, router]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
      });

      if (activeTab !== 'all') {
        params.append('role', activeTab === 'doctors' ? 'doctor' : activeTab === 'hospitals' ? 'hospital' : activeTab === 'patients' ? 'patient' : 'admin');
      } else if (roleFilter !== 'all') {
        params.append('role', roleFilter.toLowerCase());
      }

      if (statusFilter !== 'all') {
        params.append('status', statusFilter.toLowerCase());
      }

      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const response = await apiClient.get(`/api/admin/users?${params.toString()}`);
      const data = response.data;

      if (data.success) {
        setUsers(data.data);
        setTotalCount(data.pagination?.total || 0);
      } else {
        toast.error('Failed to fetch users');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDetail = async (userId: string) => {
    try {
      setLoadingUserDetail(true);
      const response = await apiClient.get(`/api/admin/users/${userId}`);
      const data = response.data;

      if (data.success) {
        setSelectedUser(data.data);
        setShowUserDetail(true);
      } else {
        toast.error('Failed to fetch user details');
      }
    } catch (error) {
      console.error('Error fetching user details:', error);
      toast.error('Failed to fetch user details');
    } finally {
      setLoadingUserDetail(false);
    }
  };

  const updateUserStatus = async (userId: string, newStatus: string) => {
    try {
      setUpdating(userId);
      const response = await apiClient.put(`/api/admin/users/${userId}/status`, { status: newStatus });
      const data = response.data;

      if (data.success) {
        toast.success('User status updated successfully');
        fetchUsers();
        if (showUserDetail && selectedUser?.id === userId) {
          fetchUserDetail(userId);
        }
      } else {
        toast.error(data.message || 'Failed to update user status');
      }
    } catch (error) {
      console.error('Error updating user status:', error);
      toast.error('Failed to update user status');
    } finally {
      setUpdating(null);
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      setUpdating(userId);
      const response = await apiClient.put(`/api/admin/users/${userId}/role`, { role: newRole });
      const data = response.data;

      if (data.success) {
        toast.success('User role updated successfully');
        fetchUsers();
        if (showUserDetail && selectedUser?.id === userId) {
          fetchUserDetail(userId);
        }
      } else {
        toast.error(data.message || 'Failed to update user role');
      }
    } catch (error) {
      console.error('Error updating user role:', error);
      toast.error('Failed to update user role');
    } finally {
      setUpdating(null);
    }
  };

  const createAdmin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (adminPassword !== confirmAdminPassword) {
      toast.error('Passwords do not match');
      return;
    }
    try {
      setCreatingAdmin(true);
      const response = await apiClient.post('/api/admin/users/admin', { email: adminEmail, password: adminPassword });
      if (response.data.success) {
        toast.success('Administrator created successfully');
        setShowCreateAdmin(false);
        setAdminEmail('');
        setAdminPassword('');
        setConfirmAdminPassword('');
        fetchUsers();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create administrator');
    } finally {
      setCreatingAdmin(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusAction = (user: User) =>
    USER_ACCOUNT_STATUS_ACTIONS[user.status as UserAccountStatus] ?? USER_ACCOUNT_STATUS_ACTIONS.pending;

  // Use users directly from API (already filtered on backend)
  const filteredUsers = users;

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader 
        title="Users Management" 
        description="Manage doctors, hospitals, and administrators"
        actions={
          <Button className="bg-navy-600 hover:bg-navy-700" onClick={() => setShowCreateAdmin(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Admin
          </Button>
        }
      />

      <div className="p-8">
        <Tabs 
          value={activeTab} 
          onValueChange={(value) => {
            setActiveTab(value);
            setRoleFilter('all');
            setPage(1);
          }} 
          className="space-y-6"
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="doctors">Doctors</TabsTrigger>
            <TabsTrigger value="hospitals">Hospitals</TabsTrigger>
            <TabsTrigger value="patients">Patients</TabsTrigger>
            <TabsTrigger value="admins">Admins</TabsTrigger>
          </TabsList>

          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(1);
                    }}
                    className="pl-10"
                  />
                </div>
                <Select 
                  value={activeTab !== 'all' ? 'all' : roleFilter} 
                  onValueChange={(value) => { 
                    setRoleFilter(value); 
                    setActiveTab('all');
                    setPage(1); 
                  }}
                  disabled={activeTab !== 'all'}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="doctor">Doctor</SelectItem>
                    <SelectItem value="hospital">Hospital</SelectItem>
                    <SelectItem value="patient">Patient</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-600 mb-4" />
                <p className="text-slate-600">Loading users...</p>
              </div>
            ) : (
              <UsersDataTable
                users={filteredUsers}
                loadingUserDetail={loadingUserDetail}
                updatingUserId={updating}
                onView={fetchUserDetail}
                onStatusChange={updateUserStatus}
                pagination={{ page, pageSize, total: totalCount, onPageChange: setPage, onPageSizeChange: (size) => { setPageSize(size); setPage(1); }, disabled: loading }}
              />
            )}
          </div>
        </Tabs>
      </div>

      <Dialog open={showCreateAdmin} onOpenChange={setShowCreateAdmin}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Administrator</DialogTitle>
            <DialogDescription>Create an active administrator account. Provider verification is not required.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={createAdmin} autoComplete="off">
            <div className="space-y-2"><label className="text-sm font-medium text-slate-700" htmlFor="new-admin-email">Email</label><Input id="new-admin-email" name="new-admin-email" type="email" autoComplete="off" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} required /></div>
            <div className="space-y-2"><label className="text-sm font-medium text-slate-700" htmlFor="new-admin-password">Password</label><Input id="new-admin-password" name="new-admin-password" type="password" autoComplete="new-password" minLength={8} value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} required /></div>
            <div className="space-y-2"><label className="text-sm font-medium text-slate-700" htmlFor="confirm-new-admin-password">Confirm password</label><Input id="confirm-new-admin-password" name="confirm-new-admin-password" type="password" autoComplete="new-password" minLength={8} value={confirmAdminPassword} onChange={(event) => setConfirmAdminPassword(event.target.value)} required /></div>
            <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setShowCreateAdmin(false)} disabled={creatingAdmin}>Cancel</Button><Button type="submit" disabled={creatingAdmin}>{creatingAdmin ? 'Creating...' : 'Create Admin'}</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      {/* User Detail Modal */}
      <Dialog open={showUserDetail} onOpenChange={setShowUserDetail}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>
              View and manage user information
            </DialogDescription>
          </DialogHeader>
          
          {loadingUserDetail ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-600 mb-4" />
              <p className="text-slate-600">Loading user details...</p>
            </div>
          ) : selectedUser ? (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="min-w-0">
                  <label className="text-sm font-medium text-slate-600 block mb-1">Name</label>
                  <p className="text-slate-900 break-words">{selectedUser.name}</p>
                </div>
                <div className="min-w-0">
                  <label className="text-sm font-medium text-slate-600 block mb-1">Email</label>
                  <p className="text-slate-900 break-words">{selectedUser.email}</p>
                </div>
                <div className="min-w-0">
                  <label className="text-sm font-medium text-slate-600 block mb-1">Role</label>
                  <p className="text-slate-900 capitalize">{selectedUser.role}</p>
                </div>
                <div className="min-w-0">
                  <label className="text-sm font-medium text-slate-600 block mb-1">Status</label>
                  <StatusBadge status={selectedUser.status} />
                </div>
                <div className="min-w-0">
                  <label className="text-sm font-medium text-slate-600 block mb-1">Verification</label>
                  <StatusBadge status={selectedUser.verificationStatus} />
                </div>
                <div className="min-w-0">
                  <label className="text-sm font-medium text-slate-600 block mb-1">Last Login</label>
                  <p className="text-slate-900">{formatDate(selectedUser.lastLoginAt)}</p>
                </div>
              </div>

              <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">Account access</h3>
                  <p className="text-sm text-slate-600">
                    {selectedUser.status === 'active'
                      ? 'Suspend this account to prevent new portal access.'
                      : 'Activate this account to allow portal access.'}
                  </p>
                </div>
                <Button
                  variant={selectedUser.status === 'active' ? 'outline' : 'default'}
                  onClick={() => {
                    const statusAction = getStatusAction(selectedUser);
                    updateUserStatus(selectedUser.id, statusAction.nextStatus);
                  }}
                  disabled={updating === selectedUser.id}
                >
                  {updating === selectedUser.id ? 'Updating...' : getStatusAction(selectedUser).label}
                </Button>
              </section>

              {/* Profile Data */}
              {selectedUser.profileData && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Profile Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(selectedUser.profileData).map(([key, value]) => (
                      <div key={key} className="min-w-0">
                        <label className="text-sm font-medium text-slate-600 block mb-1">
                          {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </label>
                        <p className="text-slate-900 break-words whitespace-pre-wrap">{String(value || 'N/A')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Subscription */}
              {selectedUser.activeSubscription && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Active Subscription</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="min-w-0">
                      <label className="text-sm font-medium text-slate-600 block mb-1">Plan</label>
                      <p className="text-slate-900 break-words">{selectedUser.activeSubscription.planName}</p>
                    </div>
                    <div className="min-w-0">
                      <label className="text-sm font-medium text-slate-600 block mb-1">Status</label>
                      <StatusBadge status={selectedUser.activeSubscription.status} />
                    </div>
                    <div className="min-w-0">
                      <label className="text-sm font-medium text-slate-600 block mb-1">Start Date</label>
                      <p className="text-slate-900">{formatDate(selectedUser.activeSubscription.startDate)}</p>
                    </div>
                    <div className="min-w-0">
                      <label className="text-sm font-medium text-slate-600 block mb-1">End Date</label>
                      <p className="text-slate-900">{formatDate(selectedUser.activeSubscription.endDate)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Assignment Stats */}
              {selectedUser.assignmentStats && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Assignment Statistics</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="min-w-0">
                      <label className="text-sm font-medium text-slate-600 block mb-1">Total</label>
                      <p className="text-2xl font-bold text-slate-900">{selectedUser.assignmentStats.total}</p>
                    </div>
                    <div className="min-w-0">
                      <label className="text-sm font-medium text-slate-600 block mb-1">Completed</label>
                      <p className="text-2xl font-bold text-teal-600">{selectedUser.assignmentStats.completed}</p>
                    </div>
                    <div className="min-w-0">
                      <label className="text-sm font-medium text-slate-600 block mb-1">Pending</label>
                      <p className="text-2xl font-bold text-amber-600">{selectedUser.assignmentStats.pending}</p>
                    </div>
                    <div className="min-w-0">
                      <label className="text-sm font-medium text-slate-600 block mb-1">Cancelled</label>
                      <p className="text-2xl font-bold text-red-600">{selectedUser.assignmentStats.cancelled}</p>
                    </div>
                  </div>
                </div>
              )}

            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
