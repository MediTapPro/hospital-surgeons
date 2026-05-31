import { NextRequest, NextResponse } from 'next/server';
import { UsersService } from '@/lib/services/users.service';

/**
 * @swagger
 * /api/users/forgot-password:
 *   post:
 *     summary: Request password reset
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
 *         description: Password reset link sent successfully (email exists)
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
 *                   example: "If an account with that email exists, a password reset link has been sent."
 *                 data:
 *                   type: object
 *                   properties:
 *                     email:
 *                       type: string
 *                     emailExists:
 *                       type: boolean
 *                       example: true
 *                     expiresIn:
 *                       type: string
 *                       description: Token expiration time
 *       400:
 *         description: Bad request - Email does not exist or invalid input
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
 *                   example: "Email does not exist in our system. Please check your email address or sign up for a new account."
 *                 data:
 *                   type: object
 *                   properties:
 *                     email:
 *                       type: string
 *                     emailExists:
 *                       type: boolean
 *                       example: false
 *       500:
 *         description: Internal server error
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    console.log('📧 [FORGOT-PASSWORD API] Received request for email:', email);

    if (!email || typeof email !== 'string') {
      console.log('❌ [FORGOT-PASSWORD API] Email validation failed');
      return NextResponse.json(
        {
          success: false,
          message: 'Email is required',
        },
        { status: 400 }
      );
    }

    const usersService = new UsersService();
    console.log('📧 [FORGOT-PASSWORD API] Calling usersService.forgotPassword...');
    const result = await usersService.forgotPassword(email);

    console.log('📧 [FORGOT-PASSWORD API] Result:', {
      success: result.success,
      message: result.message,
      hasData: !!result.data,
    });

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error('❌ [FORGOT-PASSWORD API] Error:', error);
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

