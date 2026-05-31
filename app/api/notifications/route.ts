import { NextRequest, NextResponse } from 'next/server';
import { NotificationsService } from '@/lib/services/notifications.service';
import { withAuth } from '@/lib/auth/middleware';

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Get user notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *       - in: query
 *         name: channel
 *         schema:
 *           type: string
 *           enum: [push, email, sms, in_app]
 *       - in: query
 *         name: isRead
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: List of notifications
 *   post:
 *     summary: Create a new notification (Admin only)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - notificationType
 *               - title
 *               - message
 *               - channel
 *             properties:
 *               userId:
 *                 type: string
 *               notificationType:
 *                 type: string
 *                 enum: [booking, payment, reminder, system, review]
 *               title:
 *                 type: string
 *               message:
 *                 type: string
 *               channel:
 *                 type: string
 *                 enum: [push, email, sms, in_app]
 *               relatedId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Notification created successfully
 */
async function getHandler(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const user = (req as any).user;
    const query = {
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10,
      userId: user?.userId || searchParams.get('userId') || undefined,
      channel: searchParams.get('channel') || undefined,
      isRead: searchParams.get('isRead') === 'true' ? true : searchParams.get('isRead') === 'false' ? false : undefined,
    };

    const notificationsService = new NotificationsService();
    const result = await notificationsService.list(query);
    
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

async function postHandler(req: NextRequest) {
  try {
    const body = await req.json();
    const notificationsService = new NotificationsService();
    const result = await notificationsService.create(body);
    
    return NextResponse.json(result, { status: result.success ? 201 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler, ['admin']);
