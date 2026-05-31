import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { ChatService } from '@/lib/services/chat.service';

const chatService = new ChatService();

/**
 * @swagger
 * /api/chats/unread-count:
 *   get:
 *     summary: Get total unread message count
 *     description: Retrieve the aggregate count of unread messages for the authenticated user across all active conversations.
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: integer, example: 5 }
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { userId, userRole } = req.user!;
    const count = await chatService.getTotalUnreadCount(userId, userRole);
    return NextResponse.json({ success: true, data: count });
  } catch (error: any) {
    console.error('GET /api/chats/unread-count error:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch unread count' }, { status: 500 });
  }
}, ['doctor', 'hospital']);
