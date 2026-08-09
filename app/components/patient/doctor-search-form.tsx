'use client';

import { Loader2, LocateFixed, MapPin, Search, SlidersHorizontal } from 'lucide-react';
import {
  PATIENT_SEARCH_LOCATION_DEFAULT,
  PATIENT_SEARCH_LOCATION_GPS,
  PATIENT_SEARCH_RADIUS_OPTIONS,
  PATIENT_SEARCH_SORT_OPTIONS,
} from '@/lib/utils/constants';

export interface SearchAddressOption {
  id: string;
  label: string;
  latitude: number | string | null;
  longitude: number | string | null;
}

interface DoctorSearchFormProps {
  addresses: SearchAddressOption[];
  locationChoice: string;
  onLocationChange: (choice: string) => void;
  onUseMyLocation: () => void;
  gpsState: 'idle' | 'loading' | 'success' | 'error';
  gpsCoords: { lat: number; lon: number } | null;
  search: string;
  onSearchChange: (value: string) => void;
  specialtyOptions: Array<{ id: string; name: string }>;
  specialtyId: string;
  onSpecialtyChange: (value: string) => void;
  radius: number;
  onRadiusChange: (value: number) => void;
  sortBy: string;
  onSortByChange: (value: string) => void;
  onSearchSubmit: () => void;
  submitting: boolean;
}

const selectClass =
  'w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white';

export function DoctorSearchForm({
  addresses,
  locationChoice,
  onLocationChange,
  onUseMyLocation,
  gpsState,
  gpsCoords,
  search,
  onSearchChange,
  specialtyOptions,
  specialtyId,
  onSpecialtyChange,
  radius,
  onRadiusChange,
  sortBy,
  onSortByChange,
  onSearchSubmit,
  submitting,
}: DoctorSearchFormProps) {
  const selectedAddress = addresses.find((a) => a.id === locationChoice);
  const hasSelectedAddressCoords =
    selectedAddress?.latitude != null && selectedAddress?.longitude != null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSearchSubmit();
      }}
      className="bg-white/85 backdrop-blur-sm border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4"
    >
      <div className="flex items-center gap-2 mb-1">
        <SlidersHorizontal className="w-4 h-4 text-blue-600" />
        <h2 className="font-bold text-slate-900 text-sm">Search filters</h2>
      </div>

      <div>
        <label htmlFor="doctor-search" className="block text-xs font-semibold text-slate-600 mb-1.5">
          Doctor or specialty
        </label>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="doctor-search"
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by doctor name or specialty"
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor="search-specialty" className="block text-xs font-semibold text-slate-600 mb-1.5">
            Specialty
          </label>
          <select
            id="search-specialty"
            value={specialtyId}
            onChange={(e) => onSpecialtyChange(e.target.value)}
            className={selectClass}
          >
            <option value="">All specialties</option>
            {specialtyOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="search-radius" className="block text-xs font-semibold text-slate-600 mb-1.5">
            Search radius
          </label>
          <select
            id="search-radius"
            value={radius}
            onChange={(e) => onRadiusChange(Number(e.target.value))}
            className={selectClass}
          >
            {PATIENT_SEARCH_RADIUS_OPTIONS.map((r) => (
              <option key={r} value={r}>
                Within {r} km
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="search-sort" className="block text-xs font-semibold text-slate-600 mb-1.5">
            Sort by
          </label>
          <select
            id="search-sort"
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value)}
            className={selectClass}
          >
            {PATIENT_SEARCH_SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <label htmlFor="search-near" className="text-xs font-semibold text-slate-600">
            Search near
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onUseMyLocation}
              disabled={gpsState === 'loading'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {gpsState === 'loading' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <LocateFixed className="w-3.5 h-3.5" />
              )}
              Use my location
            </button>
          </div>
        </div>

        <div className="mt-2 space-y-1.5">
          <select
            id="search-near"
            value={locationChoice}
            onChange={(e) => onLocationChange(e.target.value)}
            className={selectClass}
          >
            <option value={PATIENT_SEARCH_LOCATION_DEFAULT}>My default address</option>
            <option value={PATIENT_SEARCH_LOCATION_GPS}>
              My current location
            </option>
            {addresses.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
                {a.latitude == null || a.longitude == null ? ' (no coordinates)' : ''}
              </option>
            ))}
          </select>

          <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <MapPin className="w-3 h-3 text-slate-400" />
            {locationChoice === PATIENT_SEARCH_LOCATION_DEFAULT &&
              'Using your default saved address. Set a default address to search near it.'}
            {locationChoice === PATIENT_SEARCH_LOCATION_GPS &&
              (gpsCoords
                ? `Using your current location (${gpsCoords.lat.toFixed(4)}, ${gpsCoords.lon.toFixed(4)})`
                : gpsState === 'error'
                  ? 'Location unavailable. Grant permission or pick a saved address.'
                  : 'Fetching your location...')}
            {locationChoice !== PATIENT_SEARCH_LOCATION_DEFAULT &&
              locationChoice !== PATIENT_SEARCH_LOCATION_GPS &&
              (hasSelectedAddressCoords
                ? `Searching around your saved address.`
                : 'This address has no coordinates saved, falling back to your default address.')}
          </p>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01]"
      >
        {submitting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Search className="w-4 h-4" />
        )}
        Search doctors
      </button>
    </form>
  );
}
