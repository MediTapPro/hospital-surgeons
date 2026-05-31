import { NextRequest, NextResponse } from 'next/server';
import { HospitalsService } from '@/lib/services/hospitals.service';
import { signToken } from '@/lib/auth/jwt';

/**
 * @swagger
 * /api/users/provider-signup:
 *   post:
 *     summary: Register a new hospital/provider
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - phone
 *               - password
 *               - name
 *               - registrationNumber
 *               - address
 *               - city
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               password:
 *                 type: string
 *               name:
 *                 type: string
 *               registrationNumber:
 *                 type: string
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *     responses:
 *       201:
 *         description: Hospital created successfully
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const hospitalsService = new HospitalsService();
    const result = await hospitalsService.createHospital(body);
    
    // Generate tokens for the response
    if (result.success && result.data && result.data.user) {
      const payload = { userId: result.data.user.id, userRole: result.data.user.role };
      const accessToken = signToken(
        payload,
        process.env.JWT_ACCESS_TOKEN_SECRET!,
        process.env.JWT_ACCESS_TOKEN_EXPIRATION || '1d'
      );
      
      return NextResponse.json({
        ...result,
        data: {
          ...result.data,
          accessToken,
        },
      }, { status: 201 });
    }
    
    return NextResponse.json(result, { status: result.success ? 201 : 400 });
  } catch (error) {
    console.error('Provider signup error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}


