import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { auditLogs, users } from '@/src/db/drizzle/migrations/schema';
import { eq, and, sql, gte, lte } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const searchParams = req.nextUrl.searchParams;
    const format = searchParams.get('format') || 'json';

    // Filters (same as list endpoint)
    const actorType = searchParams.get('actorType') || undefined;
    const action = searchParams.get('action') || undefined;
    const entityType = searchParams.get('entityType') || undefined;
    const userId = searchParams.get('userId') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

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

    // Get all audit logs (no pagination for export)
    const logsList = await db.execute(sql`
      SELECT 
        al.*,
        u.email as user_email,
        u.role as user_role
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause ? sql`WHERE ${whereClause}` : sql``}
      ORDER BY al.created_at DESC
    `);

    const formattedLogs = (logsList.rows || []).map((log: any) => ({
      id: log.id,
      userId: log.user_id,
      userEmail: log.user_email,
      userRole: log.user_role,
      actorType: log.actor_type,
      action: log.action,
      entityType: log.entity_type,
      entityId: log.entity_id,
      details: log.details,
      createdAt: log.created_at,
    }));

    if (format === 'csv') {
      // Convert to CSV
      const headers = ['ID', 'User Email', 'User Role', 'Actor Type', 'Action', 'Entity Type', 'Entity ID', 'Details', 'Created At'];
      const csvRows = [
        headers.join(','),
        ...formattedLogs.map(log => [
          log.id,
          log.userEmail || '',
          log.userRole || '',
          log.actorType,
          log.action,
          log.entityType,
          log.entityId || '',
          JSON.stringify(log.details || {}),
          log.createdAt,
        ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
      ];

      return new NextResponse(csvRows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // Return JSON
    return NextResponse.json({
      success: true,
      data: formattedLogs,
      count: formattedLogs.length,
    });
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to export audit logs',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}





