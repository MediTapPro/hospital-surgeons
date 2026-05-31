'use client';

import {
  Upload,
  FileText,
  Download,
  Eye,
  CheckCircle,
  Clock,
  X,
  Plus,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';

interface CredentialFile {
  id: string;
  filename: string;
  url: string;
  mimetype: string;
  size: number;
}

interface Credential {
  id: string;
  credentialType: string;
  title: string;
  institution: string | null;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  uploadedAt: string;
  file?: CredentialFile | null;
}

const credentialTypes = [
  { value: 'degree', label: 'Degree' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'license', label: 'License' },
  { value: 'other', label: 'Other' },
];

export default function CredentialsDocumentsPage() {
  const router = useRouter();
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    type: '',
    title: '',
    institution: '',
  });

  useEffect(() => {
    fetchDoctorProfile();
  }, []);

  useEffect(() => {
    if (doctorId) {
      fetchCredentials();
    }
  }, [doctorId]);

  const fetchDoctorProfile = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setError('Please log in to continue.');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/doctors/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (!data.success || !data.data?.id) {
        setError('Please complete your doctor profile to upload credentials.');
        setLoading(false);
        return;
      }

      setDoctorId(data.data.id);
    } catch (err) {
      console.error('Error fetching doctor profile:', err);
      setError('Failed to load profile. Please refresh the page.');
      setLoading(false);
    }
  };

  const fetchCredentials = async () => {
    if (!doctorId) return;
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/doctors/${doctorId}/credentials`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (data.success && Array.isArray(data.data)) {
        setCredentials(data.data);
      } else {
        setError(data.message || 'Failed to load credentials');
      }
    } catch (err) {
      console.error('Error fetching credentials:', err);
      setError('Failed to load credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const total = credentials.length;
    const verified = credentials.filter((c) => c.verificationStatus === 'verified').length;
    const pending = credentials.filter((c) => c.verificationStatus === 'pending').length;
    const rejected = credentials.filter((c) => c.verificationStatus === 'rejected').length;
    return { total, verified, pending, rejected };
  }, [credentials]);

  const handleUploadCredential = async () => {
    if (!doctorId) {
      toast.error('Doctor profile not found.');
      return;
    }
    if (!selectedFile) {
      toast.error('Please select a file to upload.');
      return;
    }
    if (!form.type || !form.title) {
      toast.error('Please provide credential type and title.');
      return;
    }

    try {
      setUploading(true);
      const token = localStorage.getItem('accessToken');
      if (!token) {
        toast.error('Session expired. Please log in again.');
        return;
      }

      // Single API call - backend handles file upload and credential creation
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('credentialType', form.type);
      formData.append('title', form.title);
      if (form.institution) {
        formData.append('institution', form.institution);
      }

      const response = await fetch(`/api/doctors/${doctorId}/credentials/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to upload credential');
      }

      toast.success('Credential uploaded successfully');
      setShowUploadModal(false);
      setSelectedFile(null);
      setForm({ type: '', title: '', institution: '' });
      fetchCredentials();
    } catch (err) {
      console.error('Credential upload error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to upload credential');
    } finally {
      setUploading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold">
            <CheckCircle className="w-3 h-3" /> Verified
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-semibold">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold">
            <X className="w-3 h-3" /> Rejected
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const handleViewFile = (credential: Credential) => {
    if (credential.file?.url) {
      window.open(credential.file.url, '_blank');
    } else {
      toast.error('File not available');
    }
  };

  const handleDownloadFile = async (credential: Credential) => {
    if (!credential.file?.id) {
      toast.error('File not available');
      return;
    }
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        toast.error('Session expired. Please log in again.');
        return;
      }

      // Use the download API endpoint which forces download
      const response = await fetch(`/api/files/${credential.file.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to download file');
      }

      // Get the blob and create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = credential.file?.filename || credential.title;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      toast.error('Failed to download file. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 mb-2 text-2xl font-bold">Credentials & Documents</h1>
          <p className="text-gray-600">Upload and manage your professional documents for admin verification.</p>
        </div>
        <Button onClick={() => setShowUploadModal(true)} className="bg-teal-600 hover:bg-teal-700">
          <Plus className="w-4 h-4 mr-2" />
          Upload Credential
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-4 border border-amber-200 bg-amber-50 rounded-lg text-amber-800">
          <AlertCircle className="w-5 h-5 mt-0.5" />
          <div>
            <p className="font-medium">Heads up</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Documents" value={stats.total} color="text-slate-900" />
        <StatCard label="Verified" value={stats.verified} color="text-green-600" />
        <StatCard label="Pending Review" value={stats.pending} color="text-amber-600" />
        <StatCard label="Rejected" value={stats.rejected} color="text-red-600" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {credentials.length === 0 ? (
          <div className="col-span-full bg-white border border-dashed border-slate-300 rounded-lg p-10 text-center">
            <div className="w-16 h-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Upload className="w-7 h-7 text-slate-500" />
            </div>
            <p className="text-slate-900 font-semibold">No credentials uploaded yet</p>
            <p className="text-slate-500 text-sm mt-2">
              Upload your degrees, licenses, or certifications to speed up verification.
            </p>
            <Button onClick={() => setShowUploadModal(true)} className="mt-4 bg-teal-600 hover:bg-teal-700">
              <Plus className="w-4 h-4 mr-2" />
              Upload Credential
            </Button>
          </div>
        ) : (
          credentials.map((credential) => (
            <div key={credential.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                {getStatusBadge(credential.verificationStatus)}
              </div>

              <h4 className="text-gray-900 mb-1 font-semibold">{credential.title}</h4>
              <p className="text-sm text-gray-600 mb-3 capitalize">{credential.credentialType}</p>

              {credential.institution && (
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-sm text-gray-500">🏛️</span>
                  <span className="text-sm text-gray-700">{credential.institution}</span>
                </div>
              )}

              <div className="flex items-center gap-2 mb-3 text-sm text-gray-600">
                <span>📅</span>
                <span>Uploaded on {formatDate(credential.uploadedAt)}</span>
              </div>

              {credential.file && (
                <div className="text-xs text-gray-500 mb-4">
                  {credential.file.filename} • {(credential.file.size / 1024 / 1024).toFixed(2)} MB
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 text-xs" onClick={() => handleViewFile(credential)}>
                  <Eye className="w-3 h-3 mr-1" /> View
                </Button>
                <Button variant="outline" className="flex-1 text-xs" onClick={() => handleDownloadFile(credential)}>
                  <Download className="w-3 h-3 mr-1" /> Download
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>Upload Credential</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">Credential Type</label>
              <Select value={form.type} onValueChange={(value) => setForm((prev) => ({ ...prev, type: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select credential type" />
                </SelectTrigger>
                <SelectContent>
                  {credentialTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">Title</label>
              <Input
                placeholder="e.g. MBBS Degree"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">Institution (optional)</label>
              <Input
                placeholder="e.g. AIIMS Delhi"
                value={form.institution}
                onChange={(e) => setForm((prev) => ({ ...prev, institution: e.target.value }))}
              />
            </div>

            <div className="border border-dashed border-slate-300 rounded-lg p-4 text-center">
              <input
                type="file"
                id="credential-file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
              <label htmlFor="credential-file" className="cursor-pointer flex flex-col items-center gap-2">
                <Upload className="w-6 h-6 text-slate-500" />
                {selectedFile ? (
                  <div className="text-slate-900 text-sm font-medium">{selectedFile.name}</div>
                ) : (
                  <>
                    <p className="text-slate-900 font-medium text-sm">Drag & drop or click to upload</p>
                    <p className="text-slate-500 text-xs">PDF or image, max 5MB</p>
                  </>
                )}
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleUploadCredential} disabled={uploading}>
              {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className={`text-2xl mb-1 font-bold ${color}`}>{value}</div>
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  );
}

