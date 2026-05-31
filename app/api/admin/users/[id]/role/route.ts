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
    const { role } = body;

    // Validate role
    const validRoles = ['doctor', 'hospital', 'admin'];
    if (!role || !validRoles.includes(role)) {
      return NextResponse.json(
        { success: false, message: 'Invalid role. Must be one of: ' + validRoles.join(', ') },
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

    // Prevent changing admin role (security measure)
    if (existingUser[0].role === 'admin' && role !== 'admin') {
      return NextResponse.json(
        { success: false, message: 'Cannot change admin role' },
        { status: 403 }
      );
    }

    const oldUser = existingUser[0];

    // Update user role
    const [updatedUser] = await db
      .update(users)
      .set({
        role: role,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, userId))
      .returning();

    // Get request metadata
    const metadata = getRequestMetadata(req);
    const adminUserId = req.headers.get('x-user-id') || null;

    // Build changes object
    const changes = buildChangesObject(
      { role: oldUser.role },
      { role: updatedUser.role },
      ['role']
    );

    // Create comprehensive audit log
    await createAuditLog({
      userId: adminUserId,
      actorType: 'admin',
      action: 'update_role',
      entityType: 'user',
      entityId: userId,
      entityName: oldUser.email,
      httpMethod: 'PUT',
      endpoint: `/api/admin/users/${userId}/role`,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      changes: changes,
      reason: body.reason || 'Role updated by admin',
      details: {
        previousRole: oldUser.role,
        newRole: updatedUser.role,
        userRole: oldUser.role,
        updatedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'User role updated successfully',
      data: {
        id: updatedUser.id,
        role: updatedUser.role,
      },
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to update user role',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


