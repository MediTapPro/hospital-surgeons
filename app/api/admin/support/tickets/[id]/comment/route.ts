import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { supportTickets, users } from '@/src/db/drizzle/migrations/schema';
import { eq } from 'drizzle-orm';
import { createAuditLog, getRequestMetadata } from '@/lib/utils/audit-logger';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const ticketId = id;
    const body = await req.json();
    const { comment, userId } = body;

    if (!comment) {
      return NextResponse.json(
        { success: false, message: 'Comment is required' },
        { status: 400 }
      );
    }

    // Check if ticket exists
    const existing = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.id, ticketId))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Support ticket not found' },
        { status: 404 }
      );
    }

    // Get request metadata
    const metadata = getRequestMetadata(req);
    
    // Get user email if userId provided
    let userEmail = null;
    if (userId) {
      const userResult = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      userEmail = userResult[0]?.email || null;
    }

    // Create comprehensive audit log
    await createAuditLog({
      userId: userId || null,
      actorType: userId ? 'user' : 'admin',
      action: 'comment',
      entityType: 'support_ticket',
      entityId: ticketId,
      entityName: existing[0].subject,
      httpMethod: 'POST',
      endpoint: `/api/admin/support/tickets/${ticketId}/comment`,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      details: {
        comment,
        ticketSubject: existing[0].subject,
        ticketStatus: existing[0].status,
        userEmail: userEmail,
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Comment added successfully',
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to add comment',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


