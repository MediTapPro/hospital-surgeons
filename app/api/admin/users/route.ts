import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { users, doctors, hospitals, subscriptions, subscriptionPlans } from '@/src/db/drizzle/migrations/schema';
import { eq, and, or, like, sql, desc, asc, count } from 'drizzle-orm';

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get all users with filters (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, doctor, hospital]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, suspended]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *       401:
 *         description: Unauthorized
 */
export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const searchParams = req.nextUrl.searchParams;
    
    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    // Filters
    const role = searchParams.get('role') || undefined;
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build where conditions
    const conditions = [];
    
    if (role && role !== 'all') {
      conditions.push(eq(users.role, role));
    }
    
    if (status && status !== 'all') {
      conditions.push(eq(users.status, status));
    }
    
    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(
        or(
          like(users.email, searchPattern),
          sql`EXISTS (
            SELECT 1 FROM doctors d 
            WHERE d.user_id = users.id 
            AND (d.first_name || ' ' || d.last_name) ILIKE ${searchPattern}
          )`,
          sql`EXISTS (
            SELECT 1 FROM hospitals h 
            WHERE h.user_id = users.id 
            AND h.name ILIKE ${searchPattern}
          )`
        )!
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count for filtered results
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(whereClause);
    
    const total = Number(countResult[0]?.count || 0);

    // Get total counts by role (for tab counts - without filters)
    // Count all users by role (matching what the list shows - uses LEFT JOIN, so counts all users with role)
    const doctorCountResult = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.role, 'doctor'));
    const doctorCount = Number(doctorCountResult[0]?.count || 0);

    // Count hospitals
    const hospitalCountResult = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.role, 'hospital'));
    const hospitalCount = Number(hospitalCountResult[0]?.count || 0);

    // Count admins
    const adminCountResult = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.role, 'admin'));
    const adminCount = Number(adminCountResult[0]?.count || 0);

    const countsByRole = {
      doctor: doctorCount,
      hospital: hospitalCount,
      admin: adminCount,
      all: doctorCount + hospitalCount + adminCount,
    };

    // Map sortBy to actual column references
    const sortColumnMap: Record<string, any> = {
      createdAt: users.createdAt,
      email: users.email,
      status: users.status,
      role: users.role,
      id: users.id,
    };

    const sortColumn = sortColumnMap[sortBy] || users.createdAt;

    // Get users with related data
    const usersList = await db
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
        // Doctor info
        doctorId: doctors.id,
        doctorFirstName: doctors.firstName,
        doctorLastName: doctors.lastName,
        doctorLicenseStatus: doctors.licenseVerificationStatus,
        // Hospital info
        hospitalId: hospitals.id,
        hospitalName: hospitals.name,
        hospitalLicenseStatus: hospitals.licenseVerificationStatus,
        // Subscription info
        subscriptionId: subscriptions.id,
        subscriptionPlanName: subscriptionPlans.name,
      })
      .from(users)
      .leftJoin(doctors, eq(users.id, doctors.userId))
      .leftJoin(hospitals, eq(users.id, hospitals.userId))
      .leftJoin(subscriptions, and(
        eq(subscriptions.userId, users.id),
        eq(subscriptions.status, 'active')
      ))
      .leftJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
      .where(whereClause)
      .orderBy(sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn))
      .limit(limit)
      .offset(offset);

    // Format response
    const formattedUsers = usersList.map((user) => {
      let name = 'Unknown';
      let verificationStatus = 'pending';
      
      if (user.role === 'doctor' && user.doctorFirstName && user.doctorLastName) {
        name = `Dr. ${user.doctorFirstName} ${user.doctorLastName}`;
        verificationStatus = user.doctorLicenseStatus || 'pending';
      } else if (user.role === 'hospital' && user.hospitalName) {
        name = user.hospitalName;
        verificationStatus = user.hospitalLicenseStatus || 'pending';
      } else if (user.role === 'admin') {
        name = 'Admin User';
        verificationStatus = 'verified';
      }

      return {
        id: user.id,
        name,
        email: user.email,
        role: user.role,
        status: user.status,
        verificationStatus,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionTier: user.subscriptionTier,
        subscriptionPlanName: user.subscriptionPlanName,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        phone: user.phone,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        doctorId: user.doctorId,
        hospitalId: user.hospitalId,
      };
    });

    return NextResponse.json({
      success: true,
      data: formattedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      counts: countsByRole,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch users',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

