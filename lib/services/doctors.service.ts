import bcrypt from 'bcrypt';
import { DoctorsRepository, CreateDoctorData, CreateDoctorCredentialData, CreateDoctorSpecialtyData, CreateDoctorAvailabilityData, CreateDoctorUnavailabilityData, DoctorQuery, CreateAvailabilityTemplateData, UpdateAvailabilityTemplateData } from '@/lib/repositories/doctors.repository';
import { UsersService } from '@/lib/services/users.service';

export interface CreateDoctorDto {
  email: string;
  phone: string;
  password: string;
  firstName: string;
  lastName: string;
  medicalLicenseNumber: string;
  yearsOfExperience?: number;
  bio?: string;
  profilePhotoId?: string; // UUID reference to files table
  primaryLocation?: string;
  fullAddress?: string;
  city?: string;
  state?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  // consultationFee is in assignments table, not doctors table
  // isAvailable should be checked via doctorAvailability table
}

export interface UpdateDoctorDto {
  firstName?: string;
  lastName?: string;
  profilePhotoId?: string; // UUID reference to files table
  medicalLicenseNumber?: string;
  yearsOfExperience?: number;
  bio?: string;
  primaryLocation?: string;
  fullAddress?: string;
  city?: string;
  state?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  // consultationFee is in assignments table, not doctors table
  // isAvailable should be checked via doctorAvailability table
}

export class DoctorsService {
  private doctorsRepository = new DoctorsRepository();
  private usersService = new UsersService();

  private datesOverlap(aStart: string, aEnd?: string | null, bStart?: string, bEnd?: string | null) {
    const aEndValue = aEnd ?? '9999-12-31';
    const bStartValue = bStart ?? '0001-01-01';
    const bEndValue = bEnd ?? '9999-12-31';
    return aStart <= bEndValue && bStartValue <= aEndValue;
  }

