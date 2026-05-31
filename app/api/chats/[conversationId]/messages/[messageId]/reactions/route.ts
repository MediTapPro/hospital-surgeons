import { NextResponse } from 'next/server';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';
import { ChatService } from '@/lib/services/chat.service';
import { AddReactionDtoSchema } from '@/lib/validations/chat.dto';

const chatService = new ChatService();

type Params = { params: Promise<{ conversationId: string; messageId: string }> };

/**
 * @swagger
 * /api/chats/{conversationId}/messages/{messageId}/reactions:
 *   post:
 *     summary: Toggle a message reaction
 *     description: Add, replace, or remove an emoji reaction on a specific message.
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
 *         description: The ID of the message to react to
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - emoji
 *             properties:
 *               emoji:
 *                 type: string
 *                 example: "❤️"
 *                 description: The emoji character to use for reaction
 *     responses:
 *       200:
 *         description: Reaction toggled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     messageId:
 *                       type: string
 *                     reactions:
 *                       type: array
 *                       items:
 *                         type: object
 *       400:
 *         description: Invalid request or validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Message or conversation not found
 */
export const POST = withAuthAndContext<Params>(
  async (req: AuthenticatedRequest, context) => {
    try {
      const { conversationId, messageId } = await context.params;
      const { userId, userRole } = req.user!;

      const body = await req.json();
      const parsed = AddReactionDtoSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ success: false, message: parsed.error.issues[0].message }, { status: 400 });
      }

      const reactions = await chatService.toggleReaction(conversationId, messageId, userId, userRole, parsed.data);
      return NextResponse.json({ success: true, data: { messageId, reactions } });
    } catch (error: any) {
      const status = error.statusCode || 500;
      if (status < 500) return NextResponse.json({ success: false, message: error.message }, { status });
      console.error('POST reactions error:', error);
      return NextResponse.json({ success: false, message: 'Failed to toggle reaction' }, { status: 500 });
    }
  },
  ['doctor', 'hospital']
);
