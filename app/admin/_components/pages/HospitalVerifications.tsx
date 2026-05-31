'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '../PageHeader';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Search, Eye, Check, X, MessageSquare, Download, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import { StatusBadge } from '../StatusBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';

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

      const response = await fetch(`/api/admin/verifications/hospitals?${params.toString()}`);
      const data = await response.json();

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
      const response = await fetch(`/api/admin/verifications/hospitals/${hospitalId}`);
      const data = await response.json();

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
      const response = await fetch(`/api/admin/verifications/hospitals/${selectedHospital.id}/verify`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });

      const data = await response.json();

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
      const response = await fetch(`/api/admin/verifications/hospitals/${selectedHospital.id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason, notes }),
      });

      const data = await response.json();

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

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader 
        title="Hospital Verifications" 
        description="Review and verify hospital registration applications"
      />

      <div className="p-8">
        <Tabs 
          value={activeTab} 
          onValueChange={(value) => {
            setActiveTab(value);
            setPage(1);
          }} 
          className="space-y-6"
        >
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-slate-200">
                <div className="flex items-center gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      placeholder="Search by name, type, or registration number..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setPage(1);
                      }}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-600 mb-4" />
                  <p className="text-slate-600">Loading hospitals...</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-slate-600">Hospital</th>
                          <th className="px-6 py-3 text-left text-slate-600">Email</th>
                          <th className="px-6 py-3 text-left text-slate-600">Type</th>
                          <th className="px-6 py-3 text-left text-slate-600">Beds</th>
                          <th className="px-6 py-3 text-left text-slate-600">Documents</th>
                          <th className="px-6 py-3 text-left text-slate-600">Submitted</th>
                          <th className="px-6 py-3 text-left text-slate-600">Status</th>
                          <th className="px-6 py-3 text-left text-slate-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {hospitals.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                              No hospitals found
                            </td>
                          </tr>
                        ) : (
                          hospitals.map((hospital) => (
                            <tr key={hospital.id} className="hover:bg-slate-50">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded bg-navy-100 flex items-center justify-center text-navy-700 font-semibold">
                                    {hospital.name.charAt(0)}
                                  </div>
                                  <div>
                                    <div className="text-slate-900">{hospital.name}</div>
                                    <div className="text-slate-500 text-sm">{hospital.registrationNumber}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-slate-600 text-sm">{hospital.email}</td>
                              <td className="px-6 py-4 text-slate-900">{hospital.hospitalType || 'N/A'}</td>
                              <td className="px-6 py-4 text-slate-600">{hospital.numberOfBeds || 'N/A'}</td>
                              <td className="px-6 py-4 text-slate-600">
                                {hospital.documentsCount} ({hospital.pendingDocumentsCount} pending)
                              </td>
                              <td className="px-6 py-4 text-slate-600 text-sm">{formatDate(hospital.createdAt)}</td>
                              <td className="px-6 py-4">
                                <StatusBadge status={hospital.licenseVerificationStatus} />
                              </td>
                              <td className="px-6 py-4">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => fetchHospitalDetail(hospital.id)}
                                  disabled={loadingDetail}
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  Review
                                </Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {totalPages > 1 && (
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
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Verification Detail Modal */}
      <Dialog open={!!selectedHospital} onOpenChange={() => setSelectedHospital(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col bg-white dark:bg-gray-900 p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-200 flex-shrink-0">
            <DialogTitle>Hospital Verification Review</DialogTitle>
            <DialogDescription>
              Review hospital documents and information before verification
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
            {loadingDetail ? (
              <div className="p-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-600 mb-4" />
                <p className="text-slate-600">Loading hospital details...</p>
              </div>
            ) : selectedHospital ? (
            <div className="grid grid-cols-2 gap-6">
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
                      <p className="text-slate-500 text-center py-8">No documents uploaded</p>
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

          <DialogFooter className="flex items-center justify-between border-t border-gray-200 px-6 py-4 flex-shrink-0 bg-gray-50">
            <Button
              variant="outline"
              onClick={() => setSelectedHospital(null)}
              className="border-amber-600 text-amber-600 hover:bg-amber-50"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Request Info
            </Button>
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
