import { getDb } from '@/lib/db';
import { UsersRepository } from '@/lib/repositories/users.repository';
import { HospitalsRepository } from '@/lib/repositories/hospitals.repository';
import { SubscriptionsService } from '@/lib/services/subscriptions.service';
import { subscriptionPlans } from '@/src/db/drizzle/migrations/schema';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcrypt';

export class HospitalRegistrationService {
  async register(body: any) {
    const db = getDb();

    const usersRepo = new UsersRepository(db);
    const hospitalsRepo = new HospitalsRepository(db);

    const existingUser = await usersRepo.findUserByEmail(body.email);
    if (existingUser.length > 0) {
      throw new Error('User with this email already exists');
    }

    const existingHospital = await hospitalsRepo.findHospitalByRegistrationNumber(body.registrationNumber);
    if (existingHospital.length > 0) {
      throw new Error('Hospital with this registration number already exists');
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const latitude = body.latitude || null;
    const longitude = body.longitude || null;

    let newUser: any;
    let newHospital: any;
    let insertedDepartments: any;

    await db.transaction(async (tx) => {
      const txUsersRepo = new UsersRepository(tx);
      const txHospitalsRepo = new HospitalsRepository(tx);

      const [user] = await txUsersRepo.createUser({
        email: body.email,
        password_hash: passwordHash,
        phone: body.phone,
      }, 'hospital');
      newUser = user;

      if (!newUser) {
        throw new Error('Failed to create user');
      }

      const [hospital] = await txHospitalsRepo.createHospital({
        name: body.name,
        registrationNumber: body.registrationNumber,
        address: body.address,
        city: body.city,
        fullAddress: body.fullAddress || null,
        state: body.state || null,
        pincode: body.pincode || null,
        hospitalType: body.hospitalType || null,
        numberOfBeds: body.numberOfBeds ?? null,
        contactEmail: body.contactEmail || body.email,
        phone: body.contactPhone || body.phone,
        website: body.websiteUrl || null,
        latitude: latitude || undefined,
        longitude: longitude || undefined,
      }, newUser.id);
      newHospital = hospital;

      if (!newHospital) {
        throw new Error('Failed to create hospital profile');
      }

      const departmentInserts = body.departments.map((dept: { specialtyId: string }) => ({
        specialtyId: dept.specialtyId,
      }));

      insertedDepartments = await txHospitalsRepo.addDepartments(departmentInserts, newHospital.id);

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
            eq(subscriptionPlans.userRole, 'hospital'),
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
          userId: newUser!.id,
          planId: freePlan.id,
          status: 'active',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          autoRenew: false,
        });

        console.log(`✅ Auto-created free plan subscription for hospital ${newUser!.id}`);
      } else {
        console.warn('⚠️  No free hospital plan found in database. Hospital registered without subscription.');
      }
    } catch (subscriptionError) {
      console.error('Error creating free plan subscription:', subscriptionError);
    }

    return { user: newUser, hospital: newHospital, departments: insertedDepartments };
  }
}
