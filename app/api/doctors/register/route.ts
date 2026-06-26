import { NextRequest, NextResponse } from 'next/server';
import { signToken } from '@/lib/auth/jwt';
import { DoctorRegistrationService } from '@/lib/services/doctor-registration.service';

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
  try {
    const { DoctorRegisterDtoSchema } = await import('@/lib/validations/doctor.dto');
    const { validateRequest } = await import('@/lib/utils/validate-request');

    const validation = await validateRequest(req, DoctorRegisterDtoSchema);
    if (!validation.success) {
      return validation.response;
    }

    const body = validation.data;

    const service = new DoctorRegistrationService();
    const { user, doctor, specialties } = await service.register(body);

    const accessToken = signToken(
      { userId: user.id, userRole: user.role },
      process.env.JWT_ACCESS_TOKEN_SECRET!,
      process.env.JWT_ACCESS_TOKEN_EXPIRATION || '1d'
    );

    return NextResponse.json(
      {
        success: true,
        message: 'Doctor registered successfully',
        data: {
          user: {
            id: user.id,
            email: user.email,
            phone: user.phone,
            role: user.role,
            status: user.status,
          },
          doctor: {
            id: doctor.id,
            firstName: doctor.firstName,
            lastName: doctor.lastName,
            medicalLicenseNumber: doctor.medicalLicenseNumber,
            yearsOfExperience: doctor.yearsOfExperience,
          },
          specialties,
          accessToken,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Doctor registration error:', error);

    if (error.message === 'User with this email already exists' || error.message === 'Doctor with this license number already exists') {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }

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
