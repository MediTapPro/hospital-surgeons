import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { supportTickets, users } from '@/src/db/drizzle/migrations/schema';
import { eq, sql } from 'drizzle-orm';
import { createAuditLog, getRequestMetadata, buildChangesObject } from '@/lib/utils/audit-logger';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const ticketId = id;

    const ticketResult = await db.execute(sql`
      SELECT 
        st.*,
        u.email as user_email,
        u.role as user_role,
        a.email as assigned_to_email,
        a.role as assigned_to_role
      FROM support_tickets st
      LEFT JOIN users u ON st.user_id = u.id
      LEFT JOIN users a ON st.assigned_to = a.id
      WHERE st.id = ${ticketId}
    `);

    if (ticketResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Support ticket not found' },
        { status: 404 }
      );
    }

    const ticket = ticketResult.rows[0] as any;

    // Get audit history for this ticket
    const historyResult = await db.execute(sql`
      SELECT * FROM audit_logs
      WHERE entity_type = 'support_ticket' 
        AND entity_id = ${ticketId}
      ORDER BY created_at DESC
    `);

    return NextResponse.json({
      success: true,
      data: {
        id: ticket.id,
        userId: ticket.user_id,
        userEmail: ticket.user_email,
        userRole: ticket.user_role,
        bookingId: ticket.booking_id,
        subject: ticket.subject,
        description: ticket.description,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        assignedTo: ticket.assigned_to,
        assignedToEmail: ticket.assigned_to_email,
        assignedToRole: ticket.assigned_to_role,
        createdAt: ticket.created_at,
        history: (historyResult.rows || []).map((log: any) => ({
          id: log.id,
          action: log.action,
          details: log.details,
          createdAt: log.created_at,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching support ticket:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch support ticket',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const ticketId = id;
    const body = await req.json();
    const { status, priority, category, assignedTo } = body;

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

    const oldTicket = existing[0];

    // Build update object
    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (category !== undefined) updateData.category = category;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;

    // Update ticket
    const [updatedTicket] = await db
      .update(supportTickets)
      .set(updateData)
      .where(eq(supportTickets.id, ticketId))
      .returning();

    // Get request metadata
    const metadata = getRequestMetadata(req);
    const adminUserId = req.headers.get('x-user-id') || null;

    // Build changes object
    const oldData: any = {
      status: oldTicket.status,
      priority: oldTicket.priority,
      category: oldTicket.category,
      assignedTo: oldTicket.assignedTo,
    };
    const newData: any = {
      status: updatedTicket.status,
      priority: updatedTicket.priority,
      category: updatedTicket.category,
      assignedTo: updatedTicket.assignedTo,
    };
    const changes = buildChangesObject(oldData, newData, ['status', 'priority', 'category', 'assignedTo']);

    // Create comprehensive audit log
    await createAuditLog({
      userId: adminUserId,
      actorType: 'admin',
      action: 'update',
      entityType: 'support_ticket',
      entityId: ticketId,
      entityName: oldTicket.subject,
      httpMethod: 'PUT',
      endpoint: `/api/admin/support/tickets/${ticketId}`,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      changes: changes,
      previousStatus: oldTicket.status || undefined,
      newStatus: updatedTicket.status || undefined,
      details: {
        userId: oldTicket.userId,
        updatedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Support ticket updated successfully',
      data: updatedTicket,
    });
  } catch (error) {
    console.error('Error updating support ticket:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to update support ticket',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


