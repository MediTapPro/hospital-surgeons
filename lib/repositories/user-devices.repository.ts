import { getDb } from '@/lib/db';
import { userDevices } from '@/src/db/drizzle/migrations/schema';
import { eq, and, ne } from 'drizzle-orm';

/**
 * User Devices Repository
 * Handles device token operations for push notifications
 */
export class UserDevicesRepository {
  private db = getDb();

  /**
   * Get all active device tokens for a user
   */
  async getActiveDeviceTokens(userId: string): Promise<string[]> {
    try {
      const devices = await this.db
        .select({
          deviceToken: userDevices.deviceToken,
        })
        .from(userDevices)
        .where(
          and(
            eq(userDevices.userId, userId),
            eq(userDevices.isActive, true),
            ne(userDevices.deviceType, 'web')
          )
        );
        console.log(devices,"devices")

      return devices.map((device) => device.deviceToken);
    } catch (error) {
      console.error('Error fetching active device tokens:', error);
      return [];
    }
  }

  /**
   * Update last used timestamp for device tokens
   */
  async updateTokenLastUsed(deviceTokens: string[]): Promise<void> {
    if (deviceTokens.length === 0) return;

    try {
      await this.db
        .update(userDevices)
        .set({
          lastUsedAt: new Date().toISOString(),
        })
        .where(
          eq(userDevices.deviceToken, deviceTokens[0]) // Update first token
        );

      // Update remaining tokens if any
      for (let i = 1; i < deviceTokens.length; i++) {
        await this.db
          .update(userDevices)
          .set({
            lastUsedAt: new Date().toISOString(),
          })
          .where(eq(userDevices.deviceToken, deviceTokens[i]));
      }
    } catch (error) {
      console.error('Error updating token last used:', error);
    }
  }

  /**
   * Deactivate a device token (mark as inactive)
   */
  async deactivateToken(deviceToken: string): Promise<void> {
    try {
      await this.db
        .update(userDevices)
        .set({
          isActive: false,
        })
        .where(eq(userDevices.deviceToken, deviceToken));
    } catch (error) {
      console.error('Error deactivating token:', error);
    }
  }

  /**
   * Deactivate multiple device tokens (mark as inactive)
   */
  async deactivateTokens(deviceTokens: string[]): Promise<void> {
    if (deviceTokens.length === 0) return;

    try {
      for (const token of deviceTokens) {
        await this.deactivateToken(token);
      }
    } catch (error) {
      console.error('Error deactivating tokens:', error);
    }
  }
}

