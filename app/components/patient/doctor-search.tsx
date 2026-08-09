'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ChevronLeft, ChevronRight, MapPin, Search, SearchX } from 'lucide-react';
import apiClient from '@/lib/api/httpClient';
import { DoctorCard } from '@/app/components/patient/doctor-card';
import {
  DoctorSearchForm,
  SearchAddressOption,
} from '@/app/components/patient/doctor-search-form';
import {
  PATIENT_SEARCH_DEFAULT_LIMIT,
  PATIENT_SEARCH_DEFAULT_RADIUS,
  PATIENT_SEARCH_LOCATION_DEFAULT,
  PATIENT_SEARCH_LOCATION_GPS,
} from '@/lib/utils/constants';

interface DoctorSpecialty {
  id: string;
  name: string;
}

interface DoctorResult {
  id: string;
  name: string;
  primarySpecialty: string;
  specialties: DoctorSpecialty[];
  experienceYears: number;
  rating: number;
  totalReviews: number;
  distanceKm: number;
  city: string | null;
  state: string | null;
  photoUrl: string | null;
}

interface SearchPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface SearchResponseData {
  doctors: DoctorResult[];
  searchCenter: { lat: number; lon: number; radiusKm: number; fromAddress: boolean };
  pagination: SearchPagination;
}

const LOCATION_UNAVAILABLE_MARKER = 'No location available';

