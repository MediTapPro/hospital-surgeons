import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { users, doctors, hospitals, subscriptions, subscriptionPlans, assignments, orders, paymentTransactions, auditLogs } from '@/src/db/drizzle/migrations/schema';
import { eq, and, desc } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { createAuditLog, getRequestMetadata } from '@/lib/utils/audit-logger';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const userId = id;

    // Get user with related data
    const userResult = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        status: users.status,
        subscriptionStatus: users.subscriptionStatus,
        subscriptionTier: users.subscriptionTier,
        emailVerified: users.emailVerified,
        phoneVerified: users.phoneVerified,
        phone: users.phone,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        // Doctor info
        doctorId: doctors.id,
        doctorFirstName: doctors.firstName,
        doctorLastName: doctors.lastName,
        doctorLicenseNumber: doctors.medicalLicenseNumber,
        doctorLicenseStatus: doctors.licenseVerificationStatus,
        doctorYearsOfExperience: doctors.yearsOfExperience,
        doctorBio: doctors.bio,
        doctorAverageRating: doctors.averageRating,
        doctorTotalRatings: doctors.totalRatings,
        doctorCompletedAssignments: doctors.completedAssignments,
        // Hospital info
        hospitalId: hospitals.id,
        hospitalName: hospitals.name,
        hospitalType: hospitals.hospitalType,
        hospitalRegistrationNumber: hospitals.registrationNumber,
        hospitalLicenseStatus: hospitals.licenseVerificationStatus,
        hospitalAddress: hospitals.address,
        hospitalCity: hospitals.city,
        hospitalNumberOfBeds: hospitals.numberOfBeds,
      })
      .from(users)
      .leftJoin(doctors, eq(users.id, doctors.userId))
      .leftJoin(hospitals, eq(users.id, hospitals.userId))
      .where(eq(users.id, userId))
      .limit(1);

    if (userResult.length === 0) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    const user = userResult[0];

    // Get active subscription
    const activeSubscription = await db
      .select({
        id: subscriptions.id,
        planId: subscriptions.planId,
        planName: subscriptionPlans.name,
        tier: subscriptionPlans.tier,
        status: subscriptions.status,
        startDate: subscriptions.startDate,
        endDate: subscriptions.endDate,
        autoRenew: subscriptions.autoRenew,
      })
      .from(subscriptions)
      .leftJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
      .where(and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, 'active')
      ))
      .limit(1);

    // Get recent audit logs
    const recentAuditLogs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(10);

    // Get assignment stats
    let assignmentStats;
    if (user.role === 'doctor' && user.doctorId) {
      assignmentStats = await db.execute(sql`
        SELECT 
          COUNT(*)::int as total,
          COUNT(CASE WHEN status = 'completed' THEN 1 END)::int as completed,
          COUNT(CASE WHEN status = 'pending' THEN 1 END)::int as pending,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END)::int as cancelled
        FROM assignments
        WHERE doctor_id = ${user.doctorId}
      `);
    } else if (user.role === 'hospital' && user.hospitalId) {
      assignmentStats = await db.execute(sql`
        SELECT 
          COUNT(*)::int as total,
          COUNT(CASE WHEN status = 'completed' THEN 1 END)::int as completed,
          COUNT(CASE WHEN status = 'pending' THEN 1 END)::int as pending,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END)::int as cancelled
        FROM assignments
        WHERE hospital_id = ${user.hospitalId}
      `);
    } else {
      assignmentStats = { rows: [{ total: 0, completed: 0, pending: 0, cancelled: 0 }] };
    }

    // Format response
    let name = 'Unknown';
    let verificationStatus = 'pending';
    let profileData = null;

    if (user.role === 'doctor' && user.doctorFirstName && user.doctorLastName) {
      name = `Dr. ${user.doctorFirstName} ${user.doctorLastName}`;
      verificationStatus = user.doctorLicenseStatus || 'pending';
      profileData = {
        firstName: user.doctorFirstName,
        lastName: user.doctorLastName,
        licenseNumber: user.doctorLicenseNumber,
        licenseStatus: user.doctorLicenseStatus,
        yearsOfExperience: user.doctorYearsOfExperience,
        bio: user.doctorBio,
        averageRating: user.doctorAverageRating,
        totalRatings: user.doctorTotalRatings,
        completedAssignments: user.doctorCompletedAssignments,
      };
    } else if (user.role === 'hospital' && user.hospitalName) {
      name = user.hospitalName;
      verificationStatus = user.hospitalLicenseStatus || 'pending';
      profileData = {
        name: user.hospitalName,
        type: user.hospitalType,
        registrationNumber: user.hospitalRegistrationNumber,
        licenseStatus: user.hospitalLicenseStatus,
        address: user.hospitalAddress,
        city: user.hospitalCity,
        numberOfBeds: user.hospitalNumberOfBeds,
      };
    } else if (user.role === 'admin') {
      name = 'Admin User';
      verificationStatus = 'verified';
    }

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        name,
        email: user.email,
        role: user.role,
        status: user.status,
        verificationStatus,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionTier: user.subscriptionTier,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        phone: user.phone,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        profileData,
        activeSubscription: activeSubscription[0] || null,
        recentAuditLogs: recentAuditLogs.map((log) => ({
          id: log.id,
          action: log.action,
          entityType: log.entityType,
          details: log.details,
          createdAt: log.createdAt,
        })),
        assignmentStats: assignmentStats.rows[0] || {
          total: 0,
          completed: 0,
          pending: 0,
          cancelled: 0,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch user',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const userId = id;

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

    // Prevent deleting admin users (security measure)
    if (existingUser[0].role === 'admin') {
      return NextResponse.json(
        { success: false, message: 'Cannot delete admin users' },
        { status: 403 }
      );
    }

    const oldUser = existingUser[0];

    // Soft delete: Update status to 'suspended' instead of actually deleting
    const [updatedUser] = await db
      .update(users)
      .set({
        status: 'suspended',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, userId))
      .returning();

    // Get request metadata
    const metadata = getRequestMetadata(req);
    const adminUserId = req.headers.get('x-user-id') || null;

    // Create comprehensive audit log
    await createAuditLog({
      userId: adminUserId,
      actorType: 'admin',
      action: 'delete',
      entityType: 'user',
      entityId: userId,
      entityName: oldUser.email,
      httpMethod: 'DELETE',
      endpoint: `/api/admin/users/${userId}`,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      previousStatus: oldUser.status,
      newStatus: 'suspended',
      changes: {
        status: {
          old: oldUser.status,
          new: 'suspended',
        },
      },
      reason: 'User deleted (soft delete) by admin',
      details: {
        userRole: oldUser.role,
        deletedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully (soft delete - status set to suspended)',
      data: {
        id: updatedUser.id,
        status: updatedUser.status,
      },
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to delete user',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

