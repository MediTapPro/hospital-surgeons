import { NextRequest, NextResponse } from 'next/server';
import { UsersService } from '@/lib/services/users.service';
import { LoginDtoSchema } from '@/lib/validations/auth.dto';
import { validateRequest } from '@/lib/utils/validate-request';

/**
 * @swagger
 * /api/users/login:
 *   post:
 *     summary: User login
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: doctor@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "SecurePassword123!"
 *               accountType:
 *                 type: string
 *                 enum: [doctor, hospital, admin]
 *                 description: Optional. Expected account type for validation. If provided, must match user's actual role.
 *                 example: doctor
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *                     user:
 *                       type: object
 *       401:
 *         description: Invalid credentials
 */
export async function POST(req: NextRequest) {
  try {
    // Validate request body with Zod
    const validation = await validateRequest(req, LoginDtoSchema);
    if (!validation.success) {
      return validation.response;
    }

    const usersService = new UsersService();
    const result = await usersService.login(validation.data);
    
    // Return 403 Forbidden if role mismatch (more specific than 401)
    const statusCode = result.success ? 200 : (result.message?.includes('registered as') ? 403 : 401);
    
    return NextResponse.json(result, { status: statusCode });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}
