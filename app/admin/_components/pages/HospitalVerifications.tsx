'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '../PageHeader';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Search, Eye, Check, X, Download, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import { StatusBadge } from '../StatusBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';
import apiClient from '@/lib/api/httpClient';
import { AdminDataTable, type AdminDataTableColumn } from '../ui/AdminDataTable';

interface Hospital {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  registrationNumber: string;
  licenseVerificationStatus: string;
  hospitalType: string | null;
  address: string;
  city: string;
  numberOfBeds: number | null;
  documentsCount: number;
  pendingDocumentsCount: number;
  createdAt: string;
}

interface HospitalDetail extends Hospital {
  userId: string;
  latitude: string | null;
  longitude: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  websiteUrl: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  documents: Array<{
    id: string;
    documentType: string;
    verificationStatus: string;
    uploadedAt: string;
    file: {
      id: string;
      filename: string;
      url: string;
      mimetype: string;
      size: number;
    };
  }>;
  departments: Array<{
    id: string;
    name: string;
  }>;
  verificationHistory: Array<{
    id: string;
    action: string;
    details: any;
    createdAt: string;
  }>;
}

export function HospitalVerifications() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<HospitalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [notes, setNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('pending');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchHospitals();
  }, [page, searchQuery, activeTab]);

  const fetchHospitals = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        status: activeTab === 'pending' ? 'pending' : activeTab === 'approved' ? 'verified' : 'rejected',
      });

      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const response = await apiClient.get(`/api/admin/verifications/hospitals?${params.toString()}`);
      const data = response.data;

      if (data.success) {
        setHospitals(data.data);
        setTotalPages(data.pagination.totalPages);
      } else {
        toast.error('Failed to fetch hospitals');
      }
    } catch (error) {
      console.error('Error fetching hospitals:', error);
      toast.error('Failed to fetch hospitals');
    } finally {
      setLoading(false);
    }
  };

  const fetchHospitalDetail = async (hospitalId: string) => {
    try {
      setLoadingDetail(true);
      const response = await apiClient.get(`/api/admin/verifications/hospitals/${hospitalId}`);
      const data = response.data;

      if (data.success) {
        setSelectedHospital(data.data);
      } else {
        toast.error('Failed to fetch hospital details');
      }
    } catch (error) {
      console.error('Error fetching hospital details:', error);
      toast.error('Failed to fetch hospital details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleVerify = async () => {
    if (!selectedHospital) return;

    try {
      setUpdating(selectedHospital.id);
      const response = await apiClient.put(`/api/admin/verifications/hospitals/${selectedHospital.id}/verify`, { notes });
      const data = response.data;

      if (data.success) {
        toast.success('Hospital verified successfully');
        setSelectedHospital(null);
        setNotes('');
        fetchHospitals();
      } else {
        toast.error(data.message || 'Failed to verify hospital');
      }
    } catch (error) {
      console.error('Error verifying hospital:', error);
      toast.error('Failed to verify hospital');
    } finally {
      setUpdating(null);
    }
  };

  const handleReject = async () => {
    if (!selectedHospital || !rejectReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    try {
      setUpdating(selectedHospital.id);
      const response = await apiClient.put(`/api/admin/verifications/hospitals/${selectedHospital.id}/reject`, { reason: rejectReason, notes });
      const data = response.data;

      if (data.success) {
        toast.success('Hospital verification rejected');
        setSelectedHospital(null);
        setNotes('');
        setRejectReason('');
        setShowRejectDialog(false);
        fetchHospitals();
      } else {
        toast.error(data.message || 'Failed to reject hospital');
      }
    } catch (error) {
      console.error('Error rejecting hospital:', error);
      toast.error('Failed to reject hospital');
    } finally {
      setUpdating(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const tableColumns: AdminDataTableColumn<Hospital>[] = [
    {
      id: 'hospital', label: 'Hospital', widthClassName: 'w-[235px]',
      cell: (hospital) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-navy-100 font-semibold text-navy-700">
            {hospital.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">{hospital.name}</p>
            <p className="truncate text-sm text-slate-500">{hospital.registrationNumber}</p>
          </div>
        </div>
      ),
    },
    { id: 'email', label: 'Email', widthClassName: 'w-[275px]', cellClassName: 'text-slate-600', cell: (hospital) => hospital.email },
    { id: 'type', label: 'Type', widthClassName: 'w-[130px]', cellClassName: 'whitespace-nowrap font-medium text-slate-900', cell: (hospital) => hospital.hospitalType || 'N/A' },
    { id: 'beds', label: 'Beds', widthClassName: 'w-[110px]', cellClassName: 'whitespace-nowrap text-slate-600', cell: (hospital) => hospital.numberOfBeds || 'N/A' },
    { id: 'documents', label: 'Documents', widthClassName: 'w-[165px]', cellClassName: 'whitespace-nowrap text-slate-600', cell: (hospital) => `${hospital.documentsCount} (${hospital.pendingDocumentsCount} pending)` },
    { id: 'submitted', label: 'Submitted', widthClassName: 'w-[145px]', cellClassName: 'whitespace-nowrap text-slate-600', cell: (hospital) => formatDate(hospital.createdAt) },
    { id: 'status', label: 'Status', widthClassName: 'w-[125px]', cell: (hospital) => <StatusBadge status={hospital.licenseVerificationStatus} /> },
    {
      id: 'actions', label: 'Actions', widthClassName: 'w-[135px]', sticky: 'right',
      cell: (hospital) => (
        <Button size="sm" variant="ghost" onClick={() => fetchHospitalDetail(hospital.id)} disabled={loadingDetail} className="w-full justify-center whitespace-nowrap">
          <Eye className="mr-1 h-4 w-4" />
          Review
        </Button>
      ),
    },
  ];

  return (
    <div className="min-h-full bg-slate-50">
      <PageHeader 
        title="Hospital Verifications" 
        description="Review and verify hospital registration applications"
      />

      <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
        <Tabs 
          value={activeTab} 
          onValueChange={(value) => {
            setActiveTab(value);
            setPage(1);
          }} 
          className="space-y-6"
        >
          <TabsList className="h-11 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                <div className="relative max-w-2xl">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      placeholder="Search by name, type, or registration number..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setPage(1);
                      }}
                      className="h-11 border-slate-300 bg-white pl-10 shadow-sm"
                    />
                  </div>
              </div>

              {loading ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-600 mb-4" />
                  <p className="text-slate-600">Loading hospitals...</p>
                </div>
              ) : (
                <>
                  <AdminDataTable
                    columns={tableColumns}
                    data={hospitals}
                    emptyMessage="No hospitals found"
                    getRowKey={(hospital) => hospital.id}
                    minWidthClassName="min-w-[1300px]"
                  />

                  {totalPages > 1 && (
                    <div className="flex flex-col gap-3 border-t border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
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
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Verification Detail Modal */}
      <Dialog open={!!selectedHospital} onOpenChange={() => setSelectedHospital(null)}>
        <DialogContent size="wide" className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-slate-200 px-6 pb-4 pt-6">
            <DialogTitle>Hospital Verification Review</DialogTitle>
            <DialogDescription>
              Review hospital documents and information before verification
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-6 py-6">
            {loadingDetail ? (
              <div className="p-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-600 mb-4" />
                <p className="text-slate-600">Loading hospital details...</p>
              </div>
            ) : selectedHospital ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              {/* Left Panel - Profile */}
              <div className="space-y-6">
                <div className="bg-slate-50 rounded-lg p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-20 h-20 rounded bg-navy-100 flex items-center justify-center text-navy-700 font-bold text-xl">
                      {selectedHospital.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-slate-900">{selectedHospital.name}</h3>
                      <p className="text-slate-600 mt-1">{selectedHospital.email}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <StatusBadge status={selectedHospital.licenseVerificationStatus} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-600">Registration Number</label>
                    <p className="text-slate-900 mt-1">{selectedHospital.registrationNumber}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600">Hospital Type</label>
                    <p className="text-slate-900 mt-1">{selectedHospital.hospitalType || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600">Address</label>
                    <p className="text-slate-900 mt-1">{selectedHospital.address}, {selectedHospital.city}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600">Number of Beds</label>
                    <p className="text-slate-900 mt-1">{selectedHospital.numberOfBeds || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600">Contact</label>
                    <p className="text-slate-900 mt-1">
                      {selectedHospital.contactPhone || selectedHospital.phone || 'N/A'}
                    </p>
                    <p className="text-slate-900 mt-1">
                      {selectedHospital.contactEmail || selectedHospital.email}
                    </p>
                  </div>
                  {selectedHospital.websiteUrl && (
                    <div>
                      <label className="text-sm font-medium text-slate-600">Website</label>
                      <p className="text-slate-900 mt-1">
                        <a href={selectedHospital.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">
                          {selectedHospital.websiteUrl}
                        </a>
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-slate-600">Departments</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedHospital.departments.length === 0 ? (
                        <span className="text-slate-500">No departments</span>
                      ) : (
                        selectedHospital.departments.map((dept) => (
                          <span key={dept.id} className="px-2 py-1 bg-navy-100 text-navy-700 rounded text-sm">
                            {dept.name}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-600 mb-2 block">Admin Notes</label>
                  <Textarea
                    placeholder="Add notes about this verification..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                  />
                </div>
              </div>

              {/* Right Panel - Documents */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-600 mb-2 block">Documents</label>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {selectedHospital.documents.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-slate-500">No documents uploaded</div>
                    ) : (
                      selectedHospital.documents.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center">
                              <span className="text-red-600 text-xs">PDF</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-slate-900 font-medium">{doc.documentType}</p>
                              <p className="text-slate-500 text-sm">{doc.file.filename}</p>
                              <p className="text-slate-400 text-xs mt-1">
                                {formatDate(doc.uploadedAt)} • <StatusBadge status={doc.verificationStatus} variant="small" />
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => window.open(doc.file.url, '_blank')}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = doc.file.url;
                                link.download = doc.file.filename;
                                link.click();
                              }}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {selectedHospital.verificationHistory.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-slate-600 mb-2 block">Verification History</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {selectedHospital.verificationHistory.map((log) => (
                        <div key={log.id} className="p-2 bg-slate-50 rounded text-sm">
                          <p className="text-slate-900">
                            <span className="font-medium">{log.action}</span> - {formatDate(log.createdAt)}
                          </p>
                          {log.details?.notes && (
                            <p className="text-slate-600 mt-1">{log.details.notes}</p>
                          )}
                          {log.details?.reason && (
                            <p className="text-red-600 mt-1">Reason: {log.details.reason}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            ) : null}
          </div>

          <DialogFooter className="shrink-0 justify-end border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setShowRejectDialog(true)}
                className="border-red-600 text-red-600 hover:bg-red-50"
                disabled={updating === selectedHospital?.id}
              >
                <X className="w-4 h-4 mr-2" />
                Reject
              </Button>
              <Button
                onClick={handleVerify}
                className="bg-green-600 hover:bg-green-700"
                disabled={updating === selectedHospital?.id}
              >
                {updating === selectedHospital?.id ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Approve
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Confirmation Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle>Reject Hospital Verification</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this hospital's verification.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-600 mb-2 block">Rejection Reason *</label>
              <Textarea
                placeholder="Enter the reason for rejection..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600 mb-2 block">Additional Notes</label>
              <Textarea
                placeholder="Optional additional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              className="bg-red-600 hover:bg-red-700"
              disabled={!rejectReason.trim() || updating === selectedHospital?.id}
            >
              {updating === selectedHospital?.id ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <X className="w-4 h-4 mr-2" />
              )}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
