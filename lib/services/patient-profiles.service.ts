import { PatientProfilesRepository } from '@/lib/repositories/patient-profiles.repository';
import { getDb } from '@/lib/db';

export class PatientProfilesService {
  private profilesRepo = new PatientProfilesRepository();

  // Helper to ensure patient profile exists for a userId and return it
  private async getVerifiedProfile(userId: string) {
    const profile = await this.profilesRepo.findProfileByUserId(userId);
    if (!profile) {
      throw new Error('Patient profile not found');
    }
    return profile;
  }

  // --- Profile ---
  async getProfile(userId: string) {
    return await this.getVerifiedProfile(userId);
  }

  async updateProfile(userId: string, fullName: string) {
    const profile = await this.getVerifiedProfile(userId);
    const [updated] = await this.profilesRepo.updateProfile(profile.id, fullName);
    return updated;
  }

  // --- Saved Addresses ---
  async getAddresses(userId: string) {
    const profile = await this.getVerifiedProfile(userId);
    return await this.profilesRepo.getAddresses(profile.id);
  }

  async addAddress(userId: string, addressData: any) {
    const profile = await this.getVerifiedProfile(userId);
    const db = getDb();

    let created: any;

    await db.transaction(async (tx) => {
      const txRepo = new PatientProfilesRepository(tx);

      // If this address is set as default, unset other defaults first
      if (addressData.isDefault) {
        await txRepo.unsetDefaultAddresses(profile.id);
      }

      const [res] = await txRepo.createAddress(addressData, profile.id);
      created = res;
    });

    return created;
  }

  async updateAddress(userId: string, addressId: string, updateData: any) {
    const profile = await this.getVerifiedProfile(userId);
    
    // Ownership check
    const existingAddress = await this.profilesRepo.getAddressById(addressId);
    if (!existingAddress || existingAddress.patientProfileId !== profile.id) {
      throw new Error('Address not found or unauthorized');
    }

    // If update sets isDefault to true, unset other defaults
    if (updateData.isDefault) {
      const db = getDb();
      let updated: any;
      await db.transaction(async (tx) => {
        const txRepo = new PatientProfilesRepository(tx);
        await txRepo.unsetDefaultAddresses(profile.id);
        const [res] = await txRepo.updateAddress(addressId, updateData);
        updated = res;
      });
      return updated;
    }

    const [updated] = await this.profilesRepo.updateAddress(addressId, updateData);
    return updated;
  }

  async deleteAddress(userId: string, addressId: string) {
    const profile = await this.getVerifiedProfile(userId);

    // Ownership check
    const existingAddress = await this.profilesRepo.getAddressById(addressId);
    if (!existingAddress || existingAddress.patientProfileId !== profile.id) {
      throw new Error('Address not found or unauthorized');
    }

    const [deleted] = await this.profilesRepo.deleteAddress(addressId);
    return deleted;
  }

  // --- Family Members ---
  async getFamilyMembers(userId: string) {
    const profile = await this.getVerifiedProfile(userId);
    return await this.profilesRepo.getFamilyMembers(profile.id);
  }

  async addFamilyMember(userId: string, familyData: any) {
    const profile = await this.getVerifiedProfile(userId);
    const [created] = await this.profilesRepo.createFamilyMember(familyData, profile.id);
    return created;
  }

  async updateFamilyMember(userId: string, memberId: string, updateData: any) {
    const profile = await this.getVerifiedProfile(userId);

    // Ownership check
    const existingMember = await this.profilesRepo.getFamilyMemberById(memberId);
    if (!existingMember || existingMember.patientProfileId !== profile.id) {
      throw new Error('Family member not found or unauthorized');
    }

    const [updated] = await this.profilesRepo.updateFamilyMember(memberId, updateData);
    return updated;
  }

  async deleteFamilyMember(userId: string, memberId: string) {
    const profile = await this.getVerifiedProfile(userId);

    // Ownership check
    const existingMember = await this.profilesRepo.getFamilyMemberById(memberId);
    if (!existingMember || existingMember.patientProfileId !== profile.id) {
      throw new Error('Family member not found or unauthorized');
    }

    const [deleted] = await this.profilesRepo.deleteFamilyMember(memberId);
    return deleted;
  }

  // --- Home Visit Bookings ---
  async getHomeVisitBookings(userId: string) {
    const profile = await this.getVerifiedProfile(userId);
    return await this.profilesRepo.getPatientHomeVisitBookings(profile.id);
  }
}
