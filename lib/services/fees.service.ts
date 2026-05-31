import { FeesRepository, CreateFeeData } from '@/lib/repositories/fees.repository';

export class FeesService {
  private repository = new FeesRepository();

  async saveFee(data: CreateFeeData) {
    try {
      const result = await this.repository.createOrUpdateFee(data);
      const isMrp = !data.hospitalId;
      return { 
        success: true, 
        message: isMrp ? 'MRP fee saved successfully' : 'Hospital fee saved successfully', 
        data: result[0] 
      };
    } catch (error: any) {
      console.error('Error saving fee:', error);
      return { success: false, message: error.message || 'Failed to save fee', error };
    }
  }

  async getMrpFees(doctorId: string, filters: { specialtyId?: string } = {}) {
    try {
      const data = await this.repository.findMrpFees(doctorId, filters);
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching MRP fees:', error);
      return { success: false, message: 'Failed to fetch MRP fees', error };
    }
  }

  async deleteFee(id: string, doctorId: string) {
    try {
      await this.repository.deleteFee(id, doctorId);
      return { success: true, message: 'Fee deleted successfully' };
    } catch (error) {
      console.error('Error deleting fee:', error);
      return { success: false, message: 'Failed to delete fee', error };
    }
  }

  // --- Hospital Discounts ---

  async saveHospitalDiscount(doctorId: string, hospitalId: string, discountPercentage: string) {
    try {
      // Enforce 5-hospital limit
      const existingDiscounts = await this.repository.findHospitalDiscounts(doctorId);
      
      const alreadyExists = existingDiscounts.some(d => d.hospitalId === hospitalId);
      
      if (!alreadyExists && existingDiscounts.length >= 5) {
        return { 
          success: false, 
          message: 'Limit reached: You can only set discounts for up to 5 hospitals.' 
        };
      }

      const result = await this.repository.upsertHospitalDiscount(doctorId, hospitalId, discountPercentage);
      return { success: true, message: 'Hospital discount saved successfully', data: result[0] };
    } catch (error) {
      console.error('Error saving hospital discount:', error);
      return { success: false, message: 'Failed to save hospital discount', error };
    }
  }

  async getAllFees(doctorId: string) {
    try {
      const result = await this.repository.findAllFeesByDoctorId(doctorId);
      return { success: true, data: result };
    } catch (error) {
      console.error('Error fetching all fees:', error);
      return { success: false, message: 'Failed to fetch fees', error };
    }
  }

  async getHospitalDiscounts(doctorId: string) {
    try {
      const data = await this.repository.findHospitalDiscounts(doctorId);
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching hospital discounts:', error);
      return { success: false, message: 'Failed to fetch hospital discounts', error };
    }
  }

  async removeHospitalDiscount(doctorId: string, hospitalId: string) {
    try {
      await this.repository.deleteHospitalDiscount(doctorId, hospitalId);
      return { success: true, message: 'Hospital discount removed successfully' };
    } catch (error) {
      console.error('Error removing hospital discount:', error);
      return { success: false, message: 'Failed to remove hospital discount', error };
    }
  }

  async getHospitalFees(hospitalId: string, status?: string | null, page: number = 1, limit: number = 50) {
    try {
      const { data, total } = await this.repository.findFeesForHospital(hospitalId, status, page, limit);
      return { 
        success: true, 
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error fetching hospital fees:', error);
      return { success: false, message: 'Failed to fetch hospital fees', error };
    }
  }

  async updateProposalStatus(id: string, hospitalId: string, status: string, reason?: string) {
    try {
      const result = await this.repository.updateFeeStatus(id, hospitalId, status, reason);
      if (result.length === 0) {
        return { success: false, message: 'Proposal not found or unauthorized' };
      }
      return { 
        success: true, 
        message: `Proposal ${status === 'approved' ? 'accepted' : 'rejected'} successfully`,
        data: result[0]
      };
    } catch (error) {
      console.error('Error updating proposal status:', error);
      return { success: false, message: 'Failed to update proposal status', error };
    }
  }

  async getEffectiveFee(params: {
    doctorId: string;
    specialtyId: string;
    procedureId?: string | null;
    procedureTypeId?: string | null;
    roomTypeId: string;
    hospitalId: string;
  }) {
    return await this.repository.findEffectiveFee(params);
  }

  async bulkPropose(params: {
    doctorId: string;
    hospitalId: string;
    specialtyId: string;
    discountPercentage?: string;
  }) {
    try {
      return await this.repository.bulkProposeFromMrp(params);
    } catch (error: any) {
      console.error('Error in bulkPropose:', error);
      return { success: false, message: error.message || 'Failed to perform bulk proposal' };
  }
  }

  async getDoctorCatalogForHospital(doctorId: string, hospitalId: string, specialtyId?: string) {
    try {
      const flatFees = await this.repository.findEffectiveFeesForDoctorAtHospital(doctorId, hospitalId, specialtyId);
      
      // Group by specialty
      const specialtyGroups = new Map<string, any>();
      
      for (const fee of flatFees) {
        const specId = fee.specialtyId || 'unknown';
        if (!specialtyGroups.has(specId)) {
          specialtyGroups.set(specId, {
            specialtyId: specId,
            specialtyName: fee.specialtyName || 'Unknown Specialty',
            combinations: []
          });
        }
        
        const { specialtyId: _, specialtyName: __, ...combination } = fee;
        specialtyGroups.get(specId).combinations.push(combination);
      }
      
      return { 
        success: true, 
        data: {
          doctorId,
          specialties: Array.from(specialtyGroups.values())
        }
      };
    } catch (error) {
      console.error('Error fetching doctor catalog:', error);
      return { success: false, message: 'Failed to fetch doctor catalog', error };
    }
  }
}
