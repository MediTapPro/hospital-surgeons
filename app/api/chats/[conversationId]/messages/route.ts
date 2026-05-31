import { NextResponse } from 'next/server';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';
import { ChatService } from '@/lib/services/chat.service';
import { SendMessageDtoSchema } from '@/lib/validations/chat.dto';

const chatService = new ChatService();

/**
 * @swagger
 * /api/chats/{conversationId}/messages:
 *   get:
 *     summary: List messages in conversation
 *     description: Retrieve a paginated list of messages for the specified conversation.
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 *       403:
 *         description: Not a participant
 *       500:
 *         description: Internal server error
 *
 *   post:
 *     summary: Send message
 *     description: Send a new message or attachment in a conversation.
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content: { type: string }
 *               messageType: { type: string, enum: [text, attachment], default: text }
 *               replyToId: { type: string, format: uuid, description: ID of the message being replied to }
 *               attachmentIds: { type: array, items: { type: string, format: uuid }, description: List of file IDs to attach }
 *     responses:
 *       201:
 *         description: Message sent successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Not a participant
 *       500:
 *         description: Internal server error
 */
export const GET = withAuthAndContext<{ params: Promise<{ conversationId: string }> }>(
  async (req: AuthenticatedRequest, context) => {
    try {
      const { conversationId } = await context.params;
      const { userId, userRole } = req.user!;
      const { searchParams } = new URL(req.url);
      const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
      const cursor = searchParams.get('cursor') || undefined;

      const result = await chatService.getMessages(conversationId, userId, userRole, limit, cursor);
      return NextResponse.json({ success: true, data: result });
    } catch (error: any) {
      const status = error.statusCode || 500;
      if (status < 500) return NextResponse.json({ success: false, message: error.message }, { status });
      console.error('GET /api/chats/[conversationId]/messages error:', error);
      return NextResponse.json({ success: false, message: 'Failed to fetch messages' }, { status: 500 });
    }
  },
  ['doctor', 'hospital']
);

/**
 * POST /api/chats/[conversationId]/messages
 * Send a message in a conversation.
 */
export const POST = withAuthAndContext<{ params: Promise<{ conversationId: string }> }>(
  async (req: AuthenticatedRequest, context) => {
    try {
      const { conversationId } = await context.params;
      const { userId, userRole } = req.user!;

      const body = await req.json();
      const parsed = SendMessageDtoSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ success: false, message: parsed.error.issues[0].message }, { status: 400 });
      }

      const message = await chatService.sendMessage(conversationId, userId, userRole, parsed.data);
      return NextResponse.json({ success: true, data: message }, { status: 201 });
    } catch (error: any) {
      const status = error.statusCode || 500;
      if (status < 500) return NextResponse.json({ success: false, message: error.message }, { status });
      console.error('POST /api/chats/[conversationId]/messages error:', error);
      return NextResponse.json({ success: false, message: 'Failed to send message' }, { status: 500 });
    }
  },
  ['doctor', 'hospital']
);
