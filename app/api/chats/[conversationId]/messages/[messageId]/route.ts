import { NextResponse } from 'next/server';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';
import { ChatService } from '@/lib/services/chat.service';
import { EditMessageDtoSchema } from '@/lib/validations/chat.dto';

const chatService = new ChatService();

type Params = { params: Promise<{ conversationId: string; messageId: string }> };

/**
 * @swagger
 * /api/chats/{conversationId}/messages/{messageId}:
 *   patch:
 *     summary: Edit a message
 *     description: Modify the content of an existing message. Only the sender can edit their own messages. Cannot edit deleted messages.
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
 *         description: The ID of the message to edit
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 example: "Updated message content"
 *     responses:
 *       200:
 *         description: Message updated successfully
 *       400:
 *         description: Validation error or cannot edit deleted message
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not the sender of the message
 *       404:
 *         description: Message or conversation not found
 */
export const PATCH = withAuthAndContext<Params>(
  async (req: AuthenticatedRequest, context) => {
    try {
      const { conversationId, messageId } = await context.params;
      const { userId, userRole } = req.user!;

      const body = await req.json();
      const parsed = EditMessageDtoSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ success: false, message: parsed.error.issues[0].message }, { status: 400 });
      }

      const message = await chatService.editMessage(conversationId, messageId, parsed.data.content, userId, userRole);
      return NextResponse.json({ success: true, data: message });
    } catch (error: any) {
      const status = error.statusCode || 500;
      if (status < 500) return NextResponse.json({ success: false, message: error.message }, { status });
      console.error('PATCH /api/chats/[conversationId]/messages/[messageId] error:', error);
      return NextResponse.json({ success: false, message: 'Failed to edit message' }, { status: 500 });
    }
  },
  ['doctor', 'hospital']
);

/**
 * @swagger
 * /api/chats/{conversationId}/messages/{messageId}:
 *   delete:
 *     summary: Delete a message
 *     description: Soft-delete a message by marking it as deleted and clearing its content. Only the sender can delete their own messages.
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
 *         description: The ID of the message to delete
 *     responses:
 *       200:
 *         description: Message deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not the sender of the message
 *       404:
 *         description: Message or conversation not found
 */
export const DELETE = withAuthAndContext<Params>(
  async (req: AuthenticatedRequest, context) => {
    try {
      const { conversationId, messageId } = await context.params;
      const { userId, userRole } = req.user!;

      await chatService.deleteMessage(conversationId, messageId, userId, userRole);
      return NextResponse.json({ success: true, message: 'Message deleted' });
    } catch (error: any) {
      const status = error.statusCode || 500;
      if (status < 500) return NextResponse.json({ success: false, message: error.message }, { status });
      console.error('DELETE /api/chats/[conversationId]/messages/[messageId] error:', error);
      return NextResponse.json({ success: false, message: 'Failed to delete message' }, { status: 500 });
    }
  },
  ['doctor', 'hospital']
);
