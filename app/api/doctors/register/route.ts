import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { users, doctors, doctorSpecialties, subscriptionPlans } from '@/src/db/drizzle/migrations/schema';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { signToken } from '@/lib/auth/jwt';
import { SubscriptionsService } from '@/lib/services/subscriptions.service';

/**
 * @swagger
 * /api/doctors/register:
 *   post:
 *     summary: Complete doctor registration in a single API call
 *     description: Creates user account, doctor profile, and doctor specialties in one atomic transaction
 *     tags: [Doctors]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - phone
 *               - firstName
 *               - lastName
 *               - medicalLicenseNumber
 *               - yearsOfExperience
 *               - specialties
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: doctor@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: "SecurePassword123!"
 *               phone:
 *                 type: string
 *                 example: "+1234567890"
 *               firstName:
 *                 type: string
 *                 example: "John"
 *               lastName:
 *                 type: string
 *                 example: "Smith"
 *               medicalLicenseNumber:
 *                 type: string
 *                 example: "MD-12345"
 *               yearsOfExperience:
 *                 type: integer
 *                 minimum: 0
 *                 example: 5
 *               bio:
 *                 type: string
 *                 example: "Experienced cardiologist..."
 *               profilePhotoId:
 *                 type: string
 *                 format: uuid
 *                 description: Optional file ID for profile photo
 *               fullAddress:
 *                 type: string
 *                 description: Optional. Full address with building/area name for better geocoding accuracy
 *                 example: "123 Medical Center, Building A, Area"
 *               city:
 *                 type: string
 *                 description: Optional. City name
 *                 example: "Mumbai"
 *               state:
 *                 type: string
 *                 description: Optional. State/province name
 *                 example: "Maharashtra"
 *               pincode:
 *                 type: string
 *                 description: Optional. Postal/ZIP code
 *                 example: "400001"
 *               latitude:
 *                 type: number
 *                 format: float
 *                 description: Optional. Latitude coordinate. If not provided, will be calculated via geocoding from address fields
 *                 example: 19.0760
 *               longitude:
 *                 type: number
 *                 format: float
 *                 description: Optional. Longitude coordinate. If not provided, will be calculated via geocoding from address fields
 *                 example: 72.8777
 *               specialties:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - specialtyId
 *                   properties:
 *                     specialtyId:
 *                       type: string
 *                       format: uuid
 *                     isPrimary:
 *                       type: boolean
 *                       default: false
 *                     yearsOfExperience:
 *                       type: integer
 *                       minimum: 0
 *               device:
 *                 type: object
 *                 properties:
 *                   device_token:
 *                     type: string
 *                   device_type:
 *                     type: string
 *                     enum: [ios, android, web]
 *                   app_version:
 *                     type: string
 *                   os_version:
 *                     type: string
 *                   is_active:
 *                     type: boolean
 *     responses:
 *       201:
 *         description: Doctor registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Doctor registered successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                     doctor:
 *                       type: object
 *                     specialties:
 *                       type: array
 *                     accessToken:
 *                       type: string
 *       400:
 *         description: Bad request - validation error or duplicate email/license
 *       500:
 *         description: Internal server error
 */
