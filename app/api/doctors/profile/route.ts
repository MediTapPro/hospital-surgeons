import { NextRequest, NextResponse } from 'next/server';
import { DoctorsService } from '@/lib/services/doctors.service';
import { withAuth } from '@/lib/auth/middleware';
import { getDb } from '@/lib/db';
import { files } from '@/src/db/drizzle/migrations/schema';
import { eq } from 'drizzle-orm';

/**
 * @swagger
 * /api/doctors/profile:
 *   get:
 *     summary: Get current doctor profile with subscription plan details
 *     tags: [Doctors]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Doctor profile retrieved successfully with current plan details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   description: Doctor profile data
 *                 currentPlan:
 *                   type: object
 *                   nullable: true
 *                   description: Current active subscription plan details
 *                   properties:
 *                     subscription:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         status:
 *                           type: string
 *                         startDate:
 *                           type: string
 *                         endDate:
 *                           type: string
 *                         autoRenew:
 *                           type: boolean
 *                         billingCycle:
 *                           type: string
 *                     plan:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         tier:
 *                           type: string
 *                         description:
 *                           type: string
 *                         doctorFeatures:
 *                           type: object
 *                           nullable: true
 *                     pricing:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         id:
 *                           type: string
 *                         billingCycle:
 *                           type: string
 *                         billingPeriodMonths:
 *                           type: number
 *                         price:
 *                           type: number
 *                         currency:
 *                           type: string
 *                         setupFee:
 *                           type: number
 *                         discountPercentage:
 *                           type: number
 *       404:
 *         description: Doctor profile not found
 *   post:
 *     summary: Create doctor profile for authenticated user
 *     tags: [Doctors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - medicalLicenseNumber
 *             properties:
 *               medicalLicenseNumber:
 *                 type: string
 *               yearsOfExperience:
 *                 type: number
 *               bio:
 *                 type: string
 *               profilePhotoId:
 *                 type: string
 *                 format: uuid
 *               primaryLocation:
 *                 type: string
 *                 description: Free-text primary location / city for the doctor
 *     responses:
 *       201:
 *         description: Doctor profile created successfully
 *       400:
 *         description: Bad request or profile already exists
 */
async function getHandler(req: NextRequest) {
  try {
    const user = (req as any).user;
    const doctorsService = new DoctorsService();
    const result = await doctorsService.findDoctorByUserId(user.userId);

    let profileUrl: string | null = null;
    if (result.success && (result as any).data?.profilePhotoId) {
      const db = getDb();
      const fileId = (result as any).data.profilePhotoId as string;
      const fileResult = await db
        .select({ url: files.url, cdnUrl: files.cdnUrl })
        .from(files)
        .where(eq(files.id, fileId))
        .limit(1);
      profileUrl = (fileResult[0]?.cdnUrl || fileResult[0]?.url || null) as string | null;
    }
    
    // Get current subscription/plan details
    const { SubscriptionsService } = await import('@/lib/services/subscriptions.service');
    const subscriptionsService = new SubscriptionsService();
    const subscriptionResult = await subscriptionsService.getActiveSubscriptionByUserId(user.userId);
    
    // Combine profile with subscription data
    const response = {
      ...result,
      data: (result as any).data
        ? {
            ...(result as any).data,
            profile_url: profileUrl,
          }
        : (result as any).data,
      currentPlan: subscriptionResult.success && subscriptionResult.data ? {
        subscription: {
          id: subscriptionResult.data.subscription.id,
          status: subscriptionResult.data.subscription.status,
          startDate: subscriptionResult.data.subscription.startDate,
          endDate: subscriptionResult.data.subscription.endDate,
          autoRenew: subscriptionResult.data.subscription.autoRenew,
          billingCycle: subscriptionResult.data.subscription.billingCycle,
        },
        plan: {
          id: subscriptionResult.data.plan.id,
          name: subscriptionResult.data.plan.name,
          tier: subscriptionResult.data.plan.tier,
          description: subscriptionResult.data.plan.description,
          doctorFeatures: subscriptionResult.data.plan.doctorFeatures,
        },
        pricing: subscriptionResult.data.pricing,
      } : null,
    };
    
    return NextResponse.json(response, { status: result.success ? 200 : 404 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

async function postHandler(req: NextRequest) {
  try {
    const user = (req as any).user;
    
    // Validate request body with Zod
    const { CreateDoctorProfileDtoSchema } = await import('@/lib/validations/doctor-profile.dto');
    const { validateRequest } = await import('@/lib/utils/validate-request');
    
    const validation = await validateRequest(req, CreateDoctorProfileDtoSchema);
    if (!validation.success) {
      return validation.response;
    }
    
    const doctorsService = new DoctorsService();
    
    const result = await doctorsService.createDoctorProfile(user.userId, validation.data);
    
    return NextResponse.json(result, { status: result.success ? 201 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);


