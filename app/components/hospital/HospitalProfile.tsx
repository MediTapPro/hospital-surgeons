'use client';

import { useState, useEffect } from 'react';
import { Building2, Mail, Phone, Globe, MapPin, Upload, Star, Award, CheckCircle, Loader2, Save, X, AlertCircle, Camera, Plus, FileText, Trash2, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { useRouter } from 'next/navigation';
import { PageHeader } from '../../hospital/_components/PageHeader';
import apiClient from '@/lib/api/httpClient';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';

interface HospitalData {
  id: string;
  name: string;
  hospitalType?: string;
  registrationNumber: string;
  contactEmail?: string;
  contactPhone?: string;
  websiteUrl?: string;
  address: string;
  city: string;
  numberOfBeds?: number;
  licenseVerificationStatus: 'pending' | 'verified' | 'rejected';
  logoId?: string;
  logo?: {
    url?: string;
  };
}

interface Department {
  id: string;
  specialtyId: string;
  specialty?: {
    name: string;
  };
  isActive: boolean;
}

export function HospitalProfile() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [hospitalId, setHospitalId] = useState<string | null>(null);
  const [hospitalData, setHospitalData] = useState<HospitalData | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [specialties, setSpecialties] = useState<any[]>([]);
  const [showAddDepartment, setShowAddDepartment] = useState(false);
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    hospitalType: '',
    registrationNumber: '',
    contactEmail: '',
    contactPhone: '',
    websiteUrl: '',
    address: '',
    city: '',
    fullAddress: '',
    state: '',
    pincode: '',
    numberOfBeds: '',
  });
  const [selectedLogo, setSelectedLogo] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [showUploadDocument, setShowUploadDocument] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<'license' | 'accreditation' | 'insurance' | 'other'>('license');
  const [uploadingDocument, setUploadingDocument] = useState(false);

  useEffect(() => {
    fetchHospitalProfile();
    fetchSpecialties();
  }, []);

  useEffect(() => {
    if (hospitalId) {
      fetchDepartments();
      fetchDocuments();
    }
  }, [hospitalId]);

  const fetchHospitalProfile = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/hospitals/profile');
      const data = response.data;

      if (data.success && data.data) {
        const hospital = data.data;
        setHospitalId(hospital.id);
        setHospitalData(hospital);
        setFormData({
          name: hospital.name || '',
          hospitalType: hospital.hospitalType || '',
          registrationNumber: hospital.registrationNumber || '',
          contactEmail: hospital.contactEmail || '',
          contactPhone: hospital.contactPhone || '',
          websiteUrl: hospital.websiteUrl || '',
          address: hospital.address || '',
          city: hospital.city || '',
          fullAddress: hospital.fullAddress || hospital.full_address || '',
          state: hospital.state || '',
          pincode: hospital.pincode || '',
          numberOfBeds: hospital.numberOfBeds?.toString() || '',
        });
        
        // Fetch logo if available
        if (hospital.logoId) {
          try {
            const logoResponse = await apiClient.get(`/api/files/${hospital.logoId}`);
            if (logoResponse.data.success && logoResponse.data.data?.url) {
              setLogoUrl(logoResponse.data.data.url);
            }
          } catch (err) {
            console.error('Error fetching logo:', err);
          }
        }
      }
    } catch (error: any) {
      console.error('Error fetching hospital profile:', error);
      if (error.response?.status === 401) {
        router.push('/login');
        return;
      }
      toast.error('Failed to load hospital profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchSpecialties = async () => {
    try {
      const response = await apiClient.get('/api/specialties/active');
      if (response.data.success && response.data.data) {
        setSpecialties(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching specialties:', error);
    }
  };

  const fetchDepartments = async () => {
    if (!hospitalId) return;
    try {
      const response = await apiClient.get(`/api/hospitals/${hospitalId}/departments`);
      if (response.data.success && response.data.data) {
        setDepartments(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const handleLogoUpload = async () => {
    if (!selectedLogo || !hospitalId) {
      toast.error('Please select a logo to upload');
      return;
    }

    try {
      setUploadingLogo(true);
      
      // Single API call - backend handles file upload and profile update
      const formData = new FormData();
      formData.append('file', selectedLogo);

      const response = await apiClient.post(`/api/hospitals/${hospitalId}/logo/upload`, formData);

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to upload logo');
      }

      toast.success('Logo uploaded successfully');
      setSelectedLogo(null);
      setLogoUrl(response.data.data.url);
      fetchHospitalProfile();
    } catch (error: any) {
      console.error('Logo upload error:', error);
      toast.error(error.response?.data?.message || 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    if (!hospitalId) return;

    try {
      setSaving(true);
      const updateData: any = {
        name: formData.name,
        hospitalType: formData.hospitalType || undefined,
        registrationNumber: formData.registrationNumber,
        contactEmail: formData.contactEmail || undefined,
        contactPhone: formData.contactPhone || undefined,
        websiteUrl: formData.websiteUrl || undefined,
        address: formData.address,
        city: formData.city,
        fullAddress: formData.fullAddress || undefined,
        state: formData.state || undefined,
        pincode: formData.pincode || undefined,
        numberOfBeds: formData.numberOfBeds ? parseInt(formData.numberOfBeds) : undefined,
      };

      const response = await apiClient.patch(`/api/hospitals/${hospitalId}`, updateData);

      if (response.data.success) {
        toast.success('Profile updated successfully');
        fetchHospitalProfile();
      } else {
        toast.error(response.data.message || 'Failed to update profile');
      }
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const fetchDocuments = async () => {
    if (!hospitalId) return;
    try {
      const response = await apiClient.get(`/api/hospitals/${hospitalId}/documents`);
      if (response.data.success && response.data.data) {
        setDocuments(response.data.data);
      } else if (response.status === 401 || response.status === 403) {
        toast.error(response.data.message || 'You do not have permission to access hospital documents');
        router.push('/login');
      }
    } catch (error: any) {
      console.error('Error fetching documents:', error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        toast.error(error.response?.data?.message || 'You do not have permission to access hospital documents');
        router.push('/login');
      } else {
        toast.error('Failed to load documents');
      }
    }
  };

  const handleAddDepartment = async () => {
    if (!hospitalId || !selectedSpecialty) {
      toast.error('Please select a specialty');
      return;
    }

    try {
      const response = await apiClient.post(`/api/hospitals/${hospitalId}/departments`, {
        specialtyId: selectedSpecialty,
        isActive: true,
      });

      if (response.data.success) {
        toast.success('Department added successfully');
        setShowAddDepartment(false);
        setSelectedSpecialty('');
        fetchDepartments();
      } else {
        toast.error(response.data.message || 'Failed to add department');
      }
    } catch (error: any) {
      console.error('Error adding department:', error);
      toast.error(error.response?.data?.message || 'Failed to add department');
    }
  };

  const handleDocumentUpload = async () => {
    if (!selectedDocument || !hospitalId) {
      toast.error('Please select a document to upload');
      return;
    }

    try {
      setUploadingDocument(true);
      
      // Single API call - backend handles file upload and document creation
      const formData = new FormData();
      formData.append('file', selectedDocument);
      formData.append('documentType', documentType);

      const response = await apiClient.post(`/api/hospitals/${hospitalId}/documents/upload`, formData);

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to upload document');
      }

      toast.success('Document uploaded successfully');
      setShowUploadDocument(false);
      setSelectedDocument(null);
      setDocumentType('license');
      fetchDocuments();
    } catch (error: any) {
      console.error('Document upload error:', error);
      toast.error(error.response?.data?.message || 'Failed to upload document');
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!hospitalId) return;
    
    if (!confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      const response = await apiClient.delete(`/api/hospitals/${hospitalId}/documents/${documentId}`);
      if (response.data.success) {
        toast.success('Document deleted successfully');
        fetchDocuments();
      } else {
        toast.error(response.data.message || 'Failed to delete document');
      }
    } catch (error: any) {
      console.error('Error deleting document:', error);
      toast.error(error.response?.data?.message || 'Failed to delete document');
    }
  };

  const handleDownloadDocument = async (fileId: string, filename: string) => {
    try {
      const response = await apiClient.get(`/api/files/${fileId}/download`, {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error downloading document:', error);
      toast.error('Failed to download document');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-600 mb-4" />
          <p className="text-slate-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!hospitalData) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Profile Not Found</h2>
          <p className="text-slate-600 mb-4">Hospital profile could not be loaded.</p>
          <Button onClick={fetchHospitalProfile}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader 
        title="Hospital Profile" 
        description="Manage your hospital information and settings"
      />
      <div className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Profile */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="text-slate-900">Basic Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-6 mb-6">
                  <div className="relative">
                    {logoUrl || selectedLogo ? (
                      <div className="w-32 h-32 rounded-lg overflow-hidden border-4 border-slate-200 bg-slate-100">
                        <img
                          src={selectedLogo ? URL.createObjectURL(selectedLogo) : logoUrl || ''}
                          alt="Hospital Logo"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-32 h-32 bg-teal-100 rounded-lg flex items-center justify-center">
                        <Building2 className="w-16 h-16 text-teal-600" />
                      </div>
                    )}
                    <label
                      htmlFor="logo-upload"
                      className="absolute -bottom-2 -right-2 w-10 h-10 bg-teal-600 hover:bg-teal-700 rounded-full flex items-center justify-center cursor-pointer border-4 border-white shadow-lg transition-colors"
                    >
                      <Camera className="w-5 h-5 text-white" />
                      <input
                        type="file"
                        id="logo-upload"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 5 * 1024 * 1024) {
                              toast.error('Image size must be less than 5MB');
                              return;
                            }
                            setSelectedLogo(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h2 className="text-slate-900 text-xl font-semibold">{hospitalData.name}</h2>
                      {hospitalData.licenseVerificationStatus === 'verified' && (
                        <CheckCircle className="w-5 h-5 text-teal-600" />
                      )}
                    </div>
                    <p className="text-slate-500 mb-4">{hospitalData.hospitalType || 'Hospital'}</p>
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className="text-slate-700">
                        Reg: {hospitalData.registrationNumber}
                      </Badge>
                      {hospitalData.numberOfBeds && (
                        <Badge variant="outline" className="text-slate-700">
                          {hospitalData.numberOfBeds} Beds
                        </Badge>
                      )}
                      <Badge 
                        variant={hospitalData.licenseVerificationStatus === 'verified' ? 'default' : 'secondary'}
                        className={
                          hospitalData.licenseVerificationStatus === 'verified' 
                            ? 'bg-teal-100 text-teal-800' 
                            : ''
                        }
                      >
                        {hospitalData.licenseVerificationStatus === 'verified' ? 'Verified' : 
                         hospitalData.licenseVerificationStatus === 'pending' ? 'Pending' : 'Rejected'}
                      </Badge>
                    </div>
                  </div>
                </div>

                {selectedLogo && (
                  <div className="mb-4 p-3 bg-teal-50 border border-teal-200 rounded-lg flex items-center justify-between">
                    <span className="text-sm text-teal-800">Logo ready to upload</span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleLogoUpload}
                        disabled={uploadingLogo}
                        className="bg-teal-600 hover:bg-teal-700"
                      >
                        {uploadingLogo ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Upload
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedLogo(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="hospitalName" className="text-slate-700">
                        Hospital Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="hospitalName"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hospitalType" className="text-slate-700">Hospital Type</Label>
                      <Input
                        id="hospitalType"
                        value={formData.hospitalType}
                        onChange={(e) => setFormData({ ...formData, hospitalType: e.target.value })}
                        placeholder="e.g., Multi-Specialty Hospital"
                        className="bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="registrationNumber" className="text-slate-700">
                        Registration Number <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="registrationNumber"
                        value={formData.registrationNumber}
                        onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="numberOfBeds" className="text-slate-700">Number of Beds</Label>
                      <Input
                        id="numberOfBeds"
                        type="number"
                        value={formData.numberOfBeds}
                        onChange={(e) => setFormData({ ...formData, numberOfBeds: e.target.value })}
                        className="bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-slate-700">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          id="email"
                          type="email"
                          className="pl-10 bg-white"
                          value={formData.contactEmail}
                          onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-slate-700">Phone</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          id="phone"
                          type="tel"
                          className="pl-10 bg-white"
                          value={formData.contactPhone}
                          onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="website" className="text-slate-700">Website</Label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="website"
                        type="url"
                        className="pl-10 bg-white"
                        value={formData.websiteUrl}
                        onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                        placeholder="https://www.example.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fullAddress" className="text-slate-700">Full Address</Label>
                    <Input
                      id="fullAddress"
                      value={formData.fullAddress}
                      onChange={(e) => setFormData({ ...formData, fullAddress: e.target.value })}
                      placeholder="Street address, building name, etc."
                      className="bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="address" className="text-slate-700">
                        Address <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                        <Textarea
                          id="address"
                          className="pl-10 bg-white"
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                          rows={3}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city" className="text-slate-700">
                        City <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="city"
                        className="bg-white"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="state" className="text-slate-700">State</Label>
                      <Input
                        id="state"
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pincode" className="text-slate-700">Pincode</Label>
                      <Input
                        id="pincode"
                        value={formData.pincode}
                        onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                        maxLength={10}
                        className="bg-white"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleSave}
                    disabled={saving || !formData.name || !formData.registrationNumber || !formData.address || !formData.city}
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Departments */}
            <Card className="bg-white">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-slate-900">Available Departments</CardTitle>
                  <Button
                    size="sm"
                    onClick={() => setShowAddDepartment(true)}
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Department
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {departments.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <p>No departments added yet.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => setShowAddDepartment(true)}
                    >
                      Add Your First Department
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {departments
                      .filter((dept) => dept && (dept.id || dept.specialtyId))
                      .map((dept, index) => (
                        <Badge
                          key={dept.id || `dept-${dept.specialtyId}-${index}`}
                          variant="secondary"
                          className="px-3 py-1.5 text-sm bg-teal-50 text-teal-800 border-teal-200"
                        >
                          {dept.specialty?.name || 'Unknown Specialty'}
                        </Badge>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Documents */}
            <Card className="bg-white">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-slate-900">Documents</CardTitle>
                  <Button
                    size="sm"
                    onClick={() => setShowUploadDocument(true)}
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Upload
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {documents.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                    <p className="mb-4">No documents uploaded yet.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowUploadDocument(true)}
                    >
                      Upload Your First Document
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-4 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <FileText className="w-4 h-4 text-slate-400" />
                              <p className="text-sm font-medium text-slate-900">
                                {doc.file?.filename || 'Document'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge
                                variant="outline"
                                className="text-xs"
                              >
                                {doc.documentType}
                              </Badge>
                              {doc.verificationStatus === 'verified' && (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              )}
                              {doc.verificationStatus === 'pending' && (
                                <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">
                                  Pending
                                </Badge>
                              )}
                              {doc.verificationStatus === 'rejected' && (
                                <Badge variant="destructive" className="text-xs">
                                  Rejected
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-2">
                              Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadDocument(doc.fileId, doc.file?.filename || 'document')}
                            className="flex-1"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="text-slate-900">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Departments</span>
                    <span className="text-slate-900 font-semibold">{departments.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Documents</span>
                    <span className="text-slate-900 font-semibold">{documents.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Verification Status</span>
                    <Badge
                      variant={hospitalData.licenseVerificationStatus === 'verified' ? 'default' : 'secondary'}
                      className={
                        hospitalData.licenseVerificationStatus === 'verified'
                          ? 'bg-teal-100 text-teal-800'
                          : ''
                      }
                    >
                      {hospitalData.licenseVerificationStatus === 'verified' ? 'Verified' :
                       hospitalData.licenseVerificationStatus === 'pending' ? 'Pending' : 'Rejected'}
                    </Badge>
                  </div>
                  {hospitalData.numberOfBeds && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Beds</span>
                      <span className="text-slate-900 font-semibold">{hospitalData.numberOfBeds}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Add Department Dialog */}
      <Dialog open={showAddDepartment} onOpenChange={setShowAddDepartment}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>Add Department</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Specialty</Label>
              <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
                <SelectTrigger>
                  <SelectValue placeholder="Select specialty" />
                </SelectTrigger>
                <SelectContent>
                  {specialties
                    .filter(spec => !departments.some(dept => dept.specialtyId === spec.id))
                    .map((spec) => (
                      <SelectItem key={spec.id} value={spec.id}>
                        {spec.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddDepartment(false);
              setSelectedSpecialty('');
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleAddDepartment}
              disabled={!selectedSpecialty}
              className="bg-teal-600 hover:bg-teal-700"
            >
              Add Department
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Document Dialog */}
      <Dialog open={showUploadDocument} onOpenChange={setShowUploadDocument}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="documentType">Document Type</Label>
              <Select value={documentType} onValueChange={(value: 'license' | 'accreditation' | 'insurance' | 'other') => setDocumentType(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="license">License</SelectItem>
                  <SelectItem value="accreditation">Accreditation</SelectItem>
                  <SelectItem value="insurance">Insurance</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="documentFile">Document File</Label>
              <Input
                id="documentFile"
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setSelectedDocument(e.target.files[0]);
                  }
                }}
                className="bg-white"
              />
              {selectedDocument && (
                <p className="text-sm text-slate-600">
                  Selected: {selectedDocument.name} ({(selectedDocument.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowUploadDocument(false);
              setSelectedDocument(null);
              setDocumentType('license');
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleDocumentUpload}
              disabled={!selectedDocument || uploadingDocument}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {uploadingDocument ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Document
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