export function DoctorSearch() {
  const router = useRouter();

  const [addresses, setAddresses] = useState<SearchAddressOption[]>([]);
  const [specialtyOptions, setSpecialtyOptions] = useState<Array<{ id: string; name: string }>>([]);

  const [locationChoice, setLocationChoice] = useState<string>(PATIENT_SEARCH_LOCATION_DEFAULT);
  const [gpsState, setGpsState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lon: number } | null>(null);

  const [search, setSearch] = useState('');
  const [specialtyId, setSpecialtyId] = useState('');
  const [radius, setRadius] = useState<number>(PATIENT_SEARCH_DEFAULT_RADIUS);
  const [sortBy, setSortBy] = useState<string>('distance');

  const [doctors, setDoctors] = useState<DoctorResult[]>([]);
  const [pagination, setPagination] = useState<SearchPagination | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAddresses = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/patients/addresses');
      const data = res.data;
      if (data.success && data.data) {
        setAddresses(data.data);
      }
    } catch {
      setAddresses([]);
    }
  }, []);

  const loadSpecialties = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/specialties/active');
      const data = res.data;
      if (data.success && data.data) {
        setSpecialtyOptions(data.data);
      }
    } catch {
      setSpecialtyOptions([]);
    }
  }, []);

  useEffect(() => {
    loadAddresses();
    loadSpecialties();
  }, [loadAddresses, loadSpecialties]);

  const handleUseMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setGpsState('error');
      setLocationChoice(PATIENT_SEARCH_LOCATION_GPS);
      return;
    }
    setGpsState('loading');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsCoords({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
        setGpsState('success');
        setLocationChoice(PATIENT_SEARCH_LOCATION_GPS);
      },
      () => {
        setGpsState('error');
        setLocationChoice(PATIENT_SEARCH_LOCATION_GPS);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const runSearch = useCallback(
    async (targetPage: number) => {
      setSubmitting(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (search.trim()) {
          params.set('search', search.trim());
        }
        if (specialtyId) {
          params.set('specialtyId', specialtyId);
        }
        params.set('radius', String(radius));
        params.set('sortBy', sortBy);
        params.set('page', String(targetPage));
        params.set('limit', String(PATIENT_SEARCH_DEFAULT_LIMIT));

        if (locationChoice === PATIENT_SEARCH_LOCATION_GPS && gpsCoords) {
          params.set('lat', gpsCoords.lat.toString());
          params.set('lon', gpsCoords.lon.toString());
        } else if (locationChoice !== PATIENT_SEARCH_LOCATION_DEFAULT) {
          const address = addresses.find((a) => a.id === locationChoice);
          if (address && address.latitude != null && address.longitude != null) {
            params.set('lat', String(address.latitude));
            params.set('lon', String(address.longitude));
          }
        }

        const res = await apiClient.get(`/api/patients/doctors/search?${params.toString()}`);
        const data = res.data as { success: boolean; data: SearchResponseData };
        setDoctors(data.data.doctors);
        setPagination(data.data.pagination);
        setPage(targetPage);
      } catch (err) {
        setDoctors([]);
        setPagination(null);
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Failed to search doctors. Please try again.';
        setError(message);
      } finally {
        setSubmitting(false);
        setLoading(false);
      }
    },
    [search, specialtyId, radius, sortBy, locationChoice, gpsCoords, addresses]
  );

  useEffect(() => {
    runSearch(1);
  }, [runSearch]);

  const isLocationError = error?.includes(LOCATION_UNAVAILABLE_MARKER);

  return (
    <div className="min-h-screen bg-slate-50/50">
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/patient/dashboard')}
              aria-label="Back to dashboard"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Search className="w-5 h-5 text-blue-600" />
                Find a Doctor
              </h1>
              <p className="text-xs text-slate-500">
                Verified doctors for home visits near you
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-1">
            <DoctorSearchForm
              addresses={addresses}
              locationChoice={locationChoice}
              onLocationChange={setLocationChoice}
              onUseMyLocation={handleUseMyLocation}
              gpsState={gpsState}
              gpsCoords={gpsCoords}
              search={search}
              onSearchChange={setSearch}
              specialtyOptions={specialtyOptions}
              specialtyId={specialtyId}
              onSpecialtyChange={setSpecialtyId}
              radius={radius}
              onRadiusChange={setRadius}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              onSearchSubmit={() => runSearch(1)}
              submitting={submitting}
            />
          </div>

          <div className="lg:col-span-2">
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-white border border-slate-100 rounded-2xl p-5 animate-pulse"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 rounded-xl bg-slate-100" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-1/3 bg-slate-100 rounded" />
                        <div className="h-3 w-1/2 bg-slate-100 rounded" />
                        <div className="h-3 w-2/3 bg-slate-100 rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : isLocationError ? (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
                <MapPin className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                <h2 className="font-bold text-slate-900 mb-1">No location available</h2>
                <p className="text-sm text-slate-600 mb-4">
                  Share your location, or save a default address with coordinates to find doctors near you.
                </p>
                <button
                  type="button"
                  onClick={() => router.push('/patient/dashboard')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm transition-colors"
                >
                  Manage addresses
                </button>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <h2 className="font-bold text-slate-900 mb-1">Something went wrong</h2>
                  <p className="text-sm text-slate-600">{error}</p>
                </div>
              </div>
            ) : doctors.length === 0 ? (
              <div className="bg-white border border-slate-100 rounded-2xl p-10 text-center">
                <SearchX className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h2 className="font-bold text-slate-900 mb-1">No doctors found</h2>
                <p className="text-sm text-slate-500">
                  Try widening your search radius, clearing filters, or using a different location.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-slate-500">
                    <span className="font-bold text-slate-900">{pagination?.total ?? 0}</span> doctors
                    found within {radius} km
                  </p>
                  {pagination && pagination.totalPages > 1 && (
                    <p className="text-xs text-slate-400 font-semibold">
                      Page {pagination.page} of {pagination.totalPages}
                    </p>
                  )}
                </div>

                <div className="space-y-4">
                  {doctors.map((doctor) => (
                    <DoctorCard key={doctor.id} {...doctor} />
                  ))}
                </div>

                {pagination && pagination.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-4 mt-6">
                    <button
                      type="button"
                      disabled={!pagination.hasPrevPage}
                      onClick={() => runSearch(page - 1)}
                      className="flex items-center gap-1 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={!pagination.hasNextPage}
                      onClick={() => runSearch(page + 1)}
                      className="flex items-center gap-1 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
