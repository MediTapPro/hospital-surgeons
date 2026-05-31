import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { specialties, doctorSpecialties, hospitalDepartments } from '@/src/db/drizzle/migrations/schema';
import { eq, sql, count } from 'drizzle-orm';
import { validateRequest } from '@/lib/utils/validate-request';
import { UpdateSpecialtyDtoSchema } from '@/lib/validations/specialty.dto';
import { createAuditLog, getRequestMetadata, buildChangesObject } from '@/lib/utils/audit-logger';
/**
 * @swagger
 * /api/admin/specialties/{id}:
 *   get:
 *     summary: Get specialty details (Admin)
 *     description: Retrieve detailed information for a specific specialty, including usage statistics.
 *     tags: [Admin, Specialties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique specialty ID
 *     responses:
 *       200:
 *         description: Specialty details retrieved successfully
 *       404:
 *         description: Specialty not found
 *       500:
 *         description: Internal server error
 *
 *   put:
 *     summary: Update specialty (Admin)
 *     description: Modify details of an existing specialty.
 *     tags: [Admin, Specialties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique specialty ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *     responses:
 *       200:
 *         description: Specialty updated successfully
 *       404:
 *         description: Specialty not found
 *       409:
 *         description: Specialty name already in use
 *       500:
 *         description: Internal server error
 *
 *   delete:
 *     summary: Delete specialty (Admin)
 *     description: Remove a specialty if it is not currently associated with any doctors or hospitals.
 *     tags: [Admin, Specialties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique specialty ID
 *     responses:
 *       200:
 *         description: Specialty deleted successfully
 *       404:
 *         description: Specialty not found
 *       409:
 *         description: Cannot delete specialty as it is currently in use
 *       500:
 *         description: Internal server error
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const specialtyId = id;

    // Get specialty
    const specialtyResult = await db
      .select({
        id: specialties.id,
        name: specialties.name,
        description: specialties.description,
      })
      .from(specialties)
      .where(eq(specialties.id, specialtyId))
      .limit(1);

    if (specialtyResult.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Specialty not found' },
        { status: 404 }
      );
    }

    const specialty = specialtyResult[0];

    // Get usage counts separately
    const doctorCountResult = await db
      .select({ count: count() })
      .from(doctorSpecialties)
      .where(eq(doctorSpecialties.specialtyId, specialtyId));

    const hospitalCountResult = await db
      .select({ count: count() })
      .from(hospitalDepartments)
      .where(eq(hospitalDepartments.specialtyId, specialtyId));

    const doctorCount = Number(doctorCountResult[0]?.count || 0);
    const hospitalCount = Number(hospitalCountResult[0]?.count || 0);

    return NextResponse.json({
      success: true,
      data: {
        id: specialty.id,
        name: specialty.name,
        description: specialty.description,
        activeDoctors: doctorCount,
        activeHospitals: hospitalCount,
        status: 'Active',
      },
    });
  } catch (error) {
    console.error('Error fetching specialty:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch specialty',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const specialtyId = id;
    
    // Validate request body with Zod schema
    const validation = await validateRequest(req, UpdateSpecialtyDtoSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { name, description } = validation.data;

    // Check if specialty exists
    const existing = await db
      .select()
      .from(specialties)
      .where(eq(specialties.id, specialtyId))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Specialty not found' },
        { status: 404 }
      );
    }

    // Check if another specialty with same name exists (duplicate check)
    if (name && name.trim() !== existing[0].name) {
      const duplicate = await db
        .select()
        .from(specialties)
        .where(eq(specialties.name, name.trim()))
        .limit(1);

      if (duplicate.length > 0 && duplicate[0].id !== specialtyId) {
        return NextResponse.json(
          { success: false, message: 'Specialty with this name already exists' },
          { status: 409 }
        );
      }
    }

    // Update specialty
    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;

    const [updatedSpecialty] = await db
      .update(specialties)
      .set(updateData)
      .where(eq(specialties.id, specialtyId))
      .returning();

    // Get request metadata
    const metadata = getRequestMetadata(req);
    const adminUserId = req.headers.get('x-user-id') || null;

    // Build changes object
    const oldData: any = {
      name: existing[0].name,
      description: existing[0].description,
    };
    const newData: any = {
      name: updatedSpecialty.name,
      description: updatedSpecialty.description,
    };
    const changes = buildChangesObject(oldData, newData, ['name', 'description']);

    // Create comprehensive audit log
    await createAuditLog({
      userId: adminUserId,
      actorType: 'admin',
      action: 'update',
      entityType: 'specialty',
      entityId: specialtyId,
      entityName: updatedSpecialty.name,
      httpMethod: 'PUT',
      endpoint: `/api/admin/specialties/${specialtyId}`,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      changes: changes,
      details: {
        updatedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Specialty updated successfully',
      data: {
        id: updatedSpecialty.id,
        name: updatedSpecialty.name,
        description: updatedSpecialty.description,
      },
    });
  } catch (error) {
    console.error('Error updating specialty:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to update specialty',
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
    const specialtyId = id;

    // Check if specialty exists
    const existing = await db
      .select()
      .from(specialties)
      .where(eq(specialties.id, specialtyId))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Specialty not found' },
        { status: 404 }
      );
    }

    // Step 1: Check if specialty is being used by doctors before deletion
    const doctorUsage = await db
      .select({ count: count() })
      .from(doctorSpecialties)
      .where(eq(doctorSpecialties.specialtyId, specialtyId));

    const doctorCount = Number(doctorUsage[0]?.count || 0);

    // Step 2: Check if specialty is being used by hospitals before deletion
    const hospitalUsage = await db
      .select({ count: count() })
      .from(hospitalDepartments)
      .where(eq(hospitalDepartments.specialtyId, specialtyId));

    const hospitalCount = Number(hospitalUsage[0]?.count || 0);

    // Step 3: Prevent deletion if specialty is being used
    if (doctorCount > 0 || hospitalCount > 0) {
      const parts = [];
      if (doctorCount > 0) parts.push(`${doctorCount} doctor(s)`);
      if (hospitalCount > 0) parts.push(`${hospitalCount} hospital(s)`);
      
      return NextResponse.json(
        {
          success: false,
          message: `Cannot delete specialty. It is being used by ${parts.join(' and ')}.`,
          data: {
            doctorCount,
            hospitalCount,
          },
        },
        { status: 409 }
      );
    }

    // Delete specialty
    await db
      .delete(specialties)
      .where(eq(specialties.id, specialtyId));

    // Get request metadata
    const metadata = getRequestMetadata(req);
    const adminUserId = req.headers.get('x-user-id') || null;

    // Create comprehensive audit log
    await createAuditLog({
      userId: adminUserId,
      actorType: 'admin',
      action: 'delete',
      entityType: 'specialty',
      entityId: specialtyId,
      entityName: existing[0].name,
      httpMethod: 'DELETE',
      endpoint: `/api/admin/specialties/${specialtyId}`,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      details: {
        description: existing[0].description,
        doctorCountAtDeletion: doctorCount,
        hospitalCountAtDeletion: hospitalCount,
        deletedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Specialty deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting specialty:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to delete specialty',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


