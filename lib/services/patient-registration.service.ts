import { getDb } from '@/lib/db';
import { UsersRepository } from '@/lib/repositories/users.repository';
import { PatientProfilesRepository } from '@/lib/repositories/patient-profiles.repository';
import { PatientSignupDto } from '@/lib/validations/patient-profile.dto';
import bcrypt from 'bcrypt';

export class PatientRegistrationService {
  async register(body: PatientSignupDto) {
    const db = getDb();
    const usersRepo = new UsersRepository(db);

    // 1. Check if user already exists
    const existingUser = await usersRepo.findUserByEmail(body.email);
    if (existingUser.length > 0) {
      throw new Error('User with this email already exists');
    }

    // 2. Hash password
    const passwordHash = await bcrypt.hash(body.password, 10);

    let createdUser: any;
    let createdProfile: any;

    // 3. Perform atomic registration transaction
    await db.transaction(async (tx) => {
      const txUsersRepo = new UsersRepository(tx);
      const txProfilesRepo = new PatientProfilesRepository(tx);

      // Create primary auth user
      const [user] = await txUsersRepo.createUser({
        email: body.email,
        password_hash: passwordHash,
        phone: body.phone,
      }, 'patient');
      createdUser = user;

      // Create patient profile details
      const [profile] = await txProfilesRepo.createProfile({
        fullName: body.fullName,
      }, createdUser.id);
      createdProfile = profile;

      // Create device registration if metadata provided
      if (body.device) {
        await txUsersRepo.createDevice({
          device_token: body.device.device_token,
          device_type: body.device.device_type,
          app_version: body.device.app_version,
          os_version: body.device.os_version,
          device_name: body.device.device_name,
          is_active: body.device.is_active !== false,
        }, createdUser.id);
      }
    });

    return {
      user: {
        id: createdUser.id,
        email: createdUser.email,
        phone: createdUser.phone,
        role: createdUser.role,
        createdAt: createdUser.createdAt,
      },
      profile: createdProfile,
    };
  }
}
