'use client';

import {
  Upload,
  Camera,
  Star,
  Trash2,
  Loader2,
  AlertCircle,
  Image as ImageIcon,
  X,
  Plus,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { toast } from 'sonner';

interface ProfilePhoto {
  id: string;
  doctorId: string;
  fileId: string;
  isPrimary: boolean;
  uploadedAt: string;
  file: {
    id: string;
    filename: string;
    url: string;
    mimetype: string;
    size: number;
  };
}

export default function ProfilePhotosPage() {
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<ProfilePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingPrimaryId, setSettingPrimaryId] = useState<string | null>(null);

  useEffect(() => {
    fetchDoctorProfile();
  }, []);

  useEffect(() => {
    if (doctorId) {
      fetchPhotos();
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
        setError('Please complete your doctor profile first.');
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

  const fetchPhotos = async () => {
    if (!doctorId) return;
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/doctors/${doctorId}/photos`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (data.success && Array.isArray(data.data)) {
        setPhotos(data.data);
      } else {
        setError(data.message || 'Failed to load photos');
      }
    } catch (err) {
      console.error('Error fetching photos:', err);
      setError('Failed to load photos. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadPhoto = async () => {
    if (!doctorId) {
      toast.error('Doctor profile not found.');
      return;
    }
    if (!selectedFile) {
      toast.error('Please select a photo to upload.');
      return;
    }

    try {
      setUploading(true);
      const token = localStorage.getItem('accessToken');
      if (!token) {
        toast.error('Session expired. Please log in again.');
        return;
      }

      // Upload file
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('folder', `doctor-profiles/${doctorId}`);
      formData.append('bucket', 'images');

      const uploadResponse = await fetch('/api/files/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const uploadData = await uploadResponse.json();

      if (!uploadData.success) {
        throw new Error(uploadData.message || 'Failed to upload file');
      }

      // Add photo to profile photos
      const photoResponse = await fetch(`/api/doctors/${doctorId}/photos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileId: uploadData.data.fileId,
          isPrimary: photos.length === 0, // Set as primary if it's the first photo
        }),
      });
      const photoData = await photoResponse.json();

      if (!photoData.success) {
        throw new Error(photoData.message || 'Failed to save photo');
      }

      toast.success('Photo uploaded successfully');
      setShowUploadModal(false);
      setSelectedFile(null);
      fetchPhotos();
    } catch (err) {
      console.error('Photo upload error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handleSetPrimary = async (photoId: string) => {
    if (!doctorId) return;

    try {
      setSettingPrimaryId(photoId);
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/doctors/${doctorId}/photos/${photoId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isPrimary: true }),
      });
      const data = await response.json();

      if (data.success) {
        toast.success('Primary photo updated');
        fetchPhotos();
      } else {
        toast.error(data.message || 'Failed to set primary photo');
      }
    } catch (err) {
      console.error('Error setting primary photo:', err);
      toast.error('Failed to set primary photo');
    } finally {
      setSettingPrimaryId(null);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!doctorId) return;
    if (!window.confirm('Are you sure you want to delete this photo?')) {
      return;
    }

    try {
      setDeletingId(photoId);
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/doctors/${doctorId}/photos/${photoId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (data.success) {
        toast.success('Photo deleted successfully');
        fetchPhotos();
      } else {
        toast.error(data.message || 'Failed to delete photo');
      }
    } catch (err) {
      console.error('Error deleting photo:', err);
      toast.error('Failed to delete photo');
    } finally {
      setDeletingId(null);
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
          <h1 className="text-gray-900 mb-2 text-2xl font-bold">Profile Photos</h1>
          <p className="text-gray-600">Manage your profile photos. Set one as primary to display on your profile.</p>
        </div>
        <Button onClick={() => setShowUploadModal(true)} className="bg-teal-600 hover:bg-teal-700">
          <Plus className="w-4 h-4 mr-2" />
          Upload Photo
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

      {photos.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-lg p-12 text-center">
          <div className="w-16 h-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <ImageIcon className="w-8 h-8 text-slate-500" />
          </div>
          <p className="text-slate-900 font-semibold mb-2">No photos uploaded yet</p>
          <p className="text-slate-500 text-sm mb-4">
            Upload photos to showcase your professional profile to hospitals.
          </p>
          <Button onClick={() => setShowUploadModal(true)} className="bg-teal-600 hover:bg-teal-700">
            <Upload className="w-4 h-4 mr-2" />
            Upload Your First Photo
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow relative"
            >
              {photo.isPrimary && (
                <div className="absolute top-2 right-2 z-10 bg-teal-600 text-white px-2 py-1 rounded text-xs font-semibold flex items-center gap-1">
                  <Star className="w-3 h-3 fill-current" />
                  Primary
                </div>
              )}
              <div className="aspect-square bg-gray-100 relative">
                <img
                  src={photo.file.url}
                  alt={photo.file.filename}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-40 transition-all flex items-center justify-center gap-2 opacity-0 hover:opacity-100">
                  {!photo.isPrimary && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleSetPrimary(photo.id)}
                      disabled={settingPrimaryId === photo.id}
                      className="bg-white hover:bg-gray-100"
                    >
                      {settingPrimaryId === photo.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Star className="w-4 h-4" />
                      )}
                      Set Primary
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeletePhoto(photo.id)}
                    disabled={deletingId === photo.id}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {deletingId === photo.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-600 mb-1">{photo.file.filename}</p>
                <p className="text-xs text-gray-500">Uploaded {formatDate(photo.uploadedAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>Upload Profile Photo</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="border border-dashed border-slate-300 rounded-lg p-6 text-center">
              <input
                type="file"
                id="photo-file"
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 5 * 1024 * 1024) {
                      toast.error('Image size must be less than 5MB');
                      return;
                    }
                    setSelectedFile(file);
                  }
                }}
              />
              <label htmlFor="photo-file" className="cursor-pointer flex flex-col items-center gap-2">
                {selectedFile ? (
                  <div className="w-32 h-32 mx-auto rounded-lg overflow-hidden border-2 border-slate-300">
                    <img
                      src={URL.createObjectURL(selectedFile)}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <>
                    <div className="w-16 h-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center">
                      <Upload className="w-8 h-8 text-slate-500" />
                    </div>
                    <p className="text-slate-900 font-medium text-sm">Click to upload or drag and drop</p>
                    <p className="text-slate-500 text-xs">PNG, JPG up to 5MB</p>
                  </>
                )}
              </label>
            </div>
            {selectedFile && (
              <div className="text-sm text-gray-600">
                <p>Selected: {selectedFile.name}</p>
                <p className="text-xs text-gray-500">
                  Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowUploadModal(false);
              setSelectedFile(null);
            }}>
              Cancel
            </Button>
            <Button onClick={handleUploadPhoto} disabled={uploading || !selectedFile}>
              {uploading ? (
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

