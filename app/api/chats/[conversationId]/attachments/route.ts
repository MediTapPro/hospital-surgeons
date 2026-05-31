import { NextResponse } from 'next/server';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';
import { ChatService } from '@/lib/services/chat.service';
import { ChatRepository } from '@/lib/repositories/chat.repository';

const chatService = new ChatService();
const chatRepo = new ChatRepository();

type Params = { params: Promise<{ conversationId: string }> };

/**
 * @swagger
 * /api/chats/{conversationId}/attachments:
 *   get:
 *     summary: List conversation attachments
 *     description: Retrieve all file attachments shared in the specified conversation (media gallery).
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
 *     responses:
 *       200:
 *         description: List of attachments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a participant of the conversation
 *       404:
 *         description: Conversation not found
 */
export const GET = withAuthAndContext<Params>(
  async (req: AuthenticatedRequest, context) => {
    try {
      const { conversationId } = await context.params;
      const { userId, userRole } = req.user!;

      await chatService.getConversationById(conversationId, userId, userRole);

      const attachments = await chatRepo.getAttachmentsForConversation(conversationId);
      return NextResponse.json({ success: true, data: attachments });
    } catch (error: any) {
      const status = error.statusCode || 500;
      if (status < 500) return NextResponse.json({ success: false, message: error.message }, { status });
      console.error('GET /api/chats/[conversationId]/attachments error:', error);
      return NextResponse.json({ success: false, message: 'Failed to fetch attachments' }, { status: 500 });
    }
  },
  ['doctor', 'hospital']
);
