import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { users } from '@/src/db/drizzle/migrations/schema';
import { eq } from 'drizzle-orm';
import { createAuditLog, getRequestMetadata, buildChangesObject } from '@/lib/utils/audit-logger';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const userId = id;
    const body = await req.json();
    const { status } = body;

    // Validate status
    const validStatuses = ['active', 'inactive', 'pending', 'suspended'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, message: 'Invalid status. Must be one of: ' + validStatuses.join(', ') },
        { status: 400 }
      );
    }

    // Check if user exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (existingUser.length === 0) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    const oldUser = existingUser[0];
    const previousStatus = oldUser.status;

    // Update user status
    const [updatedUser] = await db
      .update(users)
      .set({
        status: status,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, userId))
      .returning();

    // Get request metadata
    const metadata = getRequestMetadata(req);
    
    // Get admin user ID from request (adjust based on your auth setup)
    const adminUserId = req.headers.get('x-user-id') || null;

    // Build changes object
    const changes = buildChangesObject(
      { status: previousStatus },
      { status: status },
      ['status']
    );

    // Create comprehensive audit log
    await createAuditLog({
      userId: adminUserId,
      actorType: 'admin',
      action: 'update_status',
      entityType: 'user',
      entityId: userId,
      entityName: oldUser.email,
      httpMethod: 'PUT',
      endpoint: `/api/admin/users/${userId}/status`,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      previousStatus: previousStatus,
      newStatus: status,
      changes: changes,
      reason: body.reason || 'Status updated by admin',
      details: {
        userRole: oldUser.role,
        userEmail: oldUser.email,
        updatedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'User status updated successfully',
      data: {
        id: updatedUser.id,
        status: updatedUser.status,
      },
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to update user status',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


