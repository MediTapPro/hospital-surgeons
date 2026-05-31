import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { DoctorsService } from '@/lib/services/doctors.service';
import { getDb } from '@/lib/db';
import { assignmentPayments } from '@/src/db/drizzle/migrations/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

/**
 * @swagger
 * /api/doctors/earnings:
 *   get:
 *     summary: Get doctor earnings and payment statistics
 *     tags: [Doctors]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Earnings data retrieved successfully
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
 *                     totalEarnings:
 *                       type: number
 *                       description: Total earnings from all completed payments
 *                     thisMonthEarnings:
 *                       type: number
 *                       description: Earnings from the current month
 *                     thisMonthAssignments:
 *                       type: number
 *                       description: Number of assignments completed this month
 *                     pendingEarnings:
 *                       type: number
 *                       description: Total earnings pending payment
 *                     currency:
 *                       type: string
 *                       default: USD
 *       404:
 *         description: Doctor profile not found
 *       500:
 *         description: Internal server error
 */
async function getHandler(req: NextRequest) {
  try {
    const user = (req as any).user;
    const doctorsService = new DoctorsService();
    const db = getDb();
    
    // Find doctor by userId using service
    const doctorResult = await doctorsService.findDoctorByUserId(user.userId);
    if (!doctorResult.success || !doctorResult.data) {
      return NextResponse.json(
        { success: false, message: 'Doctor profile not found' },
        { status: 404 }
      );
    }

    const doctorId = doctorResult.data.id;

    // Get total earnings (all time)
    const totalEarningsResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${assignmentPayments.doctorPayout}), 0)`,
      })
      .from(assignmentPayments)
      .where(
        and(
          eq(assignmentPayments.doctorId, doctorId),
          eq(assignmentPayments.paymentStatus, 'completed')
        )
      );

    const totalEarnings = Number(totalEarningsResult[0]?.total || 0);

    // Get this month earnings
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const thisMonthEarningsResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${assignmentPayments.doctorPayout}), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(assignmentPayments)
      .where(
        and(
          eq(assignmentPayments.doctorId, doctorId),
          eq(assignmentPayments.paymentStatus, 'completed'),
          gte(assignmentPayments.paidToDoctorAt, startOfMonth.toISOString())
        )
      );

    const thisMonthEarnings = Number(thisMonthEarningsResult[0]?.total || 0);
    const thisMonthCount = Number(thisMonthEarningsResult[0]?.count || 0);

    // Get pending earnings
    const pendingEarningsResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${assignmentPayments.doctorPayout}), 0)`,
      })
      .from(assignmentPayments)
      .where(
        and(
          eq(assignmentPayments.doctorId, doctorId),
          eq(assignmentPayments.paymentStatus, 'pending')
        )
      );

    const pendingEarnings = Number(pendingEarningsResult[0]?.total || 0);

    return NextResponse.json({
      success: true,
      data: {
        totalEarnings,
        thisMonthEarnings,
        thisMonthAssignments: thisMonthCount,
        pendingEarnings,
        currency: 'USD',
      },
    });
  } catch (error) {
    console.error('Error fetching earnings:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);
