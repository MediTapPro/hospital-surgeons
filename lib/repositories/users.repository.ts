import { getDb } from '@/lib/db';
import { users, userDevices } from '@/src/db/drizzle/migrations/schema';
import { eq, and } from 'drizzle-orm';

export interface CreateUserData {
  email: string;
  password_hash: string;
  phone?: string;
}

export interface CreateDeviceData {
  device_token: string;
  device_type: 'ios' | 'android' | 'web';
  app_version?: string;
  os_version?: string;
  device_name?: string;
  is_active?: boolean;
}

export interface UpdateUserData {
  email?: string;
  phone?: string;
}

export class UsersRepository {
  private db = getDb();

  async createUser(data: CreateUserData, role: 'doctor' | 'hospital' | 'admin' = 'doctor') {
    return await this.db
      .insert(users)
      .values({
        email: data.email,
        passwordHash: data.password_hash,
        phone: data.phone,
        role: role,
      })
      .returning();
  }

  async createDevice(data: CreateDeviceData, userId: string) {
    return await this.db
      .insert(userDevices)
      .values({
        userId: userId,
        deviceToken: data.device_token,
        deviceType: data.device_type,
        appVersion: data.app_version,
        osVersion: data.os_version,
        deviceName: data.device_name,
        lastUsedAt: new Date().toISOString(),
        isActive: data.is_active ?? true,
      })
      .returning();
  }

  async findUserByEmail(email: string) {
    try {
      return await this.db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
    } catch (error) {
      console.error('Error in findUserByEmail:', error);
      throw error;
    }
  }

  async findDeviceByToken(token: string, userId: string) {
    const device = await this.db
      .select()
      .from(userDevices)
      .where(
        and(
          eq(userDevices.deviceToken, token),
          eq(userDevices.userId, userId)
        )
      )
      .limit(1);

    return device[0];
  }

  async findDeviceByTokenAnyUser(token: string) {
    const device = await this.db
      .select()
      .from(userDevices)
      .where(eq(userDevices.deviceToken, token))
      .limit(1);

    return device[0];
  }

  async transferDeviceToUser(deviceId: string, newUserId: string) {
    return await this.db
      .update(userDevices)
      .set({
        userId: newUserId,
        lastUsedAt: new Date().toISOString(),
        isActive: true,
      })
      .where(eq(userDevices.id, deviceId))
      .returning();
  }

  async updateDeviceUsage(
    id: string,
    fields?: { app_version?: string; os_version?: string; device_name?: string }
  ) {
    return await this.db
      .update(userDevices)
      .set({
        lastUsedAt: new Date().toISOString(),
        isActive: true,
        ...(fields?.app_version !== undefined && { appVersion: fields.app_version }),
        ...(fields?.os_version !== undefined && { osVersion: fields.os_version }),
        ...(fields?.device_name !== undefined && { deviceName: fields.device_name }),
      })
      .where(eq(userDevices.id, id))
      .returning();
  }

  async updateUser(id: string, updateData: UpdateUserData) {
    const updateFields: any = {};
    if (updateData.email !== undefined) {
      updateFields.email = updateData.email;
    }
    if (updateData.phone !== undefined) {
      updateFields.phone = updateData.phone;
    }

    return await this.db
      .update(users)
      .set(updateFields)
      .where(eq(users.id, id))
      .returning();
  }

  async updatePassword(id: string, passwordHash: string) {
    return await this.db
      .update(users)
      .set({
        passwordHash: passwordHash,
      })
      .where(eq(users.id, id))
      .returning();
  }

  async getUserById(id: string) {
    const user = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return user[0] || null;
  }

  async deleteUser(id: string) {
    return await this.db
      .delete(users)
      .where(eq(users.id, id))
      .returning();
  }

  async findAll() {
    return await this.db.select().from(users);
  }
}


