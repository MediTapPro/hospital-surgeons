import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { auditLogs, users } from '@/src/db/drizzle/migrations/schema';
import { eq, sql } from 'drizzle-orm';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const logId = id;

    const logResult = await db.execute(sql`
      SELECT 
        al.*,
        u.email as user_email,
        u.role as user_role
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.id = ${logId}
    `);

    if (logResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Audit log not found' },
        { status: 404 }
      );
    }

    const log = logResult.rows[0] as any;

    return NextResponse.json({
      success: true,
      data: {
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
      },
    });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch audit log',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


