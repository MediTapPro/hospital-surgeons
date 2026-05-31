import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { supportTickets, users } from '@/src/db/drizzle/migrations/schema';
import { eq } from 'drizzle-orm';
import { createAuditLog, getRequestMetadata, buildChangesObject } from '@/lib/utils/audit-logger';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const ticketId = id;
    const body = await req.json();
    const { assignedTo } = body;

    if (!assignedTo) {
      return NextResponse.json(
        { success: false, message: 'Assigned to user ID is required' },
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

    // Check if assigned user exists and is admin
    const assignedUser = await db
      .select()
      .from(users)
      .where(eq(users.id, assignedTo))
      .limit(1);

    if (assignedUser.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Assigned user not found' },
        { status: 404 }
      );
    }

    const oldTicket = existing[0];

    // Update ticket
    const [updatedTicket] = await db
      .update(supportTickets)
      .set({ assignedTo })
      .where(eq(supportTickets.id, ticketId))
      .returning();

    // Get request metadata
    const metadata = getRequestMetadata(req);
    const adminUserId = req.headers.get('x-user-id') || null;

    // Get assigned user email
    const assignedUserEmail = assignedUser[0]?.email || null;

    // Build changes object
    const changes = buildChangesObject(
      { assignedTo: oldTicket.assignedTo },
      { assignedTo: updatedTicket.assignedTo },
      ['assignedTo']
    );

    // Create comprehensive audit log
    await createAuditLog({
      userId: adminUserId,
      actorType: 'admin',
      action: 'assign',
      entityType: 'support_ticket',
      entityId: ticketId,
      entityName: oldTicket.subject,
      httpMethod: 'POST',
      endpoint: `/api/admin/support/tickets/${ticketId}/assign`,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      changes: changes,
      details: {
        assignedTo: assignedTo,
        assignedToEmail: assignedUserEmail,
        previousAssignedTo: oldTicket.assignedTo,
        ticketStatus: oldTicket.status,
        assignedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Ticket assigned successfully',
      data: updatedTicket,
    });
  } catch (error) {
    console.error('Error assigning ticket:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to assign ticket',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


