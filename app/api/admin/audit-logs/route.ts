import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { auditLogs, users } from '@/src/db/drizzle/migrations/schema';
import { eq, and, or, sql, desc, asc, gte, lte } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const searchParams = req.nextUrl.searchParams;
    
    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // Filters
    const actorType = searchParams.get('actorType') || undefined;
    const action = searchParams.get('action') || undefined;
    const entityType = searchParams.get('entityType') || undefined;
    const userId = searchParams.get('userId') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build where conditions
    const conditions = [];
    
    if (actorType) {
      conditions.push(eq(auditLogs.actorType, actorType));
    }
    
    if (action) {
      conditions.push(eq(auditLogs.action, action));
    }
    
    if (entityType) {
      conditions.push(eq(auditLogs.entityType, entityType));
    }
    
    if (userId) {
      conditions.push(eq(auditLogs.userId, userId));
    }
    
    if (startDate) {
      conditions.push(gte(auditLogs.createdAt, startDate));
    }
    
    if (endDate) {
      conditions.push(lte(auditLogs.createdAt, endDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(whereClause);
    
    const total = Number(countResult[0]?.count || 0);

    // Get audit logs with user info using Drizzle query builder
    const logsQuery = db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        actorType: auditLogs.actorType,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        details: auditLogs.details,
        createdAt: auditLogs.createdAt,
        userEmail: users.email,
        userRole: users.role,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(whereClause)
      .orderBy(sortOrder === 'asc' ? asc(auditLogs.createdAt) : desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const logsList = await logsQuery;

    // Format response
    const formattedLogs = logsList.map((log) => ({
      id: log.id,
      userId: log.userId,
      userEmail: log.userEmail,
      userRole: log.userRole,
      actorType: log.actorType,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      details: log.details,
      createdAt: log.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: formattedLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch audit logs',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}





