import { getDb } from '@/lib/db';
import { otps } from '@/src/db/drizzle/migrations/schema';
import { eq, and, gt, desc } from 'drizzle-orm';

export interface CreateOtpData {
  userId: string;
  email: string;
  otpCode: string;
  otpType: 'email_verification' | 'password_reset';
  expiresAt: string; // ISO timestamp string
}

export class OtpRepository {
  private db = getDb();

  /**
   * Create a new OTP record
   */
  async createOtp(data: CreateOtpData) {
    return await this.db
      .insert(otps)
      .values({
        userId: data.userId,
        email: data.email,
        otpCode: data.otpCode,
        otpType: data.otpType,
        expiresAt: data.expiresAt,
        isUsed: false,
      })
      .returning();
  }

  /**
   * Find a valid (non-expired, unused) OTP by email and code
   */
  async findValidOtp(email: string, otpCode: string) {
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedOtpCode = otpCode.trim();

    const result = await this.db
      .select()
      .from(otps)
      .where(
        and(
          eq(otps.email, normalizedEmail),
          eq(otps.otpCode, normalizedOtpCode),
          eq(otps.isUsed, false),
          gt(otps.expiresAt, new Date().toISOString())
        )
      )
      .orderBy(desc(otps.createdAt))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Invalidate all unused OTPs for a user of a specific type
   */
  async invalidateUserOtps(userId: string, otpType: 'email_verification' | 'password_reset') {
    return await this.db
      .update(otps)
      .set({
        isUsed: true,
      })
      .where(
        and(
          eq(otps.userId, userId),
          eq(otps.otpType, otpType),
          eq(otps.isUsed, false)
        )
      )
      .returning();
  }

  /**
   * Mark an OTP as used
   */
  async markOtpAsUsed(otpId: string) {
    return await this.db
      .update(otps)
      .set({
        isUsed: true,
        verifiedAt: new Date().toISOString(),
      })
      .where(eq(otps.id, otpId))
      .returning();
  }

  /**
   * Find OTP by ID (for validation purposes)
   */
  async findOtpById(id: string) {
    const result = await this.db
      .select()
      .from(otps)
      .where(eq(otps.id, id))
      .limit(1);

    return result[0] || null;
  }
}

