'use client';

import { Save, X, CheckCircle, AlertCircle, Loader2, Upload, Camera } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth/utils';
import { toast } from 'sonner';

export default function CompleteProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'verified' | 'rejected'>('pending');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [profilePhotoId, setProfilePhotoId] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    licenseNumber: '',
    yearsOfExperience: '',
    bio: '',
    fullAddress: '',
    city: '',
    state: '',
    pincode: '',
  });
  const [userInfo, setUserInfo] = useState({
    email: '',
    phone: '',
  });

  useEffect(() => {
    if (isAuthenticated()) {
      fetchProfile();
    } else {
      router.push('/login');
    }
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setError('No authentication token found');
        setLoading(false);
        return;
      }
      
      const response = await fetch('/api/doctors/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      
      console.log('Profile API Response:', { status: response.status, result });
      
      if (response.status === 404 || !result.success) {
        // Profile doesn't exist yet - show empty form for creation
        console.log('Profile not found, showing empty form');
        setDoctorId(null);
        setFormData({
          firstName: '',
          lastName: '',
          licenseNumber: '',
          yearsOfExperience: '',
          bio: '',
          fullAddress: '',
          city: '',
          state: '',
          pincode: '',
        });
        setUserInfo({
          email: '',
          phone: '',
        });
        setProfilePhotoUrl(null);
        setProfilePhotoId(null);
        setVerificationStatus('pending');
        setLoading(false);
        return;
      }
      
      if (result.success && result.data) {
        const doctor = result.data;
        console.log('Doctor data received:', doctor);
        
        setDoctorId(doctor.id);
        setFormData({
          firstName: doctor.firstName || '',
          lastName: doctor.lastName || '',
          licenseNumber: doctor.medicalLicenseNumber || doctor.medical_license_number || '',
          yearsOfExperience: doctor.yearsOfExperience?.toString() || doctor.years_of_experience?.toString() || '',
          bio: doctor.bio || '',
          fullAddress: doctor.fullAddress || doctor.full_address || '',
          city: doctor.city || '',
          state: doctor.state || '',
          pincode: doctor.pincode || '',
        });
        // User info (email, phone) might be in a separate user object or not returned
        setUserInfo({
          email: (doctor as any).email || '',
          phone: (doctor as any).phone || '',
        });
        // Set profile photo
        if (doctor.profilePhotoId) {
          setProfilePhotoId(doctor.profilePhotoId);
          // Fetch photo URL from files API
          fetch(`/api/files/${doctor.profilePhotoId}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((res) => res.json())
            .then((fileData) => {
              if (fileData.success && fileData.data?.url) {
                setProfilePhotoUrl(fileData.data.url);
              }
            })
            .catch((err) => console.error('Error fetching profile photo:', err));
        }
        // Set verification status based on license verification
        const verificationStatus = doctor.licenseVerificationStatus || doctor.license_verification_status || 'pending';
        if (verificationStatus === 'verified') {
          setVerificationStatus('verified');
        } else if (verificationStatus === 'rejected') {
          setVerificationStatus('rejected');
        } else {
          setVerificationStatus('pending');
        }
      } else {
        console.error('Unexpected response format:', result);
        setError('Failed to load profile: ' + (result.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to load profile: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async () => {
    if (!selectedPhoto) {
      toast.error('Please select a photo to upload');
      return;
    }

    try {
      setUploadingPhoto(true);
      const token = localStorage.getItem('accessToken');
      if (!token) {
        toast.error('Session expired. Please log in again.');
        return;
      }

      if (doctorId) {
        // Existing profile: Single API call - backend handles file upload and profile update
        const formData = new FormData();
        formData.append('file', selectedPhoto);

        const response = await fetch(`/api/doctors/${doctorId}/profile-photo/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.message || 'Failed to upload photo');
        }

        toast.success('Profile photo updated successfully');
        setSelectedPhoto(null);
        setProfilePhotoId(data.data.fileId);
        setProfilePhotoUrl(data.data.url);
      } else {
        // New profile: Upload photo first, store fileId for when profile is created
        // Use general upload endpoint (will be moved to proper folder when profile is created)
        const formData = new FormData();
        formData.append('file', selectedPhoto);
        // Note: For new profiles, we upload to temp location
        // Backend will handle folder structure - frontend doesn't specify folder/bucket

        const response = await fetch('/api/files/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.message || 'Failed to upload photo');
        }

        // Store photo ID for when profile is created
        setProfilePhotoId(data.data.fileId);
        setProfilePhotoUrl(data.data.url);
        toast.success('Photo uploaded. It will be saved when you create your profile.');
      }
    } catch (err) {
      console.error('Photo upload error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    // Validate required fields
    if (!formData.firstName || !formData.lastName || !formData.licenseNumber || !formData.yearsOfExperience) {
      setError('Please fill in all required fields (First Name, Last Name, License Number, Years of Experience)');
      return;
    }
    
    // Validate location - city and state are required
    if (!formData.city || !formData.state) {
      setError('Please provide both City and State');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const token = localStorage.getItem('accessToken');
      
      if (!doctorId) {
        // Create new profile
        const response = await fetch('/api/doctors/profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            firstName: formData.firstName,
            lastName: formData.lastName,
            medicalLicenseNumber: formData.licenseNumber,
            yearsOfExperience: formData.yearsOfExperience ? parseInt(formData.yearsOfExperience) : null,
            bio: formData.bio,
            fullAddress: formData.fullAddress,
            city: formData.city,
            state: formData.state,
            pincode: formData.pincode,
            profilePhotoId: profilePhotoId,
          }),
        });

        const result = await response.json();
        
        if (result.success) {
          toast.success('Profile created successfully!');
          fetchProfile(); // Refresh to get the doctor ID
        } else {
          setError(result.message || 'Failed to create profile');
        }
      } else {
        // Update existing profile
        const response = await fetch(`/api/doctors/${doctorId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            firstName: formData.firstName,
            lastName: formData.lastName,
            medicalLicenseNumber: formData.licenseNumber,
            yearsOfExperience: parseInt(formData.yearsOfExperience) || 0,
            bio: formData.bio || null,
            fullAddress: formData.fullAddress,
            city: formData.city,
            state: formData.state,
            pincode: formData.pincode,
            ...(profilePhotoId && { profilePhotoId }),
          }),
        });

        if (response.status === 401) {
          // Token expired or invalid - redirect to login
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          toast.error('Session expired. Please log in again.');
          router.push('/login');
          return;
        }

        const result = await response.json();
        
        if (result.success) {
          toast.success('Profile updated successfully!');
          fetchProfile(); // Refresh the profile
        } else {
          setError(result.message || 'Failed to update profile');
        }
      }
    } catch (err) {
      console.error('Error saving profile:', err);
      setError('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-gray-900 mb-2 text-2xl font-bold">Complete Profile</h1>
        <p className="text-gray-600">Keep your professional information up to date</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Verification Status Banner */}
      {verificationStatus === 'verified' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-green-900 mb-1 font-semibold">Your profile is verified!</h4>
              <p className="text-sm text-green-800">
                You can now receive assignment requests from hospitals.
              </p>
            </div>
          </div>
        </div>
      )}

      {verificationStatus === 'pending' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-amber-900 mb-1 font-semibold">Your profile is under verification</h4>
              <p className="text-sm text-amber-800">
                This typically takes 24-48 hours. Admin is reviewing your medical license and credentials.
              </p>
            </div>
          </div>
        </div>
      )}

      {verificationStatus === 'rejected' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <X className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-red-900 mb-1 font-semibold">Your verification was rejected</h4>
              <p className="text-sm text-red-800">
                Reason: Medical license number could not be verified. Please update your documents and resubmit.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Profile Photo Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-gray-900 mb-6 font-semibold">Profile Photo</h3>
        <div className="flex items-center gap-6">
          <div className="relative">
            {profilePhotoUrl || selectedPhoto ? (
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-gray-200 bg-gray-100">
                <img
                  src={selectedPhoto ? URL.createObjectURL(selectedPhoto) : profilePhotoUrl || ''}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-32 h-32 rounded-full bg-gray-100 border-4 border-gray-200 flex items-center justify-center">
                <Camera className="w-12 h-12 text-gray-400" />
              </div>
            )}
            <label
              htmlFor="profile-photo-upload"
              className="absolute bottom-0 right-0 w-10 h-10 bg-teal-600 hover:bg-teal-700 rounded-full flex items-center justify-center cursor-pointer border-4 border-white shadow-lg transition-colors"
            >
              <Camera className="w-5 h-5 text-white" />
              <input
                type="file"
                id="profile-photo-upload"
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 5 * 1024 * 1024) {
                      toast.error('Image size must be less than 5MB');
                      return;
                    }
                    setSelectedPhoto(file);
                  }
                }}
              />
            </label>
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-600 mb-2">
              Upload a professional photo. This will be visible to hospitals when they view your profile.
            </p>
            {selectedPhoto && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePhotoUpload}
                  disabled={uploadingPhoto}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg flex items-center gap-2 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {uploadingPhoto ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload Photo
                    </>
                  )}
                </button>
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors font-medium text-sm"
                >
                  Cancel
                </button>
              </div>
            )}
            {!selectedPhoto && !profilePhotoUrl && (
              <p className="text-xs text-gray-500">Click the camera icon to upload a photo</p>
            )}
          </div>
        </div>
      </div>

      {/* Basic Information Form */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-gray-900 mb-6 font-semibold">Basic Information</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* First Name */}
          <div>
            <label className="block text-sm text-gray-700 mb-2 font-medium">
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              placeholder="Enter first name"
            />
          </div>

          {/* Last Name */}
          <div>
            <label className="block text-sm text-gray-700 mb-2 font-medium">
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              placeholder="Enter last name"
            />
          </div>

          {/* Medical License Number */}
          <div>
            <label className="block text-sm text-gray-700 mb-2 font-medium">
              Medical License Number <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={formData.licenseNumber}
                onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB] pr-10"
                placeholder="Enter license number"
              />
              {verificationStatus === 'verified' && (
                <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">This will be verified by admin</p>
          </div>

          {/* Years of Experience */}
          <div>
            <label className="block text-sm text-gray-700 mb-2 font-medium">
              Years of Experience <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              value={formData.yearsOfExperience}
              onChange={(e) => setFormData({ ...formData, yearsOfExperience: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              placeholder="Years of practice"
            />
          </div>

        </div>

        {/* Location Details Section */}
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">Location Details</h4>
          <p className="text-xs text-gray-500 mb-4">
            Provide detailed location information for better accuracy. More details = more accurate coordinates.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Full Address */}
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-700 mb-2 font-medium">
                Full Address
              </label>
              <input
                type="text"
                value={formData.fullAddress}
                onChange={(e) => setFormData({ ...formData, fullAddress: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                placeholder="e.g., 123 Main Street, Building Name, Area"
              />
              <p className="text-xs text-gray-500 mt-1">Street address with building/area name (for high accuracy)</p>
            </div>

            {/* City */}
            <div>
              <label className="block text-sm text-gray-700 mb-2 font-medium">
                City <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                placeholder="e.g., Mumbai"
              />
            </div>

            {/* State */}
            <div>
              <label className="block text-sm text-gray-700 mb-2 font-medium">
                State <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                placeholder="e.g., Maharashtra"
              />
            </div>

            {/* Pincode */}
            <div>
              <label className="block text-sm text-gray-700 mb-2 font-medium">
                Pincode / Postal Code
              </label>
              <input
                type="text"
                value={formData.pincode}
                onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                placeholder="e.g., 400001"
                maxLength={10}
              />
              <p className="text-xs text-gray-500 mt-1">Postal/ZIP code (for medium accuracy)</p>
            </div>
          </div>
        </div>

        {/* Bio */}
        <div className="mt-6">
          <label className="block text-sm text-gray-700 mb-2 font-medium">
            Professional Bio
          </label>
          <textarea
            value={formData.bio}
            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
            rows={4}
            maxLength={500}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB] resize-none"
            placeholder="Tell hospitals about your experience and specialization..."
          />
          <div className="flex justify-between mt-1">
            <p className="text-xs text-gray-500">Maximum 500 characters</p>
            <p className="text-xs text-gray-500">{formData.bio.length}/500</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6">
          <button 
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-lg flex items-center gap-2 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
          <button 
            onClick={fetchProfile}
            disabled={saving}
            className="px-6 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors font-medium disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
