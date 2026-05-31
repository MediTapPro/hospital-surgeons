'use client';

import { useState, useEffect } from 'react';
import { Search, Calendar, Star, Award, Clock, Loader2, X, MapPin, Heart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { useRouter } from 'next/navigation';
import { PageHeader } from '../../hospital/_components/PageHeader';
import apiClient from '@/lib/api/httpClient';
import { PatientSelectionModal } from './PatientSelectionModal';
import { Switch } from '../../components/ui/switch';

export function FindDoctors() {
  const router = useRouter();
  const [searchParams, setSearchParams] = useState({
    searchText: '',
    specialty: '',
    selectedSpecialties: [] as string[],
    date: '',
  });
  const [showResults, setShowResults] = useState(false);
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ 
    parentSlot?: { id: string; start: string; end: string; slotDate?: string };
    bookedSubslots?: Array<{ id: string; start: string; end: string }>;
    slotDate?: string;
    // Legacy format support
    id?: string; 
    time?: string; 
    startTime?: string; 
    endTime?: string;
  } | null>(null);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [specialties, setSpecialties] = useState([
    'Cardiology',
    'Orthopedics',
    'Neurology',
    'General Medicine',
    'Pediatrics',
    'Dermatology',
    'Endocrinology',
    'Gastroenterology',
  ]);
  const [hospitalSubscription, setHospitalSubscription] = useState<'free' | 'basic' | 'premium' | 'enterprise'>('free');
  const [loading, setLoading] = useState(false);
  const [hospitalId, setHospitalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });

  useEffect(() => {
    fetchHospitalProfile();
    fetchSpecialties();
  }, []);


  const fetchHospitalProfile = async () => {
    try {
      const response = await apiClient.get('/api/hospitals/profile');
      const data = response.data;
      
      if (data.success && data.data) {
        setHospitalId(data.data.id);
      } else {
        setError(data.message || 'Failed to load hospital profile');
      }
    } catch (err: any) {
      console.error('Error fetching hospital profile:', err);
      if (err.response?.status === 401) {
        router.push('/login');
        return;
      }
      setError('Failed to load hospital profile. Please try refreshing the page.');
    }
  };


  const fetchSpecialties = async () => {
    try {
      const response = await apiClient.get('/api/specialties/active');
      const result = response.data;
      if (result.success && result.data) {
        setSpecialties(result.data.map((s: any) => s.name));
      }
    } catch (error) {
      console.error('Error fetching specialties:', error);
    }
  };

  const handleToggleFavorite = async (doctorId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    if (!hospitalId) return;

    // Find the doctor in the current list
    const doctor = doctors.find(d => d.id === doctorId);
    const isFavorite = doctor?.isFavorite || false;

    try {
      if (isFavorite) {
        // Remove from favorites
        await apiClient.delete(`/api/hospitals/${hospitalId}/favorite-doctors/${doctorId}`);
        // Update local state
        setDoctors(prev => prev.map(d => d.id === doctorId ? { ...d, isFavorite: false } : d));
      } else {
        // Add to favorites
        await apiClient.post(`/api/hospitals/${hospitalId}/favorite-doctors`, {
          doctorId,
        });
        // Update local state
        setDoctors(prev => prev.map(d => d.id === doctorId ? { ...d, isFavorite: true } : d));
      }
    } catch (error: any) {
      console.error('Error toggling favorite:', error);
      alert(error.response?.data?.message || 'Failed to update favorite doctor');
    }
  };

  // Filter doctors based on specialty
  const getFilteredDoctors = () => {
    return doctors.filter(d => !searchParams.specialty || d.specialty === searchParams.specialty);
  };

  // Show loading or empty state
  if ((loading && !showResults) || !hospitalId) {
    return (
      <div className="min-h-screen bg-slate-50">
        <PageHeader 
          title="Find Doctors" 
          description="Search for available doctors and create assignments"
        />
        <div className="p-8">
          <div className="text-center py-12 text-gray-500">
            {!hospitalId ? 'Loading hospital profile...' : 'Loading...'}
          </div>
        </div>
      </div>
    );
  }

  const getTierBadge = (tier: string | undefined | null) => {
    if (!tier) return null;
    
    // Just show whatever backend sends, capitalize first letter
    const displayName = tier.charAt(0).toUpperCase() + tier.slice(1);
    
    // Use different colors based on tier
    const getBadgeColor = (t: string) => {
      const lower = t.toLowerCase();
      if (lower === 'enterprise') return 'bg-purple-100 text-purple-800 hover:bg-purple-100';
      if (lower === 'premium') return 'bg-blue-100 text-blue-800 hover:bg-blue-100';
      if (lower === 'basic') return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100';
      if (lower === 'free') return 'bg-slate-100 text-slate-800 hover:bg-slate-100';
      return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
    };
    
    return (
      <Badge className={`${getBadgeColor(tier)} gap-1`}>
        <Award className="w-3 h-3" />
        {displayName}
      </Badge>
    );
  };

  const getPriorityTimeout = (priority: string) => {
    switch (priority) {
      case 'routine':
        return '24 hours';
      case 'urgent':
        return '6 hours';
      case 'emergency':
        return '1 hour';
      default:
        return '';
    }
  };

  const handleSearch = async (page: number = 1) => {
    // All fields are optional - allow search with any combination or none (shows all doctors)
    // No validation needed - user can search with any criteria they want

    try {
      setLoading(true);
      
      const params: any = {
        page,
        limit: pagination.limit,
      };
      
      // Add text search if provided
      if (searchParams.searchText) {
        params.search = searchParams.searchText;
      }
      
      // Add multiple specialty IDs
      if (searchParams.selectedSpecialties.length > 0) {
        const specialtiesResponse = await apiClient.get('/api/specialties/active');
        const specialtiesResult = specialtiesResponse.data;
        const specialtyIds = specialtiesResult.data
          ?.filter((s: any) => searchParams.selectedSpecialties.includes(s.name))
          .map((s: any) => s.id) || [];
        
        // Add all specialty IDs as array
        specialtyIds.forEach((id: string) => {
          if (!params.specialtyId) {
            params.specialtyId = [];
          }
          if (Array.isArray(params.specialtyId)) {
            params.specialtyId.push(id);
          }
        });
      } else if (searchParams.specialty) {
        // Fallback to dropdown selection
        const specialtiesResponse = await apiClient.get('/api/specialties/active');
        const specialtiesResult = specialtiesResponse.data;
        const specialty = specialtiesResult.data?.find((s: any) => s.name === searchParams.specialty);
        
        if (specialty) {
          params.specialtyId = [specialty.id];
        }
      }
      
      // Add date if provided
      if (searchParams.date) {
        params.date = searchParams.date;
      }

      // Add onlyFavorites flag if toggled
      if (onlyFavorites) {
        params.onlyFavorites = 'true';
      }

      // Build query string with multiple specialtyId params
      const queryParams = new URLSearchParams();
      Object.keys(params).forEach(key => {
        if (key === 'specialtyId' && Array.isArray(params[key])) {
          params[key].forEach((id: string) => {
            queryParams.append('specialtyId', id);
          });
        } else if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
          queryParams.append(key, params[key].toString());
        }
      });

      const response = await apiClient.get(`/api/hospitals/${hospitalId}/find-doctors?${queryParams.toString()}`);
      const result = response.data;

      if (result.success && result.data) {
        setDoctors(result.data.doctors || []);
        setHospitalSubscription(result.data.hospitalSubscription || 'free');
        
        // Update pagination state
        if (result.data.pagination) {
          setPagination(result.data.pagination);
        }
        
        setShowResults(true);
      } else {
        alert(result.message || 'Failed to find doctors');
      }
    } catch (error) {
      console.error('Error searching doctors:', error);
      alert('An error occurred while searching for doctors');
    } finally {
      setLoading(false);
    }
  };

  const handleSlotSelect = async (doctor: any, parentSlot: any) => {
    // Fetch full availability details including booked sub-slots
    try {
      const date = parentSlot.slotDate || searchParams.date || new Date().toISOString().split('T')[0];
      const availabilityResponse = await apiClient.get(`/api/doctors/${doctor.id}/availability?date=${date}`);
      
      if (availabilityResponse.data.success && availabilityResponse.data.data) {
        const availability = availabilityResponse.data.data;
        // Find the matching parent slot
        const matchedParent = availability.find((item: any) => item.parentSlot.id === parentSlot.id);
        
        if (matchedParent) {
          setSelectedDoctor(doctor);
          setSelectedSlot({
            parentSlot: matchedParent.parentSlot,
            bookedSubslots: matchedParent.bookedSubslots || [],
            slotDate: date,
          });
          setShowPatientModal(true);
        } else {
          alert('Slot not found. Please try again.');
        }
      } else {
        alert('Failed to fetch slot details. Please try again.');
      }
    } catch (error: any) {
      console.error('Error fetching slot details:', error);
      alert('Failed to fetch slot details. Please try again.');
    }
  };

  const handleAssignmentSuccess = () => {
    // Refresh doctor list or show success message
    if (searchParams.date) {
      handleSearch(1); // Refresh search results
    }
  };

  return (
    <div className="min-h-screen bg-slate-50" style={{ overflow: 'visible' }}>
      <PageHeader 
        title="Find Doctors" 
        description="Search for available doctors and create assignments"
      />
      <div className="p-8" style={{ overflow: 'visible' }}>
        <div className="mb-8">
          {/* Search and Filters Card */}
          <div>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 mb-6">
              {/* Quick Search Section */}
              <div className="p-6 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Search Doctors</h3>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    id="searchText"
                    type="text"
                    placeholder="Search by doctor name or specialty..."
                    value={searchParams.searchText}
                    onChange={(e) => setSearchParams({ ...searchParams, searchText: e.target.value })}
                    className="pl-12 h-12 text-base"
                  />
                </div>
              </div>

              {/* Specialty Filters */}
              <div className="p-6 border-b border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base font-medium text-slate-900">Filter by Specialties</Label>
                  {searchParams.selectedSpecialties.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSearchParams({ ...searchParams, selectedSpecialties: [] })}
                      className="text-xs text-slate-500 hover:text-slate-700 h-6"
                    >
                      Clear all
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {specialties.map((specialty) => {
                    const isSelected = searchParams.selectedSpecialties.includes(specialty);
                    return (
                      <Badge
                        key={specialty}
                        variant={isSelected ? "default" : "outline"}
                        className={`cursor-pointer px-4 py-1.5 text-sm transition-colors ${
                          isSelected 
                            ? "bg-teal-600 text-white hover:bg-teal-700 border-teal-600" 
                            : "hover:bg-slate-50 hover:border-slate-300"
                        }`}
                        onClick={() => {
                          const newSelected = isSelected
                            ? searchParams.selectedSpecialties.filter(s => s !== specialty)
                            : [...searchParams.selectedSpecialties, specialty];
                          setSearchParams({ ...searchParams, selectedSpecialties: newSelected });
                        }}
                      >
                        {specialty}
                        {isSelected && <X className="w-3 h-3 ml-1.5" />}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              {/* Date Selection Section */}
              <div className="p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Search Filters</h3>
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="date" className="text-slate-700">
                      Appointment Date
                    </Label>
                    <Input
                      id="date"
                      type="date"
                      value={searchParams.date}
                      onChange={(e) => setSearchParams({ ...searchParams, date: e.target.value })}
                      className="h-11"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Switch
                        id="onlyFavorites"
                        checked={onlyFavorites}
                        onCheckedChange={(val: any) => setOnlyFavorites(!!val)}
                      />
                      <Label htmlFor="onlyFavorites" className="text-sm text-slate-700">Only favorite doctors</Label>
                    </div>
                    <div className="text-sm text-slate-500">Toggle to show only doctors you've favorited</div>
                  </div>
                  
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      handleSearch(1);
                    }}
                    disabled={loading}
                    className="w-full h-12 text-base font-medium bg-teal-600 hover:bg-teal-700"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Search className="w-5 h-5 mr-2" />
                        Search Doctors
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* Search Results */}
      {showResults && (
        <div>
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold text-slate-900">Available Doctors</h2>
              <Badge variant="secondary" className="text-slate-600">
                {getFilteredDoctors().length} {getFilteredDoctors().length === 1 ? 'doctor' : 'doctors'} found
              </Badge>
            </div>
            {(searchParams.searchText || searchParams.selectedSpecialties.length > 0) && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-slate-600">Filters:</span>
                {searchParams.searchText && (
                  <Badge variant="outline" className="text-slate-700">
                    Search: "{searchParams.searchText}"
                  </Badge>
                )}
                {searchParams.selectedSpecialties.map((spec) => (
                  <Badge key={spec} className="bg-teal-100 text-teal-800 border-teal-200">
                    {spec}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="mb-6">
            <div className="text-sm text-slate-600 mb-4">
              Showing {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} doctors
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {getFilteredDoctors().map((doctor) => {
              return (
              <div key={doctor.id} className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
                <div className="p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <Avatar className="w-16 h-16">
                      <AvatarImage src={doctor.photo || undefined} />
                      <AvatarFallback className="bg-blue-100 text-blue-600">
                        {doctor.name.split(' ')[1][0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="text-gray-900">{doctor.name}</h3>
                          <p className="text-gray-500">{doctor.specialty}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getTierBadge(doctor.tier)}
                          <button
                            onClick={(e) => handleToggleFavorite(doctor.id, e)}
                            className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                            title={doctor.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            <Heart
                              className={`w-5 h-5 transition-colors ${
                                doctor.isFavorite
                                  ? 'fill-red-500 text-red-500'
                                  : 'text-gray-400 hover:text-red-500'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>{doctor.experience} years exp</span>
                        <span className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          {doctor.rating} ({doctor.reviews})
                        </span>
                        {doctor.distance !== null && doctor.distance !== undefined && (
                          <span className="flex items-center gap-1 text-blue-600">
                            <MapPin className="w-4 h-4" />
                            {typeof doctor.distance === 'number' 
                              ? doctor.distance < 1 
                                ? `${Math.round(doctor.distance * 1000)}m`
                                : `${doctor.distance.toFixed(1)} km`
                              : doctor.distance}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-4 pb-4 border-b">
                    <div>
                      <p className="text-sm text-gray-500">Completed Assignments</p>
                      <p className="text-gray-900">{doctor.completedAssignments}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Consultation Fee</p>
                      <p className="text-gray-900">₹{doctor.fee}</p>
                    </div>
                    {doctor.distance !== null && doctor.distance !== undefined && (
                      <div>
                        <p className="text-sm text-gray-500">Distance</p>
                        <p className="text-gray-900 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-blue-600" />
                          {typeof doctor.distance === 'number' 
                            ? doctor.distance < 1 
                              ? `${Math.round(doctor.distance * 1000)}m`
                              : `${doctor.distance.toFixed(1)} km`
                            : doctor.distance}
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <Label className="mb-2 block">Available Time Slots</Label>
                    {doctor.availableSlots && doctor.availableSlots.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2">
                        {doctor.availableSlots.map((slot: any) => (
                          <Button
                            key={slot.id || slot.time}
                            variant="outline"
                            size="sm"
                            onClick={() => handleSlotSelect(doctor, slot)}
                            className="gap-1"
                          >
                            <Clock className="w-3 h-3" />
                            {slot.time || slot}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No available slots for this date</p>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-200">
              <div className="text-sm text-slate-600">
                Page {pagination.page} of {pagination.totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    handleSearch(pagination.page - 1);
                  }}
                  disabled={!pagination.hasPrevPage || loading}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.page >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={pagination.page === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          handleSearch(pageNum);
                        }}
                        disabled={loading}
                        className={pagination.page === pageNum ? "bg-teal-600 hover:bg-teal-700" : ""}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    handleSearch(pagination.page + 1);
                  }}
                  disabled={!pagination.hasNextPage || loading}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Patient Selection Modal */}
      <PatientSelectionModal
        open={showPatientModal}
        onClose={() => {
          setShowPatientModal(false);
          setSelectedDoctor(null);
          setSelectedSlot(null);
        }}
        selectedDoctor={selectedDoctor}
        selectedSlot={selectedSlot}
        hospitalId={hospitalId}
        onSuccess={handleAssignmentSuccess}
      />
      </div>
    </div>
  );
}