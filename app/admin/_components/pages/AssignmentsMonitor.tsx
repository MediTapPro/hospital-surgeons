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

interface Assignment {
  id: string;
  hospital: { id: string; name: string };
  doctor: { id: string; name: string };
  patient: { id: string; name: string };
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
  const [totalPages, setTotalPages] = useState(1);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [statusUpdate, setStatusUpdate] = useState('');
  const [treatmentNotes, setTreatmentNotes] = useState('');

  useEffect(() => {
    fetchAssignments();
    fetchStats();
  }, [activeTab, searchQuery, page]);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
      });
      if (activeTab !== 'all') {
        params.append('status', activeTab);
      }
      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const res = await fetch(`/api/admin/assignments?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setAssignments(data.data || []);
        setTotalPages(data.pagination?.totalPages || 1);
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
      const res = await fetch('/api/admin/assignments/stats');
      const data = await res.json();

      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchAssignmentDetails = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/assignments/${id}`);
      const data = await res.json();

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
      const res = await fetch(`/api/admin/assignments/${selectedAssignment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: statusUpdate,
          treatmentNotes: treatmentNotes || undefined,
        }),
      });

      const data = await res.json();

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

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader 
        title="Assignments Monitor" 
        description="Track and manage doctor-hospital assignments"
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
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-slate-600">Hospital</th>
                        <th className="px-6 py-3 text-left text-slate-600">Doctor</th>
                        <th className="px-6 py-3 text-left text-slate-600">Patient</th>
                        <th className="px-6 py-3 text-left text-slate-600">Requested</th>
                        <th className="px-6 py-3 text-left text-slate-600">Priority</th>
                        <th className="px-6 py-3 text-left text-slate-600">Status</th>
                        <th className="px-6 py-3 text-left text-slate-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredAssignments.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                            No assignments found
                          </td>
                        </tr>
                      ) : (
                        filteredAssignments.map((assignment) => (
                          <tr key={assignment.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4 text-slate-900">{assignment.hospital.name}</td>
                            <td className="px-6 py-4 text-slate-900">{assignment.doctor.name}</td>
                            <td className="px-6 py-4 text-slate-600">{assignment.patient.name}</td>
                            <td className="px-6 py-4 text-slate-600">
                              {new Date(assignment.requestedAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4">
                              <StatusBadge status={assignment.priority} />
                            </td>
                            <td className="px-6 py-4">
                              <StatusBadge status={assignment.status} />
                            </td>
                            <td className="px-6 py-4">
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => fetchAssignmentDetails(assignment.id)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  {/* Pagination */}
                  {!loading && totalPages > 1 && (
                    <div className="p-4 border-t border-slate-200 flex items-center justify-between">
                      <div className="text-sm text-slate-600">
                        Page {page} of {totalPages}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page === 1}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                          disabled={page === totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
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
                  <Label>Hospital</Label>
                  <p className="text-slate-900 mt-1">{selectedAssignment.hospital.name}</p>
                </div>
                <div>
                  <Label>Doctor</Label>
                  <p className="text-slate-900 mt-1">{selectedAssignment.doctor.name}</p>
                </div>
                <div>
                  <Label>Patient</Label>
                  <p className="text-slate-900 mt-1">{selectedAssignment.patient.name}</p>
                </div>
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
