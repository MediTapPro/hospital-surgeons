'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '../PageHeader';
import { StatCard } from '../StatCard';
import { Button } from '../ui/button';
import { Building2, Clock, Check, X, Star, Loader2, Plus } from 'lucide-react';
import { StatusBadge } from '../StatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';

interface Affiliation {
  id: string;
  doctor: { id: string; name: string };
  hospital: { id: string; name: string };
  status: string;
  isPreferred: boolean;
  createdAt: string;
}

export function Affiliations() {
  const [affiliations, setAffiliations] = useState<Affiliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAffiliation, setSelectedAffiliation] = useState<Affiliation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({ doctorId: '', hospitalId: '', status: 'active', isPreferred: false });

  useEffect(() => {
    fetchAffiliations();
  }, [statusFilter]);

  const fetchAffiliations = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      params.append('limit', '100');

      const res = await fetch(`/api/admin/affiliations?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setAffiliations(data.data || []);
      } else {
        toast.error(data.message || 'Failed to fetch affiliations');
      }
    } catch (error) {
      console.error('Error fetching affiliations:', error);
      toast.error('Failed to fetch affiliations');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.doctorId || !formData.hospitalId) {
      toast.error('Doctor and Hospital are required');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/admin/affiliations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Affiliation created successfully');
        setShowAddModal(false);
        setFormData({ doctorId: '', hospitalId: '', status: 'active', isPreferred: false });
        fetchAffiliations();
      } else {
        toast.error(data.message || 'Failed to create affiliation');
      }
    } catch (error) {
      console.error('Error creating affiliation:', error);
      toast.error('Failed to create affiliation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/admin/affiliations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Affiliation updated successfully');
        fetchAffiliations();
      } else {
        toast.error(data.message || 'Failed to update affiliation');
      }
    } catch (error) {
      console.error('Error updating affiliation:', error);
      toast.error('Failed to update affiliation');
    }
  };

  const handleTogglePreferred = async (id: string, currentValue: boolean) => {
    try {
      const res = await fetch(`/api/admin/affiliations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPreferred: !currentValue }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Preferred status updated');
        fetchAffiliations();
      } else {
        toast.error(data.message || 'Failed to update preferred status');
      }
    } catch (error) {
      console.error('Error updating preferred status:', error);
      toast.error('Failed to update preferred status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this affiliation?')) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/affiliations/${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Affiliation deleted successfully');
        fetchAffiliations();
      } else {
        toast.error(data.message || 'Failed to delete affiliation');
      }
    } catch (error) {
      console.error('Error deleting affiliation:', error);
      toast.error('Failed to delete affiliation');
    }
  };

  const activeCount = affiliations.filter(a => a.status === 'active').length;
  const pendingCount = affiliations.filter(a => a.status === 'pending').length;

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader 
        title="Affiliations" 
        description="Manage doctor-hospital affiliations and partnerships"
        actions={
          <Button onClick={() => setShowAddModal(true)} className="bg-navy-600 hover:bg-navy-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Affiliation
          </Button>
        }
      />

      <div className="p-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <StatCard
            title="Total Active"
            value={activeCount.toString()}
            icon={Building2}
          />
          <StatCard
            title="Pending Requests"
            value={pendingCount.toString()}
            icon={Clock}
          />
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-slate-900">All Affiliations</h3>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
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
                    <th className="px-6 py-3 text-left text-slate-600">Doctor</th>
                    <th className="px-6 py-3 text-left text-slate-600">Hospital</th>
                    <th className="px-6 py-3 text-left text-slate-600">Status</th>
                    <th className="px-6 py-3 text-left text-slate-600">Preferred</th>
                    <th className="px-6 py-3 text-left text-slate-600">Created</th>
                    <th className="px-6 py-3 text-left text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {affiliations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                        No affiliations found
                      </td>
                    </tr>
                  ) : (
                    affiliations.map((affiliation) => (
                      <tr key={affiliation.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 text-slate-900">{affiliation.doctor.name}</td>
                        <td className="px-6 py-4 text-slate-900">{affiliation.hospital.name}</td>
                        <td className="px-6 py-4">
                          <StatusBadge status={affiliation.status} />
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleTogglePreferred(affiliation.id, affiliation.isPreferred)}
                            className="hover:opacity-70 transition-opacity"
                          >
                            {affiliation.isPreferred ? (
                              <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                            ) : (
                              <Star className="w-5 h-5 text-slate-300" />
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          {new Date(affiliation.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {affiliation.status === 'pending' ? (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="text-green-600"
                                  onClick={() => handleUpdateStatus(affiliation.id, 'active')}
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="text-red-600"
                                  onClick={() => handleUpdateStatus(affiliation.id, 'inactive')}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </>
                            ) : (
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => {
                                  setSelectedAffiliation(affiliation);
                                  setShowEditModal(true);
                                }}
                              >
                                View
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent aria-describedby={undefined} className="bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle>Add New Affiliation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Doctor ID</Label>
              <input
                type="text"
                value={formData.doctorId}
                onChange={(e) => setFormData({ ...formData, doctorId: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md"
                placeholder="Enter doctor ID"
              />
            </div>
            <div>
              <Label>Hospital ID</Label>
              <input
                type="text"
                value={formData.hospitalId}
                onChange={(e) => setFormData({ ...formData, hospitalId: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md"
                placeholder="Enter hospital ID"
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={submitting}
              className="bg-navy-600 hover:bg-navy-700"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
