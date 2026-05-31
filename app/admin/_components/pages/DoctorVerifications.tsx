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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';

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
  const [totalPages, setTotalPages] = useState(1);
  const [updating, setUpdating] = useState<string | null>(null);
  const [credentialActionId, setCredentialActionId] = useState<string | null>(null);

  useEffect(() => {
    fetchDoctors();
  }, [page, searchQuery, activeTab]);

  const fetchDoctors = async () => {
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

      const response = await fetch(`/api/admin/verifications/doctors?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setDoctors(data.data);
        setTotalPages(data.pagination.totalPages);
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
      const response = await fetch(`/api/admin/verifications/doctors/${doctorId}`);
      const data = await response.json();

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
      const response = await fetch(`/api/admin/verifications/doctors/${selectedDoctor.id}/verify`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });

      const data = await response.json();

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
      const response = await fetch(`/api/admin/verifications/doctors/${selectedDoctor.id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason, notes }),
      });

      const data = await response.json();

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
      const response = await fetch(`/api/admin/doctor-credentials/${credentialId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verificationStatus: status,
          notes: reason || notes || (status === 'verified' ? 'Credential verified by admin' : undefined),
        }),
      });

      const data = await response.json();

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

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader 
        title="Doctor Verifications" 
        description="Review and verify doctor registration applications"
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
                      placeholder="Search by name, email, or license number..."
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
                  <p className="text-slate-600">Loading doctors...</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-slate-600">Doctor</th>
                          <th className="px-6 py-3 text-left text-slate-600">Email</th>
                          <th className="px-6 py-3 text-left text-slate-600">License Number</th>
                          <th className="px-6 py-3 text-left text-slate-600">Experience</th>
                          <th className="px-6 py-3 text-left text-slate-600">Credentials</th>
                          <th className="px-6 py-3 text-left text-slate-600">Submitted</th>
                          <th className="px-6 py-3 text-left text-slate-600">Status</th>
                          <th className="px-6 py-3 text-left text-slate-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {doctors.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                              No doctors found
                            </td>
                          </tr>
                        ) : (
                          doctors.map((doctor) => (
                            <tr key={doctor.id} className="hover:bg-slate-50">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-semibold">
                                    {doctor.firstName.charAt(0)}{doctor.lastName.charAt(0)}
                                  </div>
                                  <div>
                                    <div className="text-slate-900">{doctor.name}</div>
                                    <div className="text-slate-500 text-sm">{doctor.primaryLocation || 'N/A'}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-slate-600 text-sm">{doctor.email}</td>
                              <td className="px-6 py-4 text-slate-900 text-sm">{doctor.medicalLicenseNumber}</td>
                              <td className="px-6 py-4 text-slate-600">{doctor.yearsOfExperience} years</td>
                              <td className="px-6 py-4 text-slate-600">
                                {doctor.credentialsCount} ({doctor.pendingCredentialsCount} pending)
                              </td>
                              <td className="px-6 py-4 text-slate-600 text-sm">{formatDate(doctor.createdAt)}</td>
                              <td className="px-6 py-4">
                                <StatusBadge status={doctor.licenseVerificationStatus} />
                              </td>
                              <td className="px-6 py-4">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => fetchDoctorDetail(doctor.id)}
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
      <Dialog open={!!selectedDoctor} onOpenChange={() => setSelectedDoctor(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col bg-white dark:bg-gray-900 p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-200 flex-shrink-0">
            <DialogTitle>Doctor Verification Review</DialogTitle>
            <DialogDescription>
              Review doctor credentials and documents before verification
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0 overflow-x-hidden">
            {loadingDetail ? (
              <div className="p-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-600 mb-4" />
                <p className="text-slate-600">Loading doctor details...</p>
              </div>
            ) : selectedDoctor ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                      <p className="text-slate-500 text-center py-8">No credentials uploaded</p>
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

          <DialogFooter className="flex items-center justify-between border-t border-gray-200 px-6 py-4 flex-shrink-0 bg-gray-50">
            <Button
              variant="outline"
              onClick={() => setSelectedDoctor(null)}
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
