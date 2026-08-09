import { NextRequest, NextResponse } from 'next/server';
import { PatientRegistrationService } from '@/lib/services/patient-registration.service';
import { PatientSignupDtoSchema } from '@/lib/validations/patient-profile.dto';
import { validateRequest } from '@/lib/utils/validate-request';
import { signToken } from '@/lib/auth/jwt';

/**
 * @swagger
 * /api/patients/signup:
 *   post:
 *     summary: Register a new patient
 *     tags: [Patients]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - fullName
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: patient@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "SecurePassword123!"
 *               fullName:
 *                 type: string
 *                 example: "John Doe"
 *               phone:
 *                 type: string
 *                 example: "9876543210"
 *               device:
 *                 type: object
 *                 properties:
 *                   device_token:
 *                     type: string
 *                   device_type:
 *                     type: string
 *                     enum: [ios, android, web]
 *     responses:
 *       201:
 *         description: Patient registered successfully
 *       400:
 *         description: Bad request / validation failure
 *       500:
 *         description: Internal server error
 */
export async function POST(req: NextRequest) {
  try {
    const validation = await validateRequest(req, PatientSignupDtoSchema);
    if (!validation.success) {
      return validation.response;
    }

    const registrationService = new PatientRegistrationService();
    const result = await registrationService.register(validation.data);

    // Generate JWT access and refresh tokens for the signed up patient
    const payload = { userId: result.user.id, userRole: result.user.role };
    const accessToken = signToken(
      payload,
      process.env.JWT_ACCESS_TOKEN_SECRET!,
      process.env.JWT_ACCESS_TOKEN_EXPIRATION || '1d'
    );
    const refreshToken = signToken(
      payload,
      process.env.JWT_REFRESH_TOKEN_SECRET!,
      process.env.JWT_REFRESH_TOKEN_EXPIRATION || '7d'
    );

    return NextResponse.json({
      success: true,
      message: 'Patient registered successfully',
      data: {
        accessToken,
        refreshToken,
        user: result.user,
        profile: result.profile,
      },
    }, { status: 201 });

  } catch (error) {
    console.error('Patient signup error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Return 400 Bad Request if it's a validation/business rule issue (e.g. duplicate email)
    if (errorMessage.includes('already exists') || errorMessage.includes('required')) {
      return NextResponse.json({
        success: false,
        message: errorMessage,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      message: 'Internal server error',
      error: errorMessage,
    }, { status: 500 });
  }
}
