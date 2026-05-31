import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { supportTickets, users } from '@/src/db/drizzle/migrations/schema';
import { eq, and, or, sql, desc, asc } from 'drizzle-orm';
import { createAuditLog, getRequestMetadata } from '@/lib/utils/audit-logger';

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const searchParams = req.nextUrl.searchParams;
    
    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    // Filters
    const status = searchParams.get('status') || undefined;
    const priority = searchParams.get('priority') || undefined;
    const category = searchParams.get('category') || undefined;
    const assignedTo = searchParams.get('assignedTo') || undefined;
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build where conditions for Drizzle query (for count)
    const conditions = [];
    
    if (status) {
      conditions.push(eq(supportTickets.status, status));
    }
    
    if (priority) {
      conditions.push(eq(supportTickets.priority, priority));
    }
    
    if (category) {
      conditions.push(eq(supportTickets.category, category));
    }
    
    if (assignedTo) {
      conditions.push(eq(supportTickets.assignedTo, assignedTo));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(supportTickets)
      .where(whereClause);
    
    const total = Number(countResult[0]?.count || 0);

    // Build WHERE clause for raw SQL query (using alias 'st')
    const rawWhereConditions: any[] = [];
    if (status) {
      rawWhereConditions.push(sql`st.status = ${status}`);
    }
    if (priority) {
      rawWhereConditions.push(sql`st.priority = ${priority}`);
    }
    if (category) {
      rawWhereConditions.push(sql`st.category = ${category}`);
    }
    if (assignedTo) {
      rawWhereConditions.push(sql`st.assigned_to = ${assignedTo}`);
    }
    const rawWhereClause = rawWhereConditions.length > 0
      ? sql`WHERE ${sql.join(rawWhereConditions, sql` AND `)}`
      : sql``;

    // Get tickets with related data
    const ticketsList = await db.execute(sql`
      SELECT 
        st.*,
        u.email as user_email,
        u.role as user_role,
        a.email as assigned_to_email,
        a.role as assigned_to_role
      FROM support_tickets st
      LEFT JOIN users u ON st.user_id = u.id
      LEFT JOIN users a ON st.assigned_to = a.id
      ${rawWhereClause}
      ORDER BY st.created_at ${sortOrder === 'asc' ? sql`ASC` : sql`DESC`}
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    // Format response
    const formattedTickets = (ticketsList.rows || []).map((ticket: any) => ({
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
    }));

    return NextResponse.json({
      success: true,
      data: formattedTickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching support tickets:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch support tickets',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();
    const { userId, subject, description, category, priority = 'medium' } = body;

    if (!subject || !description) {
      return NextResponse.json(
        { success: false, message: 'Subject and description are required' },
        { status: 400 }
      );
    }

    // Create new ticket
    const [newTicket] = await db
      .insert(supportTickets)
      .values({
        userId: userId || null,
        subject,
        description,
        category: category || null,
        priority,
        status: 'open',
      })
      .returning();

    // Get request metadata
    const metadata = getRequestMetadata(req);
    const adminUserId = req.headers.get('x-user-id') || null;

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
      userId: adminUserId,
      actorType: 'admin',
      action: 'create',
      entityType: 'support_ticket',
      entityId: newTicket.id,
      entityName: subject,
      httpMethod: 'POST',
      endpoint: '/api/admin/support/tickets',
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      details: {
        subject,
        category,
        priority,
        status: 'open',
        userId: userId,
        userEmail: userEmail,
        createdAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Support ticket created successfully',
      data: newTicket,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating support ticket:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to create support ticket',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}





