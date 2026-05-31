import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { specialties, doctorSpecialties, hospitalDepartments } from '@/src/db/drizzle/migrations/schema';
import { eq, like, sql, desc, asc, count, inArray } from 'drizzle-orm';
import { validateRequest } from '@/lib/utils/validate-request';
import { CreateSpecialtyDtoSchema } from '@/lib/validations/specialty.dto';
import { createAuditLog, getRequestMetadata } from '@/lib/utils/audit-logger';
/**
 * @swagger
 * /api/admin/specialties:
 *   get:
 *     summary: List all specialties (Admin)
 *     description: Retrieve a paginated list of all medical specialties with usage counts.
 *     tags: [Admin, Specialties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by specialty name
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, id]
 *           default: name
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Paginated list of specialties
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
 *                     properties:
 *                       id: { type: string }
 *                       name: { type: string }
 *                       description: { type: string, nullable: true }
 *                       activeDoctors: { type: integer }
 *                       activeHospitals: { type: integer }
 *                       status: { type: string }
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     total: { type: integer }
 *                     totalPages: { type: integer }
 *       500:
 *         description: Internal server error
 *
 *   post:
 *     summary: Create a new specialty (Admin)
 *     description: Add a new medical specialty to the system.
 *     tags: [Admin, Specialties]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: Cardiology
 *               description:
 *                 type: string
 *                 example: Diseases and abnormalities of the heart.
 *     responses:
 *       201:
 *         description: Specialty created successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: Specialty already exists
 *       500:
 *         description: Internal server error
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
    const search = searchParams.get('search') || undefined;
    const sortBy = searchParams.get('sortBy') || 'name';
    const sortOrder = searchParams.get('sortOrder') || 'asc';

    // Build where conditions
    const conditions = [];
    
    if (search) {
      conditions.push(
        like(specialties.name, `%${search}%`)
      );
    }

    const whereClause = conditions.length > 0 ? conditions[0] : undefined;

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(specialties)
      .where(whereClause);
    
    const total = Number(countResult[0]?.count || 0);

    // Map sortBy to actual column references
    const sortColumnMap: Record<string, any> = {
      name: specialties.name,
      id: specialties.id,
    };

    const sortColumn = sortColumnMap[sortBy] || specialties.name;

    // Get specialties
    const specialtiesList = await db
      .select({
        id: specialties.id,
        name: specialties.name,
        description: specialties.description,
      })
      .from(specialties)
      .where(whereClause)
      .orderBy(sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn))
      .limit(limit)
      .offset(offset);

    // Get usage counts for all specialties
    const specialtyIds = specialtiesList.map(s => s.id);
    const doctorCountsMap = new Map<string, number>();
    const hospitalCountsMap = new Map<string, number>();

    if (specialtyIds.length > 0) {
      // Get doctor counts grouped by specialty
      const doctorCounts = await db
        .select({
          specialtyId: doctorSpecialties.specialtyId,
          count: count(),
        })
        .from(doctorSpecialties)
        .where(inArray(doctorSpecialties.specialtyId, specialtyIds))
        .groupBy(doctorSpecialties.specialtyId);

      doctorCounts.forEach(dc => {
        doctorCountsMap.set(dc.specialtyId, Number(dc.count));
      });

      // Get hospital counts grouped by specialty
      const hospitalCounts = await db
        .select({
          specialtyId: hospitalDepartments.specialtyId,
          count: count(),
        })
        .from(hospitalDepartments)
        .where(inArray(hospitalDepartments.specialtyId, specialtyIds))
        .groupBy(hospitalDepartments.specialtyId);

      hospitalCounts.forEach(hc => {
        hospitalCountsMap.set(hc.specialtyId, Number(hc.count));
      });
    }

    // Format response
    const formattedSpecialties = specialtiesList.map((specialty) => ({
      id: specialty.id,
      name: specialty.name,
      description: specialty.description,
      activeDoctors: doctorCountsMap.get(specialty.id) || 0,
      activeHospitals: hospitalCountsMap.get(specialty.id) || 0,
      status: 'Active', // Specialties are always active in the schema
    }));

    return NextResponse.json({
      success: true,
      data: formattedSpecialties,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching specialties:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch specialties',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    
    // Validate request body with Zod schema
    const validation = await validateRequest(req, CreateSpecialtyDtoSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { name, description } = validation.data;

    // Check if specialty with same name already exists (duplicate check)
    const existing = await db
      .select()
      .from(specialties)
      .where(eq(specialties.name, name.trim()))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, message: 'Specialty with this name already exists' },
        { status: 409 }
      );
    }

    // Create new specialty
    const [newSpecialty] = await db
      .insert(specialties)
      .values({
        name: name.trim(),
        description: description?.trim() || null,
      })
      .returning();

    // Get request metadata
    const metadata = getRequestMetadata(req);
    const adminUserId = req.headers.get('x-user-id') || null;

    // Create comprehensive audit log
    await createAuditLog({
      userId: adminUserId,
      actorType: 'admin',
      action: 'create',
      entityType: 'specialty',
      entityId: newSpecialty.id,
      entityName: newSpecialty.name,
      httpMethod: 'POST',
      endpoint: '/api/admin/specialties',
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      details: {
        description: newSpecialty.description,
        createdAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Specialty created successfully',
      data: {
        id: newSpecialty.id,
        name: newSpecialty.name,
        description: newSpecialty.description,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating specialty:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to create specialty',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}



