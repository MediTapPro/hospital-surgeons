import bcrypt from 'bcrypt';
import { HospitalsRepository, CreateHospitalData, CreateHospitalDepartmentData, CreateHospitalStaffData, CreateFavoriteDoctorData, CreateHospitalDocumentData, HospitalQuery } from '@/lib/repositories/hospitals.repository';
import { UsersService } from '@/lib/services/users.service';

export interface CreateHospitalDto {
  email: string;
  phone: string;
  password: string;
  name: string;
  hospitalType?: string;
  registrationNumber: string;
  address: string;
  city: string;
  website?: string;
  logoId?: string; // UUID reference to files table
  numberOfBeds?: number;
  latitude?: number;
  longitude?: number;
  contactEmail?: string;
}

export interface UpdateHospitalDto {
  name?: string;
  hospitalType?: string;
  registrationNumber?: string;
  address?: string;
  city?: string;
  fullAddress?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  website?: string;
  logoId?: string; // UUID reference to files table
  numberOfBeds?: number;
  latitude?: number;
  longitude?: number;
  contactEmail?: string;
}

export class HospitalsService {
  private hospitalsRepository = new HospitalsRepository();
  private usersService = new UsersService();

  async createHospital(createHospitalDto: CreateHospitalDto) {
    try {
      // Check if user already exists
      const { UsersRepository } = await import('@/lib/repositories/users.repository');
      const usersRepository = new UsersRepository();
      const existingUser = await usersRepository.findUserByEmail(createHospitalDto.email);
      
      if (existingUser.length > 0) {
        return {
          success: false,
          message: 'User with this email already exists',
        };
      }

      // Password will be hashed in the users service
      const userResult = await this.usersService.create({
        email: createHospitalDto.email,
        phone: createHospitalDto.phone,
        password_hash: createHospitalDto.password, // Service will hash it
      }, 'hospital');

      if (!userResult.success || !userResult.data) {
        return {
          success: false,
          message: userResult.message || 'Failed to create user',
        };
      }

      const userId = userResult.data[0].id;

      // Only use lat/long if explicitly provided by frontend
      // Do not auto-geocode - frontend should handle geocoding if needed
      const hospitalData: CreateHospitalData = {
        name: createHospitalDto.name,
        hospitalType: createHospitalDto.hospitalType,
        registrationNumber: createHospitalDto.registrationNumber || `REG-${Date.now()}`,
        address: createHospitalDto.address || '',
        city: createHospitalDto.city || '',
        phone: createHospitalDto.phone,
        website: createHospitalDto.website,
        logoId: createHospitalDto.logoId,
        numberOfBeds: createHospitalDto.numberOfBeds,
        latitude: createHospitalDto.latitude,
        longitude: createHospitalDto.longitude,
        contactEmail: createHospitalDto.contactEmail,
      };
      const hospital = await this.hospitalsRepository.createHospital(hospitalData, userId);

      return {
        success: true,
        message: 'Hospital created successfully',
        data: {
          hospital: hospital[0],
          user: userResult.data[0],
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create hospital',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async findHospitals(query: HospitalQuery) {
    try {
      const hospitals = await this.hospitalsRepository.findHospitals(query);
      
      return {
        success: true,
        message: 'Hospitals retrieved successfully',
        data: hospitals,
        pagination: {
          page: query.page || 1,
          limit: query.limit || 10,
          total: hospitals.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve hospitals',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async findHospitalById(id: string) {
    try {
      const hospital = await this.hospitalsRepository.findHospitalById(id);
      
      if (!hospital) {
        return {
          success: false,
          message: 'Hospital not found',
        };
      }

      return {
        success: true,
        message: 'Hospital retrieved successfully',
        data: hospital,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve hospital',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async findHospitalByUserId(userId: string) {
    try {
      const hospital = await this.hospitalsRepository.findHospitalByUserId(userId);
      
      if (!hospital) {
        return {
          success: false,
          message: 'Hospital profile not found',
        };
      }

      return {
        success: true,
        message: 'Hospital profile retrieved successfully',
        data: hospital,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve hospital profile',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async updateHospital(id: string, updateHospitalDto: UpdateHospitalDto) {
    try {
      const hospital = await this.hospitalsRepository.findHospitalById(id);
      if (!hospital) {
        return {
          success: false,
          message: 'Hospital not found',
        };
      }

      // Only use lat/long if explicitly provided by frontend
      // Do not auto-geocode - frontend should handle geocoding if needed
      const updatedHospital = await this.hospitalsRepository.updateHospital(id, {
        ...updateHospitalDto,
      });

      return {
        success: true,
        message: 'Hospital updated successfully',
        data: updatedHospital[0],
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update hospital',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async deleteHospital(id: string) {
    try {
      const hospital = await this.hospitalsRepository.findHospitalById(id);
      if (!hospital) {
        return {
          success: false,
          message: 'Hospital not found',
        };
      }

      await this.hospitalsRepository.deleteHospital(id);

      return {
        success: true,
        message: 'Hospital deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete hospital',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Hospital Departments
  async addDepartment(hospitalId: string, departmentDto: CreateHospitalDepartmentData) {
    try {
      const hospital = await this.hospitalsRepository.findHospitalById(hospitalId);
      if (!hospital) {
        return {
          success: false,
          message: 'Hospital not found',
        };
      }

      const department = await this.hospitalsRepository.addDepartment(departmentDto, hospitalId);

      return {
        success: true,
        message: 'Department added successfully',
        data: department[0],
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to add department',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getHospitalDepartments(hospitalId: string) {
    try {
      const departments = await this.hospitalsRepository.getHospitalDepartments(hospitalId);

      return {
        success: true,
        message: 'Departments retrieved successfully',
        data: departments,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve departments',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async updateDepartment(departmentId: string, updateData: Partial<CreateHospitalDepartmentData>) {
    try {
      const department = await this.hospitalsRepository.updateDepartment(departmentId, updateData);

      return {
        success: true,
        message: 'Department updated successfully',
        data: department[0],
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update department',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async deleteDepartment(departmentId: string) {
    try {
      await this.hospitalsRepository.deleteDepartment(departmentId);

      return {
        success: true,
        message: 'Department deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete department',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Hospital Staff
  async addStaff(hospitalId: string, staffDto: CreateHospitalStaffData) {
    try {
      const hospital = await this.hospitalsRepository.findHospitalById(hospitalId);
      if (!hospital) {
        return {
          success: false,
          message: 'Hospital not found',
        };
      }

      // hospitalStaff table doesn't exist - use doctorHospitalAffiliations instead
      return {
        success: false,
        message: 'hospitalStaff table not found in database. Use doctorHospitalAffiliations instead.',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to add staff',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getHospitalStaff(hospitalId: string) {
    try {
      const staff = await this.hospitalsRepository.getHospitalStaff(hospitalId);

      return {
        success: true,
        message: 'Staff retrieved successfully',
        data: staff,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve staff',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async updateStaff(staffId: string, updateData: Partial<CreateHospitalStaffData>) {
    try {
      // hospitalStaff table doesn't exist - use doctorHospitalAffiliations instead
      return {
        success: false,
        message: 'hospitalStaff table not found in database. Use doctorHospitalAffiliations instead.',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update staff',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async deleteStaff(staffId: string) {
    try {
      await this.hospitalsRepository.deleteStaff(staffId);

      return {
        success: true,
        message: 'Staff deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete staff',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Favorite Doctors
  async addFavoriteDoctor(hospitalId: string, favoriteDto: CreateFavoriteDoctorData) {
    try {
      const hospital = await this.hospitalsRepository.findHospitalById(hospitalId);
      if (!hospital) {
        return {
          success: false,
          message: 'Hospital not found',
        };
      }

      await this.hospitalsRepository.addFavoriteDoctor(favoriteDto, hospitalId);

      return {
        success: true,
        message: 'Favorite doctor added successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to add favorite doctor',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getHospitalFavoriteDoctors(hospitalId: string) {
    try {
      const favorites = await this.hospitalsRepository.getHospitalFavoriteDoctors(hospitalId);

      return {
        success: true,
        message: 'Favorite doctors retrieved successfully',
        data: favorites,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve favorite doctors',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async removeFavoriteDoctor(hospitalId: string, doctorId: string) {
    try {
      await this.hospitalsRepository.removeFavoriteDoctor(hospitalId, doctorId);

      return {
        success: true,
        message: 'Favorite doctor removed successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to remove favorite doctor',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Hospital Documents
  async getHospitalDocuments(hospitalId: string) {
    try {
      const documents = await this.hospitalsRepository.getHospitalDocuments(hospitalId);

      return {
        success: true,
        message: 'Hospital documents retrieved successfully',
        data: documents,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve hospital documents',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async addDocument(hospitalId: string, documentDto: CreateHospitalDocumentData) {
    try {
      const result = await this.hospitalsRepository.addDocument(documentDto, hospitalId);

      return {
        success: true,
        message: 'Document uploaded successfully',
        data: result[0],
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to upload document',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async deleteDocument(hospitalId: string, documentId: string) {
    try {
      const result = await this.hospitalsRepository.deleteDocument(documentId, hospitalId);

      if (result.length === 0) {
        return {
          success: false,
          message: 'Document not found or you do not have permission to delete it',
        };
      }

      return {
        success: true,
        message: 'Document deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete document',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Statistics
  async getHospitalStats(hospitalId: string) {
    try {
      const stats = await this.hospitalsRepository.getHospitalStats(hospitalId);

      return {
        success: true,
        message: 'Hospital statistics retrieved successfully',
        data: stats,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve hospital statistics',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

