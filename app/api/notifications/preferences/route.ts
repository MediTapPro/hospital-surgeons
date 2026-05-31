import { NextRequest, NextResponse } from 'next/server';
import { NotificationsService } from '@/lib/services/notifications.service';
import { withAuth } from '@/lib/auth/middleware';

/**
 * @swagger
 * /api/notifications/preferences:
 *   get:
 *     summary: Get notification preferences for authenticated user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notification preferences retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *   patch:
 *     summary: Update notification preferences for authenticated user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: boolean
 *               push:
 *                 type: boolean
 *               sms:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Preferences updated successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
async function getHandler(req: NextRequest) {
  try {
    const user = (req as any).user;
    const notificationsService = new NotificationsService();
    const result = await notificationsService.getPreferences(user.userId);
    
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

async function patchHandler(req: NextRequest) {
  try {
    const user = (req as any).user;
    const body = await req.json();
    const notificationsService = new NotificationsService();
    const result = await notificationsService.upsertPreferences(user.userId, body);
    
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);
export const PATCH = withAuth(patchHandler);



































