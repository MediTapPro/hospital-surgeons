import { getDb } from '@/lib/db';
import { 
  patientProfiles, 
  patientAddresses, 
  patientFamilyMembers,
  users 
} from '@/src/db/drizzle/migrations/schema';
import { eq, and, desc } from 'drizzle-orm';

export interface CreatePatientProfileData {
  fullName: string;
}

export interface CreateAddressData {
  label: string;
  addressText: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}

export interface CreateFamilyMemberData {
  fullName: string;
  phone: string;
  relationship: string;
}

export class PatientProfilesRepository {
  constructor(private db: any = getDb()) {}

  // --- Patient Profiles ---
  async createProfile(profileData: CreatePatientProfileData, userId: string, tx?: any) {
    const client = tx || this.db;
    return await client
      .insert(patientProfiles)
      .values({
        userId,
        fullName: profileData.fullName,
      })
      .returning();
  }

  async findProfileByUserId(userId: string) {
    const result = await this.db
      .select()
      .from(patientProfiles)
      .where(eq(patientProfiles.userId, userId))
      .limit(1);
    return result[0] || null;
  }

  async findProfileById(id: string) {
    const result = await this.db
      .select({
        profile: patientProfiles,
        user: users,
      })
      .from(patientProfiles)
      .leftJoin(users, eq(patientProfiles.userId, users.id))
      .where(eq(patientProfiles.id, id))
      .limit(1);
    return result[0] || null;
  }

  async updateProfile(id: string, fullName: string) {
    return await this.db
      .update(patientProfiles)
      .set({
        fullName,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(patientProfiles.id, id))
      .returning();
  }

  // --- Saved Addresses ---
  async createAddress(addressData: CreateAddressData, patientProfileId: string, tx?: any) {
    const client = tx || this.db;
    return await client
      .insert(patientAddresses)
      .values({
        patientProfileId,
        label: addressData.label,
        addressText: addressData.addressText,
        latitude: addressData.latitude ? String(addressData.latitude) : null,
        longitude: addressData.longitude ? String(addressData.longitude) : null,
        isDefault: addressData.isDefault || false,
      })
      .returning();
  }

  async getAddresses(patientProfileId: string) {
    return await this.db
      .select()
      .from(patientAddresses)
      .where(eq(patientAddresses.patientProfileId, patientProfileId))
      .orderBy(desc(patientAddresses.isDefault), desc(patientAddresses.createdAt));
  }

  async getDefaultAddress(patientProfileId: string) {
    const result = await this.db
      .select()
      .from(patientAddresses)
      .where(
        and(
          eq(patientAddresses.patientProfileId, patientProfileId),
          eq(patientAddresses.isDefault, true)
        )
      )
      .limit(1);
    return result[0] || null;
  }

  async getAddressById(id: string) {
    const result = await this.db
      .select()
      .from(patientAddresses)
      .where(eq(patientAddresses.id, id))
      .limit(1);
    return result[0] || null;
  }

  async unsetDefaultAddresses(patientProfileId: string, tx?: any) {
    const client = tx || this.db;
    return await client
      .update(patientAddresses)
      .set({ isDefault: false })
      .where(eq(patientAddresses.patientProfileId, patientProfileId));
  }

  async updateAddress(id: string, updateData: Partial<CreateAddressData>) {
    const values: any = {
      updatedAt: new Date().toISOString(),
    };
    if (updateData.label !== undefined) values.label = updateData.label;
    if (updateData.addressText !== undefined) values.addressText = updateData.addressText;
    if (updateData.latitude !== undefined) values.latitude = updateData.latitude ? String(updateData.latitude) : null;
    if (updateData.longitude !== undefined) values.longitude = updateData.longitude ? String(updateData.longitude) : null;
    if (updateData.isDefault !== undefined) values.isDefault = updateData.isDefault;

    return await this.db
      .update(patientAddresses)
      .set(values)
      .where(eq(patientAddresses.id, id))
      .returning();
  }

  async deleteAddress(id: string) {
    return await this.db
      .delete(patientAddresses)
      .where(eq(patientAddresses.id, id))
      .returning();
  }

  // --- Family Members ---
  async createFamilyMember(familyData: CreateFamilyMemberData, patientProfileId: string, tx?: any) {
    const client = tx || this.db;
    return await client
      .insert(patientFamilyMembers)
      .values({
        patientProfileId,
        fullName: familyData.fullName,
        phone: familyData.phone,
        relationship: familyData.relationship,
      })
      .returning();
  }

  async getFamilyMembers(patientProfileId: string) {
    return await this.db
      .select()
      .from(patientFamilyMembers)
      .where(eq(patientFamilyMembers.patientProfileId, patientProfileId))
      .orderBy(desc(patientFamilyMembers.createdAt));
  }

  async getFamilyMemberById(id: string) {
    const result = await this.db
      .select()
      .from(patientFamilyMembers)
      .where(eq(patientFamilyMembers.id, id))
      .limit(1);
    return result[0] || null;
  }

  async updateFamilyMember(id: string, updateData: Partial<CreateFamilyMemberData>) {
    const values: any = {
      updatedAt: new Date().toISOString(),
    };
    if (updateData.fullName !== undefined) values.fullName = updateData.fullName;
    if (updateData.phone !== undefined) values.phone = updateData.phone;
    if (updateData.relationship !== undefined) values.relationship = updateData.relationship;

    return await this.db
      .update(patientFamilyMembers)
      .set(values)
      .where(eq(patientFamilyMembers.id, id))
      .returning();
  }

  async deleteFamilyMember(id: string) {
    return await this.db
      .delete(patientFamilyMembers)
      .where(eq(patientFamilyMembers.id, id))
      .returning();
  }
}
