import { DoctorsRepository, PatientDoctorSearchRow } from '@/lib/repositories/doctors.repository';
import { PatientProfilesRepository } from '@/lib/repositories/patient-profiles.repository';
import { getDb } from '@/lib/db';

export interface PatientDoctorSearchQuery {
  search?: string;
  specialtyId?: string;
  lat?: number;
  lon?: number;
  radius?: number;
  minRating?: number;
  sortBy?: 'distance' | 'rating' | 'experience';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export class LocationRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LocationRequiredError';
  }
}

export class PatientDoctorSearchService {
  private doctorsRepository: DoctorsRepository;
  private patientProfilesRepository: PatientProfilesRepository;

  constructor(doctorsRepository?: DoctorsRepository, patientProfilesRepository?: PatientProfilesRepository) {
    this.doctorsRepository = doctorsRepository ?? new DoctorsRepository(getDb());
    this.patientProfilesRepository = patientProfilesRepository ?? new PatientProfilesRepository(getDb());
  }

  /**
   * Resolve the search center. Explicit lat/lon from the query wins;
   * otherwise fall back to the requesting patient's default saved address.
   * Throws when no coordinates are available.
   */
  private async resolveSearchCenter(userId: string, query: PatientDoctorSearchQuery) {
    const explicitLat = query.lat;
    const explicitLon = query.lon;

    if (explicitLat != null && explicitLon != null) {
      return { lat: explicitLat, lon: explicitLon, fromAddress: false };
    }

    const profile = await this.patientProfilesRepository.findProfileByUserId(userId);
    if (!profile) {
      throw new LocationRequiredError('Patient profile not found. Create a profile and save an address with coordinates.');
    }

    const defaultAddress = await this.patientProfilesRepository.getDefaultAddress(profile.id);
    const addressLat = defaultAddress?.latitude != null ? Number(defaultAddress.latitude) : null;
    const addressLon = defaultAddress?.longitude != null ? Number(defaultAddress.longitude) : null;

    if (addressLat == null || addressLon == null) {
      throw new LocationRequiredError('No location available. Share your location or save an address with coordinates.');
    }

    return { lat: addressLat, lon: addressLon, fromAddress: true };
  }

  async search(userId: string, query: PatientDoctorSearchQuery) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const radiusKm = query.radius || 50;
    const sortBy = query.sortBy || 'distance';

    // Sensible default directions: nearest first by distance,
    // best first when ranking by rating or experience.
    const sortOrder = query.sortOrder ?? (sortBy === 'distance' ? 'asc' : 'desc');

    const { lat, lon, fromAddress } = await this.resolveSearchCenter(userId, query);

    const rows = await this.doctorsRepository.searchDoctorsForPatients({
      lat,
      lon,
      radiusKm,
      search: query.search,
      specialtyId: query.specialtyId,
      minRating: query.minRating,
      sortBy,
      sortOrder,
      page,
      limit,
    });

    const doctors = rows.map((row) => this.toDoctorDto(row));
    const total = rows.length ? Number(rows[0].total) || 0 : 0;
    const totalPages = Math.ceil(total / limit);

    return {
      doctors,
      searchCenter: {
        lat,
        lon,
        radiusKm,
        fromAddress,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  private toDoctorDto(row: PatientDoctorSearchRow) {
    const specialties: Array<{ id: string; name: string }> = Array.isArray(row.specialties)
      ? row.specialties
      : [];

    return {
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      name: `Dr. ${row.firstName} ${row.lastName}`,
      primarySpecialty: specialties[0]?.name || 'General Medicine',
      specialties,
      experienceYears: Number(row.yearsOfExperience) || 0,
      rating: Number(row.averageRating) || 0,
      totalReviews: Number(row.totalRatings) || 0,
      licenseVerificationStatus: row.licenseVerificationStatus,
      distanceKm: Number(row.distanceKm) || 0,
      city: row.city || null,
      state: row.state || null,
      photoUrl: row.photoUrl || null,
    };
  }
}