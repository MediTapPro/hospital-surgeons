import { NextRequest, NextResponse } from 'next/server';
import { UsersService } from '@/lib/services/users.service';

/**
 * @swagger
 * /api/users/verify-reset-token:
 *   get:
 *     summary: Verify reset token and send OTP
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Password reset token from email link
 *     responses:
 *       200:
 *         description: Token verified and OTP sent successfully
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
 *                   example: "OTP sent to your email"
 *                 data:
 *                   type: object
 *                   properties:
 *                     email:
 *                       type: string
 *                     expiresIn:
 *                       type: string
 *       400:
 *         description: Invalid or expired token
 *       500:
 *         description: Internal server error
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const token = searchParams.get('token');

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        {
          success: false,
          message: 'Reset token is required',
        },
        { status: 400 }
      );
    }

    const usersService = new UsersService();
    const result = await usersService.verifyTokenAndSendOtp(token);

    const statusCode = result.success ? 200 : 400;

    return NextResponse.json(result, { status: statusCode });
  } catch (error) {
    console.error('Error in verify-reset-token route:', error);
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



