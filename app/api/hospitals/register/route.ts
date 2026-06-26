import { NextRequest, NextResponse } from 'next/server';
import { signToken } from '@/lib/auth/jwt';
import { HospitalRegistrationService } from '@/lib/services/hospital-registration.service';

/**
 * @swagger
 * /api/hospitals/register:
 *   post:
 *     summary: Complete hospital registration in a single API call
 *     description: Creates user account, hospital profile, and hospital departments in one atomic transaction
 *     tags: [Hospitals]
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
 *               - name
 *               - registrationNumber
 *               - address
 *               - city
 *               - departments
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: hospital@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: "SecurePassword123!"
 *               phone:
 *                 type: string
 *                 example: "+1234567890"
 *               name:
 *                 type: string
 *                 example: "City General Hospital"
 *               registrationNumber:
 *                 type: string
 *                 example: "HOSP-12345"
 *               address:
 *                 type: string
 *                 example: "123 Main Street"
 *               city:
 *                 type: string
 *                 example: "New York"
 *               fullAddress:
 *                 type: string
 *                 description: Optional. Full address with building/area name for better geocoding accuracy
 *                 example: "123 Main Street, Building Name, Area"
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
 *               hospitalType:
 *                 type: string
 *                 enum: [general, specialty, clinic, trauma_center, teaching, other]
 *               numberOfBeds:
 *                 type: integer
 *                 minimum: 0
 *                 example: 100
 *               contactEmail:
 *                 type: string
 *                 format: email
 *               contactPhone:
 *                 type: string
 *               websiteUrl:
 *                 type: string
 *               departments:
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
 *         description: Hospital registered successfully
 *       400:
 *         description: Bad request - validation error or duplicate email/registration number
 *       500:
 *         description: Internal server error
 */
export async function POST(req: NextRequest) {
  try {
    const { HospitalRegisterDtoSchema } = await import('@/lib/validations/hospital.dto');
    const { validateRequest } = await import('@/lib/utils/validate-request');

    const validation = await validateRequest(req, HospitalRegisterDtoSchema);
    if (!validation.success) {
      return validation.response;
    }

    const body = validation.data;

    const service = new HospitalRegistrationService();
    const { user, hospital, departments } = await service.register(body);

    const accessToken = signToken(
      { userId: user.id, userRole: user.role },
      process.env.JWT_ACCESS_TOKEN_SECRET!,
      process.env.JWT_ACCESS_TOKEN_EXPIRATION || '1d'
    );

    return NextResponse.json(
      {
        success: true,
        message: 'Hospital registered successfully and awaiting verification',
        data: {
          user: {
            id: user.id,
            email: user.email,
            phone: user.phone,
            role: user.role,
            status: user.status,
          },
          hospital: {
            id: hospital.id,
            name: hospital.name,
            registrationNumber: hospital.registrationNumber,
            city: hospital.city,
          },
          departments,
          accessToken,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Hospital registration error:', error);

    if (error.message === 'User with this email already exists') {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 409 }
      );
    }

    if (error.message === 'Hospital with this registration number already exists') {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: 'Failed to register hospital',
        error: error instanceof Error ? error.message : String(error),
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 }
    );
  }
}
