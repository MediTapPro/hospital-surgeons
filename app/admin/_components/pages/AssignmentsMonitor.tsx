'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '../PageHeader';
import { StatCard } from '../StatCard';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Search, Filter, Eye, Loader2 } from 'lucide-react';
import { StatusBadge } from '../StatusBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ClipboardList, CheckCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import apiClient from '@/lib/api/httpClient';
import { AdminDataTable, type AdminDataTableColumn } from '../ui/AdminDataTable';

interface Assignment {
  id: string;
  source: 'home_visit' | 'hospital_assignment';
  hospital: { id: string; name: string } | null;
  doctor: { id: string; name: string };
  patient: { id: string; name: string };
  visit?: { addressLabel?: string | null; address?: string | null; recipientPhone?: string | null; relationship?: string | null } | null;
  priority: string;
  status: string;
  requestedAt: string;
  expiresAt?: string;
  treatmentNotes?: string;
  consultationFee?: number;
}

export function AssignmentsMonitor() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [statusUpdate, setStatusUpdate] = useState('');
  const [treatmentNotes, setTreatmentNotes] = useState('');

  useEffect(() => {
    fetchAssignments();
    fetchStats();
  }, [activeTab, searchQuery, page, pageSize]);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
      });
      if (activeTab !== 'all') {
        params.append('status', activeTab);
      }
      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const { data } = await apiClient.get(`/api/admin/assignments?${params.toString()}`);

      if (data.success) {
        setAssignments(data.data || []);
        setTotalCount(data.pagination?.total || 0);
      } else {
        toast.error(data.message || 'Failed to fetch assignments');
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
      toast.error('Failed to fetch assignments');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { data } = await apiClient.get('/api/admin/assignments/stats');

      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchAssignmentDetails = async (id: string) => {
    try {
      const { data } = await apiClient.get(`/api/admin/assignments/${id}`);

      if (data.success) {
        setSelectedAssignment(data.data);
        setStatusUpdate(data.data.status);
        setTreatmentNotes(data.data.treatmentNotes || '');
        setShowDetailModal(true);
      } else {
        toast.error(data.message || 'Failed to fetch assignment details');
      }
    } catch (error) {
      console.error('Error fetching assignment details:', error);
      toast.error('Failed to fetch assignment details');
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedAssignment) return;

    try {
      setUpdating(true);
      const { data } = await apiClient.put(`/api/admin/assignments/${selectedAssignment.id}`, {
          status: statusUpdate,
          treatmentNotes: treatmentNotes || undefined,
      });

      if (data.success) {
        toast.success('Assignment updated successfully');
        setShowDetailModal(false);
        fetchAssignments();
        fetchStats();
      } else {
        toast.error(data.message || 'Failed to update assignment');
      }
    } catch (error) {
      console.error('Error updating assignment:', error);
      toast.error('Failed to update assignment');
    } finally {
      setUpdating(false);
    }
  };

  // Use assignments directly from API (already filtered on backend)
  const filteredAssignments = assignments;

  const columns: AdminDataTableColumn<Assignment>[] = [
    { id: 'source', label: 'Source', widthClassName: 'w-[170px]', cell: (row) => <StatusBadge status={row.source === 'home_visit' ? 'home visit' : 'hospital'} /> },
    { id: 'provider', label: 'Doctor', widthClassName: 'w-[230px]', cell: (row) => <span className="font-medium text-slate-900">{row.doctor.name}</span> },
    { id: 'patient', label: 'Patient', widthClassName: 'w-[220px]', cell: (row) => <span>{row.patient.name}</span> },
    { id: 'requested', label: 'Requested', widthClassName: 'w-[150px]', cell: (row) => <span>{new Date(row.requestedAt).toLocaleDateString()}</span> },
    { id: 'priority', label: 'Priority', widthClassName: 'w-[130px]', cell: (row) => <StatusBadge status={row.priority} /> },
    { id: 'status', label: 'Status', widthClassName: 'w-[140px]', cell: (row) => <StatusBadge status={row.status} /> },
    { id: 'actions', label: 'Actions', widthClassName: 'w-[100px]', sticky: 'right', headerClassName: 'text-center', cellClassName: 'text-center', cell: (row) => <Button size="sm" variant="ghost" aria-label="View assignment" onClick={() => fetchAssignmentDetails(row.id)}><Eye className="h-4 w-4" /></Button> },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader 
        title="Assignments Monitor" 
        description="Track hospital assignments and patient home visits"
      />

      <div className="p-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            title="Total Today"
            value={stats?.today?.total?.toString() || '0'}
            icon={ClipboardList}
            trend={{ value: "Today's assignments", isPositive: true }}
          />
          <StatCard
            title="Pending"
            value={stats?.today?.pending?.toString() || '0'}
            icon={CheckCircle}
            trend={{ value: "Awaiting response", isPositive: false }}
          />
          <StatCard
            title="Completed"
            value={stats?.today?.completed?.toString() || '0'}
            icon={CheckCircle}
            trend={{ value: "Today", isPositive: true }}
          />
        </div>

        <Tabs 
          value={activeTab} 
          onValueChange={(value) => {
            setActiveTab(value);
            setPage(1);
          }} 
          className="space-y-6"
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="accepted">Accepted</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-slate-200">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    placeholder="Search assignments..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(1);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setPage(1);
                        fetchAssignments();
                      }
                    }}
                    className="pl-10"
                  />
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                </div>
              ) : (
                <div>
                  <AdminDataTable
                    columns={columns}
                    data={filteredAssignments}
                    emptyMessage="No assignments found"
                    getRowKey={(row) => row.id}
                    minWidthClassName="min-w-[1110px]"
                    pagination={{
                      page,
                      pageSize,
                      total: totalCount,
                      onPageChange: setPage,
                      onPageSizeChange: (size) => { setPageSize(size); setPage(1); },
                      disabled: loading,
                    }}
                  />
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent aria-describedby={undefined} className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle>Assignment Details</DialogTitle>
          </DialogHeader>
          {selectedAssignment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Source</Label>
                  <p className="mt-1"><StatusBadge status={selectedAssignment.source === 'home_visit' ? 'home visit' : 'hospital'} /></p>
                </div>
                <div>
                  <Label>Doctor</Label>
                  <p className="text-slate-900 mt-1">{selectedAssignment.doctor.name}</p>
                </div>
                <div>
                  <Label>Patient</Label>
                  <p className="text-slate-900 mt-1">{selectedAssignment.patient.name}</p>
                </div>
                {selectedAssignment.source === 'home_visit' ? (
                  <div className="col-span-2 rounded-lg border border-teal-100 bg-teal-50/50 p-4">
                    <Label>Visit address</Label>
                    <p className="mt-1 text-slate-900">{selectedAssignment.visit?.address || 'Address not available'}</p>
                  </div>
                ) : (
                  <div>
                    <Label>Hospital</Label>
                    <p className="mt-1 text-slate-900">{selectedAssignment.hospital?.name || 'Unknown'}</p>
                  </div>
                )}
                <div>
                  <Label>Priority</Label>
                  <p className="mt-1">
                    <StatusBadge status={selectedAssignment.priority} />
                  </p>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={statusUpdate} onValueChange={setStatusUpdate}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="accepted">Accepted</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Requested At</Label>
                  <p className="text-slate-600 mt-1">
                    {new Date(selectedAssignment.requestedAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <div>
                <Label>Treatment Notes</Label>
                <Textarea
                  value={treatmentNotes}
                  onChange={(e) => setTreatmentNotes(e.target.value)}
                  rows={4}
                  className="mt-1"
                  placeholder="Add treatment notes..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailModal(false)} disabled={updating}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateStatus} 
              disabled={updating}
              className="bg-navy-600 hover:bg-navy-700"
            >
              {updating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
