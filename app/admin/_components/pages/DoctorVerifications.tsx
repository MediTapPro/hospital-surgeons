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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import apiClient from '@/lib/api/httpClient';
import { AdminDataTable, type AdminDataTableColumn } from '../ui/AdminDataTable';

interface Doctor {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  medicalLicenseNumber: string;
  licenseVerificationStatus: string;
  yearsOfExperience: number;
  primaryLocation: string | null;
  averageRating: string | null;
  totalRatings: number | null;
  credentialsCount: number;
  pendingCredentialsCount: number;
  createdAt: string;
}

interface DoctorDetail extends Doctor {
  bio: string | null;
  latitude: string | null;
  longitude: string | null;
  completedAssignments: number | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  credentials: Array<{
    id: string;
    credentialType: string;
    title: string;
    institution: string | null;
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
  specialties: Array<{
    id: string;
    name: string;
    isPrimary: boolean;
    yearsOfExperience: number;
  }>;
  verificationHistory: Array<{
    id: string;
    action: string;
    details: any;
    createdAt: string;
  }>;
}

export function DoctorVerifications() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [notes, setNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('pending');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [updating, setUpdating] = useState<string | null>(null);
  const [credentialActionId, setCredentialActionId] = useState<string | null>(null);

  useEffect(() => {
    fetchDoctors();
  }, [page, pageSize, searchQuery, activeTab]);

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        status: activeTab === 'pending' ? 'pending' : activeTab === 'approved' ? 'verified' : 'rejected',
      });

      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const response = await apiClient.get(`/api/admin/verifications/doctors?${params.toString()}`);
      const data = response.data;

      if (data.success) {
        setDoctors(data.data);
        setTotalCount(data.pagination?.total || 0);
      } else {
        toast.error('Failed to fetch doctors');
      }
    } catch (error) {
      console.error('Error fetching doctors:', error);
      toast.error('Failed to fetch doctors');
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctorDetail = async (doctorId: string) => {
    try {
      setLoadingDetail(true);
      const response = await apiClient.get(`/api/admin/verifications/doctors/${doctorId}`);
      const data = response.data;

      if (data.success) {
        setSelectedDoctor(data.data);
      } else {
        toast.error('Failed to fetch doctor details');
      }
    } catch (error) {
      console.error('Error fetching doctor details:', error);
      toast.error('Failed to fetch doctor details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleVerify = async () => {
    if (!selectedDoctor) return;

    try {
      setUpdating(selectedDoctor.id);
      const response = await apiClient.put(`/api/admin/verifications/doctors/${selectedDoctor.id}/verify`, { notes });
      const data = response.data;

      if (data.success) {
        toast.success('Doctor verified successfully');
        setSelectedDoctor(null);
        setNotes('');
        fetchDoctors();
      } else {
        toast.error(data.message || 'Failed to verify doctor');
      }
    } catch (error) {
      console.error('Error verifying doctor:', error);
      toast.error('Failed to verify doctor');
    } finally {
      setUpdating(null);
    }
  };

  const handleReject = async () => {
    if (!selectedDoctor || !rejectReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    try {
      setUpdating(selectedDoctor.id);
      const response = await apiClient.put(`/api/admin/verifications/doctors/${selectedDoctor.id}/reject`, { reason: rejectReason, notes });
      const data = response.data;

      if (data.success) {
        toast.success('Doctor verification rejected');
        setSelectedDoctor(null);
        setNotes('');
        setRejectReason('');
        setShowRejectDialog(false);
        fetchDoctors();
      } else {
        toast.error(data.message || 'Failed to reject doctor');
      }
    } catch (error) {
      console.error('Error rejecting doctor:', error);
      toast.error('Failed to reject doctor');
    } finally {
      setUpdating(null);
    }
  };

  const updateCredentialStatus = async (
    credentialId: string,
    status: 'verified' | 'rejected',
    reason?: string
  ) => {
    if (!selectedDoctor) return;

    try {
      setCredentialActionId(`${credentialId}-${status}`);
      const response = await apiClient.put(`/api/admin/doctor-credentials/${credentialId}`, {
        verificationStatus: status,
        notes: reason || notes || (status === 'verified' ? 'Credential verified by admin' : undefined),
      });
      const data = response.data;

      if (data.success) {
        toast.success(`Credential ${status === 'verified' ? 'approved' : 'rejected'}`);
        fetchDoctorDetail(selectedDoctor.id);
        fetchDoctors();
      } else {
        toast.error(data.message || 'Failed to update credential');
      }
    } catch (error) {
      console.error('Error updating credential status:', error);
      toast.error('Failed to update credential');
    } finally {
      setCredentialActionId(null);
    }
  };

  const handleCredentialApprove = (credentialId: string) => {
    updateCredentialStatus(credentialId, 'verified');
  };

  const handleCredentialReject = (credentialId: string) => {
    const reason = window.prompt('Provide a reason for rejecting this credential (optional):') || undefined;
    updateCredentialStatus(credentialId, 'rejected', reason);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const tableColumns: AdminDataTableColumn<Doctor>[] = [
    {
      id: 'doctor', label: 'Doctor', widthClassName: 'w-[210px]',
      cell: (doctor) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 font-semibold text-teal-700">
            {doctor.firstName.charAt(0)}{doctor.lastName.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-slate-900">{doctor.name}</p>
            <p className="truncate text-sm text-slate-500">{doctor.primaryLocation || 'N/A'}</p>
          </div>
        </div>
      ),
    },
    { id: 'email', label: 'Email', widthClassName: 'w-[270px]', cellClassName: 'text-slate-600', cell: (doctor) => doctor.email },
    { id: 'license', label: 'License number', widthClassName: 'w-[155px]', cellClassName: 'whitespace-nowrap font-medium text-slate-900', cell: (doctor) => doctor.medicalLicenseNumber },
    { id: 'experience', label: 'Experience', widthClassName: 'w-[135px]', cellClassName: 'whitespace-nowrap text-slate-600', cell: (doctor) => `${doctor.yearsOfExperience} years` },
    { id: 'credentials', label: 'Credentials', widthClassName: 'w-[165px]', cellClassName: 'whitespace-nowrap text-slate-600', cell: (doctor) => `${doctor.credentialsCount} (${doctor.pendingCredentialsCount} pending)` },
    { id: 'submitted', label: 'Submitted', widthClassName: 'w-[145px]', cellClassName: 'whitespace-nowrap text-slate-600', cell: (doctor) => formatDate(doctor.createdAt) },
    { id: 'status', label: 'Status', widthClassName: 'w-[125px]', cell: (doctor) => <StatusBadge status={doctor.licenseVerificationStatus} /> },
    {
      id: 'actions', label: 'Actions', widthClassName: 'w-[135px]', sticky: 'right',
      cell: (doctor) => (
        <Button size="sm" variant="ghost" onClick={() => fetchDoctorDetail(doctor.id)} disabled={loadingDetail} className="w-full justify-center whitespace-nowrap">
          <Eye className="mr-1 h-4 w-4" />
          Review
        </Button>
      ),
    },
  ];

  return (
    <div className="min-h-full bg-slate-50">
      <PageHeader 
        title="Doctor Verifications" 
        description="Review and verify doctor registration applications"
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
                      placeholder="Search by name, email, or license number..."
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
                  <p className="text-slate-600">Loading doctors...</p>
                </div>
              ) : (
                <>
                  <AdminDataTable
                    columns={tableColumns}
                    data={doctors}
                    emptyMessage="No doctors found"
                    getRowKey={(doctor) => doctor.id}
                    minWidthClassName="min-w-[1340px]"
                    pagination={{ page, pageSize, total: totalCount, onPageChange: setPage, onPageSizeChange: (size) => { setPageSize(size); setPage(1); }, disabled: loading }}
                  />
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Verification Detail Modal */}
      <Dialog open={!!selectedDoctor} onOpenChange={() => setSelectedDoctor(null)}>
        <DialogContent size="wide" className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-slate-200 px-6 pb-4 pt-6">
            <DialogTitle>Doctor Verification Review</DialogTitle>
            <DialogDescription>
              Review doctor credentials and documents before verification
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-6 py-6">
            {loadingDetail ? (
              <div className="p-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-600 mb-4" />
                <p className="text-slate-600">Loading doctor details...</p>
              </div>
            ) : selectedDoctor ? (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              {/* Left Panel - Profile */}
              <div className="space-y-6 min-w-0">
                <div className="bg-slate-50 rounded-lg p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-20 h-20 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-xl flex-shrink-0">
                      {selectedDoctor.firstName.charAt(0)}{selectedDoctor.lastName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-slate-900 break-words">{selectedDoctor.name}</h3>
                      <p className="text-slate-600 mt-1 break-words">{selectedDoctor.email}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <StatusBadge status={selectedDoctor.licenseVerificationStatus} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-600">License Number</label>
                    <p className="text-slate-900 mt-1 break-words">{selectedDoctor.medicalLicenseNumber}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600">Years of Experience</label>
                    <p className="text-slate-900 mt-1">{selectedDoctor.yearsOfExperience} years</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600">Primary Location</label>
                    <p className="text-slate-900 mt-1 break-words">{selectedDoctor.primaryLocation || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600">Specialties</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedDoctor.specialties.map((spec) => (
                        <span key={spec.id} className="px-2 py-1 bg-teal-100 text-teal-700 rounded text-sm break-words">
                          {spec.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  {selectedDoctor.bio && (
                    <div>
                      <label className="text-sm font-medium text-slate-600">Bio</label>
                      <p className="text-slate-900 mt-1 break-words whitespace-pre-wrap overflow-wrap-anywhere">{selectedDoctor.bio}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-slate-600">Rating</label>
                    <p className="text-slate-900 mt-1">
                      {selectedDoctor.averageRating || 'N/A'} ({selectedDoctor.totalRatings || 0} ratings)
                    </p>
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
              <div className="space-y-4 min-w-0">
                <div>
                  <label className="text-sm font-medium text-slate-600 mb-2 block">Credentials & Documents</label>
                  <div className="space-y-2 max-h-96 overflow-y-auto overflow-x-hidden">
                    {selectedDoctor.credentials.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-slate-500">No credentials uploaded</div>
                    ) : (
                      selectedDoctor.credentials.map((cred) => (
                        <div key={cred.id} className="p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center flex-shrink-0">
                                <span className="text-red-600 text-xs">PDF</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-slate-900 font-medium break-words">{cred.title}</p>
                                <p className="text-slate-500 text-sm break-words">{cred.credentialType} • {cred.institution || 'N/A'}</p>
                                <p className="text-slate-400 text-xs mt-1 break-words">
                                  {formatDate(cred.uploadedAt)} • <StatusBadge status={cred.verificationStatus} variant="small" />
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => cred.file?.url && window.open(cred.file.url, '_blank')}
                                disabled={!cred.file?.url}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={async () => {
                                  if (!cred.file?.id) return;
                                  try {
                                    const response = await fetch(`/api/files/${cred.file.id}/download`);
                                    if (!response.ok) throw new Error('Download failed');
                                    const blob = await response.blob();
                                    const url = window.URL.createObjectURL(blob);
                                    const link = document.createElement('a');
                                    link.href = url;
                                    link.download = cred.file.filename;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                    window.URL.revokeObjectURL(url);
                                  } catch (err) {
                                    console.error('Download error:', err);
                                    toast.error('Failed to download file');
                                  }
                                }}
                                disabled={!cred.file?.id}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          {cred.verificationStatus === 'pending' && (
                            <div className="flex gap-2 mt-3 pt-3 border-t border-slate-200">
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white flex-1"
                                onClick={() => handleCredentialApprove(cred.id)}
                                disabled={credentialActionId === `${cred.id}-verified`}
                              >
                                {credentialActionId === `${cred.id}-verified` ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <Check className="w-4 h-4 mr-2" />
                                )}
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleCredentialReject(cred.id)}
                                disabled={credentialActionId === `${cred.id}-rejected`}
                                className="flex-1"
                              >
                                {credentialActionId === `${cred.id}-rejected` ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <X className="w-4 h-4 mr-2" />
                                )}
                                Reject
                              </Button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {selectedDoctor.verificationHistory.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-slate-600 mb-2 block">Verification History</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto overflow-x-hidden">
                      {selectedDoctor.verificationHistory.map((log) => (
                        <div key={log.id} className="p-2 bg-slate-50 rounded text-sm">
                          <p className="text-slate-900 break-words">
                            <span className="font-medium">{log.action}</span> - {formatDate(log.createdAt)}
                          </p>
                          {log.details?.notes && (
                            <p className="text-slate-600 mt-1 break-words whitespace-pre-wrap">{log.details.notes}</p>
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
                disabled={updating === selectedDoctor?.id}
              >
                <X className="w-4 h-4 mr-2" />
                Reject
              </Button>
              <Button
                onClick={handleVerify}
                className="bg-green-600 hover:bg-green-700"
                disabled={updating === selectedDoctor?.id}
              >
                {updating === selectedDoctor?.id ? (
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
            <DialogTitle>Reject Doctor Verification</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this doctor's verification.
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
              disabled={!rejectReason.trim() || updating === selectedDoctor?.id}
            >
              {updating === selectedDoctor?.id ? (
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
