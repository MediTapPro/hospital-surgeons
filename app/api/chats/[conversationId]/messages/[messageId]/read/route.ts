import { NextResponse } from 'next/server';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';
import { ChatService } from '@/lib/services/chat.service';

const chatService = new ChatService();

type Params = { params: Promise<{ conversationId: string; messageId: string }> };

/**
 * @swagger
 * /api/chats/{conversationId}/messages/{messageId}/read:
 *   patch:
 *     summary: Mark a message as read
 *     description: Mark a specific message as read and reset the unread message count for the authenticated user in this conversation.
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the conversation
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the message to mark as read
 *     responses:
 *       200:
 *         description: Message marked as read successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a participant of the conversation
 *       404:
 *         description: Message or conversation not found
 */
export const PATCH = withAuthAndContext<Params>(
  async (req: AuthenticatedRequest, context) => {
    try {
      const { conversationId, messageId } = await context.params;
      const { userId, userRole } = req.user!;

      const message = await chatService.markMessageAsRead(conversationId, messageId, userId, userRole);
      return NextResponse.json({ success: true, data: message });
    } catch (error: any) {
      const status = error.statusCode || 500;
      if (status < 500) return NextResponse.json({ success: false, message: error.message }, { status });
      console.error('PATCH read error:', error);
      return NextResponse.json({ success: false, message: 'Failed to mark message as read' }, { status: 500 });
    }
  },
  ['doctor', 'hospital']
);
