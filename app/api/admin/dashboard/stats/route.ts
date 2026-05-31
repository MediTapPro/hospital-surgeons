import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { 
  users, 
  doctors, 
  hospitals, 
  assignments,
  subscriptions,
  supportTickets
} from '@/src/db/drizzle/migrations/schema';
import { eq, and, count, sql } from 'drizzle-orm';

/**
 * @swagger
 * /api/admin/dashboard/stats:
 *   get:
 *     summary: Get admin dashboard statistics (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     activeDoctors:
 *                       type: integer
 *                     activeHospitals:
 *                       type: integer
 *                     totalAssignments:
 *                       type: integer
 *                     activeSubscriptions:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 */
export async function GET(req: NextRequest) {
  try {
    const db = getDb();

    // Get active doctors count
    const activeDoctorsResult = await db
      .select({ count: count() })
      .from(doctors)
      .innerJoin(users, eq(doctors.userId, users.id))
      .where(eq(users.status, 'active'));

    const activeDoctors = activeDoctorsResult[0]?.count || 0;

    // Get active hospitals count
    const activeHospitalsResult = await db
      .select({ count: count() })
      .from(hospitals)
      .innerJoin(users, eq(hospitals.userId, users.id))
      .where(eq(users.status, 'active'));

    const activeHospitals = activeHospitalsResult[0]?.count || 0;

    // Get pending verifications count
    const pendingDoctorVerificationsResult = await db
      .select({ count: count() })
      .from(doctors)
      .where(eq(doctors.licenseVerificationStatus, 'pending'));

    const pendingHospitalVerificationsResult = await db
      .select({ count: count() })
      .from(hospitals)
      .where(eq(hospitals.licenseVerificationStatus, 'pending'));

    const pendingVerifications = 
      (pendingDoctorVerificationsResult[0]?.count || 0) + 
      (pendingHospitalVerificationsResult[0]?.count || 0);

    // Get today's assignments count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    const todayAssignmentsResult = await db
      .select({ count: count() })
      .from(assignments)
      .where(
        sql`DATE(${assignments.requestedAt}) = DATE(${todayStr})`
      );

    const todayAssignments = todayAssignmentsResult[0]?.count || 0;

    // Get total active subscriptions
    const activeSubscriptionsResult = await db
      .select({ count: count() })
      .from(subscriptions)
      .where(eq(subscriptions.status, 'active'));

    const activeSubscriptions = activeSubscriptionsResult[0]?.count || 0;

    // Get open support tickets
    const openTicketsResult = await db
      .select({ count: count() })
      .from(supportTickets)
      .where(eq(supportTickets.status, 'open'));

    const openTickets = openTicketsResult[0]?.count || 0;

    // Get total users count
    const totalUsersResult = await db
      .select({ count: count() })
      .from(users);

    const totalUsers = totalUsersResult[0]?.count || 0;

    // Get pending users count
    const pendingUsersResult = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.status, 'pending'));

    const pendingUsers = pendingUsersResult[0]?.count || 0;

    return NextResponse.json({
      success: true,
      data: {
        activeDoctors,
        activeHospitals,
        pendingVerifications,
        todayAssignments,
        activeSubscriptions,
        openTickets,
        totalUsers,
        pendingUsers,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch dashboard statistics',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}





