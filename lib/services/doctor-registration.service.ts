import { getDb } from '@/lib/db';
import { UsersRepository } from '@/lib/repositories/users.repository';
import { DoctorsRepository } from '@/lib/repositories/doctors.repository';
import { SubscriptionsService } from '@/lib/services/subscriptions.service';
import { subscriptionPlans } from '@/src/db/drizzle/migrations/schema';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcrypt';

export class DoctorRegistrationService {
  async register(body: any) {
    const db = getDb();

    const usersRepo = new UsersRepository(db);
    const doctorsRepo = new DoctorsRepository(db);

    const existingUser = await usersRepo.findUserByEmail(body.email);
    if (existingUser.length > 0) {
      throw new Error('User with this email already exists');
    }

    const existingDoctor = await doctorsRepo.findDoctorByLicenseNumber(body.medicalLicenseNumber);
    if (existingDoctor.length > 0) {
      throw new Error('Doctor with this license number already exists');
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const latitude = body.latitude || null;
    const longitude = body.longitude || null;

    let newUser: any;
    let newDoctor: any;
    let insertedSpecialties: any[] = [];

    await db.transaction(async (tx) => {
      const txUsersRepo = new UsersRepository(tx);
      const txDoctorsRepo = new DoctorsRepository(tx);

      const [user] = await txUsersRepo.createUser({
        email: body.email,
        password_hash: passwordHash,
        phone: body.phone,
      }, 'doctor');
      newUser = user;

      const [doctor] = await txDoctorsRepo.createDoctor({
        firstName: body.firstName,
        lastName: body.lastName,
        medicalLicenseNumber: body.medicalLicenseNumber,
        yearsOfExperience: body.yearsOfExperience,
        bio: body.bio || null,
        profilePhotoId: body.profilePhotoId || null,
        fullAddress: body.fullAddress || null,
        city: body.city || null,
        state: body.state || null,
        pincode: body.pincode || null,
        latitude: latitude ? Number(latitude) : undefined,
        longitude: longitude ? Number(longitude) : undefined,
      }, newUser.id);
      newDoctor = doctor;

      const specialtyInserts = body.specialties.map((spec: any, index: number) => ({
        specialtyId: spec.specialtyId,
        isPrimary: spec.isPrimary || (index === 0 && !body.specialties.some((s: any) => s.isPrimary === true)),
        yearsOfExperience: spec.yearsOfExperience || null,
      }));

      insertedSpecialties = await txDoctorsRepo.addSpecialties(specialtyInserts, newDoctor.id);

      if (body.device) {
        await txUsersRepo.createDevice({
          device_token: body.device.device_token || `web-token-${Date.now()}`,
          device_type: body.device.device_type || 'web',
          app_version: body.device.app_version || '1.0.0',
          os_version: body.device.os_version || '1.0.0',
          is_active: body.device.is_active !== false,
        }, newUser.id);
      }
    });

    try {
      const [freePlan] = await db
        .select()
        .from(subscriptionPlans)
        .where(
          and(
            eq(subscriptionPlans.tier, 'free'),
            eq(subscriptionPlans.userRole, 'doctor'),
            eq(subscriptionPlans.isActive, true)
          )
        )
        .limit(1);

      if (freePlan) {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 1);

        const subscriptionsService = new SubscriptionsService();
        await subscriptionsService.create({
          userId: newUser.id,
          planId: freePlan.id,
          status: 'active',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          autoRenew: false,
        });

        console.log(`✅ Auto-created free plan subscription for doctor ${newUser.id}`);
      } else {
        console.warn('⚠️  No free doctor plan found in database. Doctor registered without subscription.');
      }
    } catch (subscriptionError) {
      console.error('Error creating free plan subscription:', subscriptionError);
    }

    return { user: newUser, doctor: newDoctor, specialties: insertedSpecialties };
  }
}