  private getTemplateDaySet(template: { recurrencePattern: string; recurrenceDays?: string[] }) {
    if (template.recurrencePattern === 'daily') {
      return new Set(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
    }
    if (template.recurrencePattern === 'monthly') {
      return new Set<string>(); // handled separately
    }
    return new Set((template.recurrenceDays || []).map((d) => d.toLowerCase()));
  }

  private templatesConflict(newTemplate: any, existingTemplate: any) {
    if (!this.datesOverlap(newTemplate.validFrom, newTemplate.validUntil, existingTemplate.validFrom, existingTemplate.validUntil)) {
      return false;
    }

    const timesOverlap =
      newTemplate.startTime < existingTemplate.endTime && existingTemplate.startTime < newTemplate.endTime;
    if (!timesOverlap) {
      return false;
    }

    if (newTemplate.recurrencePattern === 'monthly' && existingTemplate.recurrencePattern === 'monthly') {
      return true;
    }

    if (newTemplate.recurrencePattern === 'monthly' || existingTemplate.recurrencePattern === 'monthly') {
      return newTemplate.recurrencePattern === 'daily' || existingTemplate.recurrencePattern === 'daily';
    }

    if (newTemplate.recurrencePattern === 'daily' || existingTemplate.recurrencePattern === 'daily') {
      return true;
    }

    const newDays = this.getTemplateDaySet(newTemplate);
    const existingDays = this.getTemplateDaySet(existingTemplate);
    if (newDays.size === 0 || existingDays.size === 0) return false;

    for (const day of newDays) {
      if (existingDays.has(day)) {
        return true;
      }
    }
    return false;
  }

  private getConflictDetails(newTemplate: any, existingTemplate: any): string {
    const details: string[] = [];
    
    // Check date overlap
    if (this.datesOverlap(newTemplate.validFrom, newTemplate.validUntil, existingTemplate.validFrom, existingTemplate.validUntil)) {
      details.push('date ranges overlap');
    }
    
    // Check time overlap
    const timesOverlap = newTemplate.startTime < existingTemplate.endTime && existingTemplate.startTime < newTemplate.endTime;
    if (timesOverlap) {
      details.push(`time slots overlap (${existingTemplate.startTime} - ${existingTemplate.endTime})`);
    }
    
    // Check day overlap
    const newDays = this.getTemplateDaySet(newTemplate);
    const existingDays = this.getTemplateDaySet(existingTemplate);
    if (newDays.size > 0 && existingDays.size > 0) {
      const commonDays = Array.from(newDays).filter(day => existingDays.has(day));
      if (commonDays.length > 0) {
        details.push(`days overlap: ${commonDays.join(', ')}`);
      }
    }
    
    return details.length > 0 ? details.join('; ') : 'Please adjust timing or days.';
  }

  async createDoctor(createDoctorDto: CreateDoctorDto) {
    try {
      // Check if user already exists
      const { UsersRepository } = await import('@/lib/repositories/users.repository');
      const usersRepository = new UsersRepository();
      const existingUser = await usersRepository.findUserByEmail(createDoctorDto.email);
      
      if (existingUser.length > 0) {
        return {
          success: false,
          message: 'User with this email already exists',
        };
      }

      // Create user first
      const hashedPassword = await bcrypt.hash(createDoctorDto.password, 10);
      const userResult = await this.usersService.create({
        email: createDoctorDto.email,
        phone: createDoctorDto.phone,
        password_hash: hashedPassword,
      }, 'doctor');

      if (!userResult.success || !userResult.data) {
        return {
          success: false,
          message: userResult.message || 'Failed to create user',
        };
      }

      const userId = userResult.data[0].id;

      // Only use lat/long if explicitly provided by frontend
      // Do not auto-geocode - frontend should handle geocoding if needed
      const doctor = await this.doctorsRepository.createDoctor(
        {
          firstName: createDoctorDto.firstName,
          lastName: createDoctorDto.lastName,
          profilePhotoId: createDoctorDto.profilePhotoId,
          medicalLicenseNumber: createDoctorDto.medicalLicenseNumber,
          yearsOfExperience: createDoctorDto.yearsOfExperience,
          bio: createDoctorDto.bio,
          primaryLocation: createDoctorDto.primaryLocation,
          fullAddress: createDoctorDto.fullAddress,
          city: createDoctorDto.city,
          state: createDoctorDto.state,
          pincode: createDoctorDto.pincode,
          latitude: createDoctorDto.latitude,
          longitude: createDoctorDto.longitude,
        },
        userId,
      );

      return {
        success: true,
        message: 'Doctor created successfully',
        data: {
          doctor: doctor[0],
          user: userResult.data[0],
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create doctor',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async findDoctors(query: DoctorQuery) {
    try {
      const doctors = await this.doctorsRepository.findDoctors(query);
      
      return {
        success: true,
        message: 'Doctors retrieved successfully',
        data: doctors,
        pagination: {
          page: query.page || 1,
          limit: query.limit || 10,
          total: doctors.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve doctors',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async findDoctorById(id: string) {
    try {
      const doctor = await this.doctorsRepository.findDoctorById(id);
      
      if (!doctor) {
        return {
          success: false,
          message: 'Doctor not found',
        };
      }

      return {
        success: true,
        message: 'Doctor retrieved successfully',
        data: doctor,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve doctor',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async findDoctorByUserId(userId: string) {
    try {
      const doctor = await this.doctorsRepository.findDoctorByUserId(userId);
      
      if (!doctor) {
        return {
          success: false,
          message: 'Doctor profile not found',
        };
      }

      return {
        success: true,
        message: 'Doctor profile retrieved successfully',
        data: doctor,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve doctor profile',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  async getDoctorHospitals(doctorId: string) {
    try {
      const hospitals = await this.doctorsRepository.getDoctorAffiliatedHospitals(doctorId);
      return {
        success: true,
        message: 'Hospitals retrieved successfully',
        data: hospitals,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve affiliated hospitals',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async createDoctorProfile(
    userId: string,
    createDoctorProfileDto: {
      medicalLicenseNumber: string;
      yearsOfExperience?: number;
      bio?: string;
      profilePhotoId?: string;
      primaryLocation?: string;
      fullAddress?: string;
      city?: string;
      state?: string;
      pincode?: string;
      latitude?: number;
      longitude?: number;
      firstName?: string;
      lastName?: string;
    },
  ) {
    try {
      // Check if doctor profile already exists
      const existingDoctor = await this.doctorsRepository.findDoctorByUserId(userId);
      if (existingDoctor) {
        return {
          success: false,
          message: 'Doctor profile already exists for this user',
        };
      }

      // Get user details
      const { UsersRepository } = await import('@/lib/repositories/users.repository');
      const usersRepository = new UsersRepository();
      const user = await usersRepository.getUserById(userId);
      
      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      // Note: firstName and lastName are stored in doctors table, not users table
      // They should be provided in the DTO or retrieved from user profile
      // For now, we'll accept them as optional parameters
      const firstName = createDoctorProfileDto.firstName || '';
      const lastName = createDoctorProfileDto.lastName || '';

      // Only use lat/long if explicitly provided by frontend
      // Do not auto-geocode - frontend should handle geocoding if needed
      const doctor = await this.doctorsRepository.createDoctor(
        {
          firstName,
          lastName,
          medicalLicenseNumber: createDoctorProfileDto.medicalLicenseNumber,
          yearsOfExperience: createDoctorProfileDto.yearsOfExperience,
          bio: createDoctorProfileDto.bio,
          profilePhotoId: createDoctorProfileDto.profilePhotoId,
          primaryLocation: createDoctorProfileDto.primaryLocation,
          fullAddress: createDoctorProfileDto.fullAddress,
          city: createDoctorProfileDto.city,
          state: createDoctorProfileDto.state,
          pincode: createDoctorProfileDto.pincode,
          latitude: createDoctorProfileDto.latitude,
          longitude: createDoctorProfileDto.longitude,
        },
        userId,
      );

      return {
        success: true,
        message: 'Doctor profile created successfully',
        data: doctor[0],
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create doctor profile',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async updateDoctor(id: string, updateDoctorDto: UpdateDoctorDto) {
    try {
      const doctor = await this.doctorsRepository.findDoctorById(id);
      if (!doctor) {
        return {
          success: false,
          message: 'Doctor not found',
        };
      }

      // Only use lat/long if explicitly provided by frontend
      // Do not auto-geocode - frontend should handle geocoding if needed
      const updatedDoctor = await this.doctorsRepository.updateDoctor(id, {
        ...updateDoctorDto,
      });

      return {
        success: true,
        message: 'Doctor updated successfully',
        data: updatedDoctor[0],
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update doctor',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async deleteDoctor(id: string) {
    try {
      const doctor = await this.doctorsRepository.findDoctorById(id);
      if (!doctor) {
        return {
          success: false,
          message: 'Doctor not found',
        };
      }

      await this.doctorsRepository.deleteDoctor(id);

      return {
        success: true,
        message: 'Doctor deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete doctor',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Doctor Credentials
  async addCredential(doctorId: string, credentialDto: CreateDoctorCredentialData) {
    try {
      const doctor = await this.doctorsRepository.findDoctorById(doctorId);
      if (!doctor) {
        return {
          success: false,
          message: 'Doctor not found',
        };
      }

      const credential = await this.doctorsRepository.createCredential(credentialDto, doctorId);

      return {
        success: true,
        message: 'Credential added successfully',
        data: credential[0],
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to add credential',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getDoctorCredentials(doctorId: string) {
    try {
      const credentials = await this.doctorsRepository.getDoctorCredentials(doctorId);
      const formatted = credentials.map((item: any) => ({
        id: item.credential.id,
        doctorId: item.credential.doctorId,
        fileId: item.credential.fileId,
        credentialType: item.credential.credentialType,
        title: item.credential.title,
        institution: item.credential.institution,
        verificationStatus: item.credential.verificationStatus,
        uploadedAt: item.credential.uploadedAt,
        file: item.file
          ? {
              id: item.file.id,
              filename: item.file.filename,
              url: item.file.url,
              mimetype: item.file.mimetype,
              size: item.file.size,
            }
          : null,
      }));

      return {
        success: true,
        message: 'Credentials retrieved successfully',
        data: formatted,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve credentials',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async updateCredentialStatus(
    credentialId: string,
    verificationStatus: 'pending' | 'verified' | 'rejected'
  ) {
    try {
      const updated = await this.doctorsRepository.updateCredentialStatus(credentialId, verificationStatus);

      if (!updated || updated.length === 0) {
        return {
          success: false,
          message: 'Credential not found',
        };
      }

      return {
        success: true,
        message: 'Credential updated successfully',
        data: updated[0],
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update credential',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Doctor Specialties
  async addSpecialty(doctorId: string, specialtyDto: CreateDoctorSpecialtyData) {
    try {
      const doctor = await this.doctorsRepository.findDoctorById(doctorId);
      if (!doctor) {
        return {
          success: false,
          message: 'Doctor not found',
        };
      }

      const specialty = await this.doctorsRepository.addSpecialty(specialtyDto, doctorId);

      return {
        success: true,
        message: 'Specialty added successfully',
        data: specialty[0],
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to add specialty',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getDoctorSpecialties(doctorId: string) {
    try {
      const specialties = await this.doctorsRepository.getDoctorSpecialties(doctorId);

      return {
        success: true,
        message: 'Specialties retrieved successfully',
        data: specialties,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve specialties',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async removeSpecialty(doctorId: string, specialtyId: string) {
    try {
      const result = await this.doctorsRepository.removeSpecialty(doctorId, specialtyId);
      
      if (result.length === 0) {
        return {
          success: false,
          message: 'Specialty not found',
        };
      }

      return {
        success: true,
        message: 'Specialty removed successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to remove specialty',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Availability templates
  async createAvailabilityTemplate(doctorId: string, templateDto: CreateAvailabilityTemplateData) {
    try {
      const doctor = await this.doctorsRepository.findDoctorById(doctorId);
      if (!doctor) {
        return {
          success: false,
          message: 'Doctor not found',
        };
      }

      const existingTemplates = await this.doctorsRepository.getAvailabilityTemplates(doctorId);
      const conflictingTemplate = existingTemplates.find((template) =>
        this.templatesConflict(
          {
            ...templateDto,
            recurrenceDays: templateDto.recurrencePattern === 'daily' || templateDto.recurrencePattern === 'monthly'
              ? []
              : templateDto.recurrenceDays || [],
          },
          template,
        )
      );

      if (conflictingTemplate) {
        const conflictDetails = this.getConflictDetails(
          {
            ...templateDto,
            recurrenceDays: templateDto.recurrencePattern === 'daily' || templateDto.recurrencePattern === 'monthly'
              ? []
              : templateDto.recurrenceDays || [],
          },
          conflictingTemplate,
        );
        return {
          success: false,
          message: `Template overlaps with existing template "${conflictingTemplate.templateName}". ${conflictDetails}`,
        };
      }

      const template = await this.doctorsRepository.createAvailabilityTemplate(templateDto, doctorId);

      return {
        success: true,
        message: 'Availability template created successfully',
        data: template,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create availability template',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getDoctorAvailabilityTemplates(doctorId: string) {
    try {
      const templates = await this.doctorsRepository.getAvailabilityTemplates(doctorId);
      return {
        success: true,
        message: 'Availability templates retrieved successfully',
        data: templates,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve availability templates',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async updateAvailabilityTemplate(doctorId: string, templateId: string, updateData: UpdateAvailabilityTemplateData) {
    try {
      const currentTemplate = await this.doctorsRepository.getAvailabilityTemplateById(templateId);
      if (!currentTemplate || currentTemplate.doctorId !== doctorId) {
        return {
          success: false,
          message: 'Template not found or does not belong to doctor',
        };
      }

      const mergedTemplate = {
        templateName: updateData.templateName ?? currentTemplate.templateName,
        startTime: updateData.startTime ?? currentTemplate.startTime,
        endTime: updateData.endTime ?? currentTemplate.endTime,
        recurrencePattern: (updateData.recurrencePattern ?? currentTemplate.recurrencePattern) as 'daily' | 'weekly' | 'monthly' | 'custom',
        recurrenceDays:
          (updateData.recurrencePattern ?? currentTemplate.recurrencePattern) === 'daily' ||
          (updateData.recurrencePattern ?? currentTemplate.recurrencePattern) === 'monthly'
            ? []
            : updateData.recurrenceDays ?? currentTemplate.recurrenceDays ?? [],
        validFrom: updateData.validFrom ?? currentTemplate.validFrom,
        validUntil: updateData.validUntil ?? currentTemplate.validUntil,
      };

      const templates = await this.doctorsRepository.getAvailabilityTemplates(doctorId);
      const conflictingTemplate = templates
        .filter((tpl) => tpl.id !== templateId)
        .find((tpl) => this.templatesConflict(mergedTemplate, tpl));

      if (conflictingTemplate) {
        const conflictDetails = this.getConflictDetails(mergedTemplate, conflictingTemplate);
        return {
          success: false,
          message: `Updated template overlaps with existing template "${conflictingTemplate.templateName}". ${conflictDetails}`,
        };
      }

      const template = await this.doctorsRepository.updateAvailabilityTemplate(templateId, doctorId, updateData);

      return {
        success: true,
        message: 'Availability template updated successfully',
        data: template,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update availability template',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async deleteAvailabilityTemplate(doctorId: string, templateId: string) {
    try {
      const template = await this.doctorsRepository.deleteAvailabilityTemplate(templateId, doctorId);

      if (!template) {
        return {
          success: false,
          message: 'Template not found or does not belong to doctor',
        };
      }

      return {
        success: true,
        message: 'Availability template deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete availability template',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Doctor Availability
  async addAvailability(doctorId: string, availabilityDto: CreateDoctorAvailabilityData) {
    try {
      const doctor = await this.doctorsRepository.findDoctorById(doctorId);
      if (!doctor) {
        return {
          success: false,
          message: 'Doctor not found',
        };
      }

      // Validate and normalize date format (YYYY-MM-DD)
      // Accept date as-is from frontend - no timezone conversion
      // The date string represents a calendar date, not a timestamp
      let slotDate = availabilityDto.slotDate;
      if (slotDate) {
        // Ensure format is YYYY-MM-DD (remove any time/timezone if present)
        const dateMatch = slotDate.match(/^(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          slotDate = dateMatch[1];
        } else {
          return {
            success: false,
            message: 'Invalid date format. Expected YYYY-MM-DD',
          };
        }
      }

      // Validate time format (HH:mm)
      const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
      if (availabilityDto.startTime && !timeRegex.test(availabilityDto.startTime)) {
        return {
          success: false,
          message: 'Invalid start time format. Expected HH:mm (24-hour format)',
        };
      }
      if (availabilityDto.endTime && !timeRegex.test(availabilityDto.endTime)) {
        return {
          success: false,
          message: 'Invalid end time format. Expected HH:mm (24-hour format)',
        };
      }

       const overlap = await this.doctorsRepository.hasAvailabilityOverlap(
         doctorId,
         slotDate,
         availabilityDto.startTime,
         availabilityDto.endTime,
       );
       if (overlap) {
         return {
           success: false,
           message: 'Slot overlaps with an existing availability. Choose a different time range.',
         };
       }

      // Use normalized date
      const normalizedDto = {
        ...availabilityDto,
        slotDate,
      };

      const availability = await this.doctorsRepository.createAvailability(normalizedDto, doctorId);

      return {
        success: true,
        message: 'Availability added successfully',
        data: availability[0],
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to add availability',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getDoctorAvailability(doctorId: string) {
    try {
      const availability = await this.doctorsRepository.getDoctorAvailability(doctorId);

      return {
        success: true,
        message: 'Availability retrieved successfully',
        data: availability,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve availability',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async updateAvailability(availabilityId: string, updateData: Partial<CreateDoctorAvailabilityData>) {
    try {
      const existing = await this.doctorsRepository.getAvailabilityById(availabilityId);
      if (!existing) {
        return {
          success: false,
          message: 'Availability slot not found',
        };
      }

      const slotDate = updateData.slotDate ?? existing.slotDate;
      const startTime = updateData.startTime ?? existing.startTime;
      const endTime = updateData.endTime ?? existing.endTime;

      const overlap = await this.doctorsRepository.hasAvailabilityOverlap(
        existing.doctorId,
        slotDate,
        startTime,
        endTime,
        availabilityId,
      );

      if (overlap) {
        return {
          success: false,
          message: 'Updated slot overlaps with an existing availability. Choose a different time range.',
        };
      }

      const availability = await this.doctorsRepository.updateAvailability(availabilityId, {
        ...updateData,
        slotDate,
        startTime,
        endTime,
      });

      return {
        success: true,
        message: 'Availability updated successfully',
        data: availability[0],
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update availability',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async deleteAvailability(availabilityId: string) {
    try {
      await this.doctorsRepository.deleteAvailability(availabilityId);

      return {
        success: true,
        message: 'Availability deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete availability',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Doctor Unavailability
  async addUnavailability(doctorId: string, unavailabilityDto: CreateDoctorUnavailabilityData) {
    try {
      const doctor = await this.doctorsRepository.findDoctorById(doctorId);
      if (!doctor) {
        return {
          success: false,
          message: 'Doctor not found',
        };
      }

      const unavailability = await this.doctorsRepository.createUnavailability(unavailabilityDto, doctorId);

      return {
        success: true,
        message: 'Unavailability added successfully',
        data: unavailability[0],
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to add unavailability',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getDoctorUnavailability(doctorId: string) {
    try {
      const unavailability = await this.doctorsRepository.getDoctorUnavailability(doctorId);

      return {
        success: true,
        message: 'Unavailability retrieved successfully',
        data: unavailability,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve unavailability',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async updateUnavailability(doctorId: string, unavailabilityId: string, updateData: Partial<CreateDoctorUnavailabilityData>) {
    try {
      const unavailability = await this.doctorsRepository.updateUnavailability(unavailabilityId, doctorId, updateData);

      if (!unavailability) {
        return {
          success: false,
          message: 'Leave not found or does not belong to doctor',
        };
      }

      return {
        success: true,
        message: 'Leave updated successfully',
        data: unavailability,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update leave',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async deleteUnavailability(unavailabilityId: string) {
    try {
      await this.doctorsRepository.deleteUnavailability(unavailabilityId);

      return {
        success: true,
        message: 'Unavailability deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete unavailability',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Statistics
  async getDoctorStats(doctorId: string) {
    try {
      const stats = await this.doctorsRepository.getDoctorStats(doctorId);

      return {
        success: true,
        message: 'Doctor statistics retrieved successfully',
        data: stats,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve doctor statistics',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Doctor Profile Photos
  async getDoctorProfilePhotos(doctorId: string) {
    try {
      const photos = await this.doctorsRepository.getDoctorProfilePhotos(doctorId);

      return {
        success: true,
        message: 'Profile photos retrieved successfully',
        data: photos,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve profile photos',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async addProfilePhoto(doctorId: string, fileId: string, isPrimary: boolean = false) {
    try {
      const doctor = await this.doctorsRepository.findDoctorById(doctorId);
      if (!doctor) {
        return {
          success: false,
          message: 'Doctor not found',
        };
      }

      const photo = await this.doctorsRepository.addProfilePhoto(doctorId, fileId, isPrimary);

      return {
        success: true,
        message: 'Profile photo added successfully',
        data: photo[0],
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to add profile photo',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async setPrimaryPhoto(doctorId: string, photoId: string) {
    try {
      const doctor = await this.doctorsRepository.findDoctorById(doctorId);
      if (!doctor) {
        return {
          success: false,
          message: 'Doctor not found',
        };
      }

      const photo = await this.doctorsRepository.setPrimaryPhoto(doctorId, photoId);

      if (photo.length === 0) {
        return {
          success: false,
          message: 'Photo not found',
        };
      }

      return {
        success: true,
        message: 'Primary photo updated successfully',
        data: photo[0],
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to set primary photo',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async deleteProfilePhoto(doctorId: string, photoId: string) {
    try {
      const doctor = await this.doctorsRepository.findDoctorById(doctorId);
      if (!doctor) {
        return {
          success: false,
          message: 'Doctor not found',
        };
      }

      await this.doctorsRepository.deleteProfilePhoto(photoId, doctorId);

      return {
        success: true,
        message: 'Profile photo deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to delete profile photo',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}


