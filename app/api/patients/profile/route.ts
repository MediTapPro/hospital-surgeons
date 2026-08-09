import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { PatientProfilesService } from '@/lib/services/patient-profiles.service';
import { PatientProfileUpdateDtoSchema } from '@/lib/validations/patient-profile.dto';


/**
 * @swagger
 * /api/patients/profile:
 *   get:
 *     summary: Get logged-in patient's profile details
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *       401:
 *         description: Unauthorized
 */
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const userId = req.user!.userId;
    const service = new PatientProfilesService();
    const profile = await service.getProfile(userId);

    return NextResponse.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error('Error fetching patient profile:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      success: false,
      message: errorMessage,
    }, { status: 400 });
  }
}, ['patient']);

/**
 * @swagger
 * /api/patients/profile:
 *   put:
 *     summary: Update logged-in patient's profile details
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: "Jane Doe"
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Invalid parameters
 *       401:
 *         description: Unauthorized
 */
export const PUT = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const userId = req.user!.userId;
    const body = await req.json();
    
    const validation = PatientProfileUpdateDtoSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        message: validation.error.issues[0].message,
      }, { status: 400 });
    }

    const service = new PatientProfilesService();
    const updatedProfile = await service.updateProfile(userId, validation.data.fullName);

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedProfile,
    });
  } catch (error) {
    console.error('Error updating patient profile:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      success: false,
      message: errorMessage,
    }, { status: 400 });
  }
}, ['patient']);