export async function POST(req: NextRequest) {
  const db = getDb();
  
  try {
    // Validate request body with Zod
    const { DoctorRegisterDtoSchema } = await import('@/lib/validations/doctor.dto');
    const { validateRequest } = await import('@/lib/utils/validate-request');
    
    const validation = await validateRequest(req, DoctorRegisterDtoSchema);
    if (!validation.success) {
      return validation.response;
    }

    const body = validation.data;

    // Check if user with email already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, body.email))
      .limit(1);

    if (existingUser.length > 0) {
      return NextResponse.json(
        { success: false, message: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Check if doctor with license number already exists
    const existingDoctor = await db
      .select()
      .from(doctors)
      .where(eq(doctors.medicalLicenseNumber, body.medicalLicenseNumber))
      .limit(1);

    if (existingDoctor.length > 0) {
      return NextResponse.json(
        { success: false, message: 'Doctor with this license number already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(body.password, 10);

    // Use latitude/longitude from body if provided, otherwise set to null
    // Frontend is responsible for geocoding - we don't auto-geocode
    const latitude = body.latitude || null;
    const longitude = body.longitude || null;

    const { userDevices } = await import('@/src/db/drizzle/migrations/schema');

    // Steps 1-4 wrapped in a transaction so partial failures roll back cleanly
    let newUser: any;
    let newDoctor: any;
    let insertedSpecialties: any[] = [];

    await db.transaction(async (tx) => {
      // Step 1: Create user
      [newUser] = await tx
        .insert(users)
        .values({
          email: body.email,
          phone: body.phone,
          passwordHash,
          role: 'doctor',
          status: 'pending', // Doctor needs verification
        })
        .returning();

      // Step 2: Create doctor profile
      [newDoctor] = await tx
        .insert(doctors)
        .values({
          userId: newUser.id,
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
          latitude: latitude ? String(latitude) : null,
          longitude: longitude ? String(longitude) : null,
          licenseVerificationStatus: 'pending',
        })
        .returning();

      // Step 3: Create doctor specialties
      const specialtyInserts = body.specialties.map((spec: any, index: number) => ({
        doctorId: newDoctor.id,
        specialtyId: spec.specialtyId,
        isPrimary: spec.isPrimary || (index === 0 && !body.specialties.some((s: any) => s.isPrimary === true)),
        yearsOfExperience: spec.yearsOfExperience || null,
      }));

      insertedSpecialties = await tx
        .insert(doctorSpecialties)
        .values(specialtyInserts)
        .returning();

      // Step 4: Create device record if provided
      if (body.device) {
        await tx.insert(userDevices).values({
          userId: newUser.id,
          deviceType: body.device.device_type || 'web',
          deviceToken: body.device.device_token || `web-token-${Date.now()}`,
          appVersion: body.device.app_version || '1.0.0',
          osVersion: body.device.os_version || '1.0.0',
          isActive: body.device.is_active !== false,
        });
      }
    });

    // Step 5: Auto-create free plan subscription
    try {
      // Find the free doctor plan
      const freePlan = await db
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

      if (freePlan.length > 0) {
        const freePlanId = freePlan[0].id;
        
        // Calculate dates for free plan (1 month subscription, but can be extended)
        const startDate = new Date();
        const endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 10); // Free plan valid for 10 years (effectively forever)

        // Create subscription using SubscriptionsService
        const subscriptionsService = new SubscriptionsService();
        await subscriptionsService.create({
          userId: newUser.id,
          planId: freePlanId,
          status: 'active',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          autoRenew: false, // Free plans don't auto-renew
        });

        console.log(`✅ Auto-created free plan subscription for doctor ${newUser.id}`);
      } else {
        console.warn('⚠️  No free doctor plan found in database. Doctor registered without subscription.');
      }
    } catch (subscriptionError) {
      // Log error but don't fail registration if subscription creation fails
      console.error('Error creating free plan subscription:', subscriptionError);
      // Registration still succeeds even if subscription creation fails
    }

    // Generate JWT token
    const accessToken = signToken(
      { userId: newUser.id, userRole: newUser.role },
      process.env.JWT_ACCESS_TOKEN_SECRET!,
      process.env.JWT_ACCESS_TOKEN_EXPIRATION || '1d'
    );

    // Return success response
    return NextResponse.json(
      {
        success: true,
        message: 'Doctor registered successfully',
        data: {
          user: {
            id: newUser.id,
            email: newUser.email,
            phone: newUser.phone,
            role: newUser.role,
            status: newUser.status,
          },
          doctor: {
            id: newDoctor.id,
            firstName: newDoctor.firstName,
            lastName: newDoctor.lastName,
            medicalLicenseNumber: newDoctor.medicalLicenseNumber,
            yearsOfExperience: newDoctor.yearsOfExperience,
          },
          specialties: insertedSpecialties,
          accessToken,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Doctor registration error:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to register doctor',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

