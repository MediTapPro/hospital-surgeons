import { NextRequest, NextResponse } from 'next/server';
import { SupportService } from '@/lib/services/support.service';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';

/**
 * @swagger
 * /api/support/tickets/{id}:
 *   get:
 *     summary: Get a specific support ticket by ID
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Ticket ID
 *     responses:
 *       200:
 *         description: Ticket retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       404:
 *         description: Ticket not found
 *       401:
 *         description: Unauthorized
 *   patch:
 *     summary: Update a support ticket
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Ticket ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [open, in_progress, resolved, closed]
 *               priority:
 *                 type: string
 *     responses:
 *       200:
 *         description: Ticket updated successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
async function getHandler(req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const supportService = new SupportService();
    const result = await supportService.getTicket(params.id);
    
    return NextResponse.json(result, { status: result.success ? 200 : 404 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

async function patchHandler(req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const body = await req.json();
    const supportService = new SupportService();
    const result = await supportService.updateTicket(params.id, body);
    
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

async function deleteHandler(req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const supportService = new SupportService();
    const result = await supportService.deleteTicket(params.id);
    
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

export const GET = withAuthAndContext(getHandler);
export const PATCH = withAuthAndContext(patchHandler, ['admin']);
export const DELETE = withAuthAndContext(deleteHandler, ['admin']);
