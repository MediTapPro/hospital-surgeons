import { NextRequest, NextResponse } from 'next/server';
import { UsersService } from '@/lib/services/users.service';

/**
 * @swagger
 * /api/users/reset-password:
 *   post:
 *     summary: Reset password using reset token
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *             properties:
 *               token:
 *                 type: string
 *                 description: Password reset token received via email
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *               password:
 *                 type: string
 *                 format: password
 *                 description: New password (minimum 8 characters)
 *                 example: "NewSecurePassword123!"
 *     responses:
 *       200:
 *         description: Password reset successfully
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
 *                   example: "Password has been reset successfully"
 *       400:
 *         description: Bad request (invalid token, expired token, or weak password)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Password reset link has expired. Please request a new one."
 *       500:
 *         description: Internal server error
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, password } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        {
          success: false,
          message: 'Reset token is required',
        },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        {
          success: false,
          message: 'Password is required',
        },
        { status: 400 }
      );
    }

    const usersService = new UsersService();
    const result = await usersService.resetPassword(token, password);

    // Return 400 for token errors, 500 for server errors, 200 for success
    const statusCode = result.success ? 200 : 
                      (result.message?.includes('expired') || 
                       result.message?.includes('Invalid') || 
                       result.message?.includes('must be at least')) ? 400 : 500;

    return NextResponse.json(result, { status: statusCode });
  } catch (error) {
    console.error('Error in reset-password route:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}



