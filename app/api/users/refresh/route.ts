import { NextRequest, NextResponse } from 'next/server';
import { UsersService } from '@/lib/services/users.service';

/**
 * @swagger
 * /api/users/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid refresh token
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const usersService = new UsersService();
    const result = await usersService.refreshToken(body.refreshToken);
    
    return NextResponse.json(result, { status: result.success ? 200 : 401 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}
