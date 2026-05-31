import { NextResponse } from 'next/server';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';
import { ChatService } from '@/lib/services/chat.service';
import { UpdateMessagesStatusDtoSchema } from '@/lib/validations/chat.dto';

const chatService = new ChatService();

/**
 * @swagger
 * /api/chats/{conversationId}/messages/bulk-status:
 *   patch:
 *     summary: Update multiple messages status
 *     description: "Update the status (1: sent, 2: delivered, 3: read) for multiple messages in a conversation."
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [messageIds, status]
 *             properties:
 *                messageIds: { type: array, items: { type: string, format: uuid } }
 *                status: { type: integer, enum: [1, 2, 3] }
 *     responses:
 *       200:
 *         description: Messages status updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Conversation not found
 *       500:
 *         description: Internal server error
 */
export const PATCH = withAuthAndContext(async (req: AuthenticatedRequest, context: { params: Promise<{ conversationId: string }> }) => {
  try {
    const body = await req.json();
    const parsed = UpdateMessagesStatusDtoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: parsed.error.issues[0].message }, { status: 400 });
    }

    const { conversationId } = await context.params;
    const { userId, userRole } = req.user!;

    const result = await chatService.updateMessagesStatus(
      conversationId,
      parsed.data.messageIds,
      parsed.data.status,
      userId,
      userRole
    );

    return NextResponse.json({ success: true, count: result.length, data: result });
  } catch (error: any) {
    const status = error.statusCode || 500;
    if (status < 500) return NextResponse.json({ success: false, message: error.message }, { status });
    console.error('PATCH bulk message status error:', error);
    return NextResponse.json({ success: false, message: 'Failed to update messages status' }, { status: 500 });
  }
}, ['doctor', 'hospital']);
