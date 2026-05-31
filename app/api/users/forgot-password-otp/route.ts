import { NextRequest, NextResponse } from 'next/server';
import { UsersService } from '@/lib/services/users.service';

/**
 * @swagger
 * /api/users/forgot-password-otp:
 *   post:
 *     summary: Request password reset OTP
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: OTP sent successfully
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
 *                   example: "If an account with that email exists, a password reset code has been sent."
 *                 data:
 *                   type: object
 *                   properties:
 *                     email:
 *                       type: string
 *                     expiresIn:
 *                       type: string
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        {
          success: false,
          message: 'Email is required',
        },
        { status: 400 }
      );
    }

    const usersService = new UsersService();
    const result = await usersService.sendPasswordResetOtp(email);

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error('Error in forgot-password-otp route:', error);
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



