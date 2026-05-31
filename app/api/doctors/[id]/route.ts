import { NextRequest, NextResponse } from 'next/server';
import { DoctorsService } from '@/lib/services/doctors.service';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';
import { createAuditLog, getRequestMetadata, buildChangesObject } from '@/lib/utils/audit-logger';
import { getDb } from '@/lib/db';
import { doctors, users } from '@/src/db/drizzle/migrations/schema';
import { eq } from 'drizzle-orm';

/**
 * @swagger
 * /api/doctors/{id}:
 *   get:
 *     summary: Get doctor by ID
 *     tags: [Doctors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Doctor ID
 *     responses:
 *       200:
 *         description: Doctor details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       404:
 *         description: Doctor not found
 *   patch:
 *     summary: Update doctor by ID
 *     tags: [Doctors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Doctor ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               medicalLicenseNumber:
 *                 type: string
 *               yearsOfExperience:
 *                 type: number
 *               bio:
 *                 type: string
 *               profilePhotoId:
 *                 type: string
 *                 format: uuid
 *               latitude:
 *                 type: number
 *                 description: Optional - Only used if provided by frontend
 *               longitude:
 *                 type: number
 *                 description: Optional - Only used if provided by frontend
 *     responses:
 *       200:
 *         description: Doctor updated successfully
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Doctor not found
 *   delete:
 *     summary: Delete doctor by ID (Admin only)
 *     tags: [Doctors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Doctor ID
 *     responses:
 *       200:
 *         description: Doctor deleted successfully
 *       403:
 *         description: Insufficient permissions
 */
async function getHandler(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const doctorsService = new DoctorsService();
    const result = await doctorsService.findDoctorById(params.id);
    
    return NextResponse.json(result, { status: result.success ? 200 : 404 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

async function patchHandler(req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const user = (req as any).user;
    
    // Validate request body with Zod
    const { UpdateDoctorDtoSchema } = await import('@/lib/validations/doctor.dto');
    const { validateRequest } = await import('@/lib/utils/validate-request');
    
    const validation = await validateRequest(req, UpdateDoctorDtoSchema);
    if (!validation.success) {
      return validation.response;
    }
    
    // Check if user is admin or the doctor themselves
    if (user.userRole !== 'admin') {
      // Verify the doctor belongs to this user
      const doctorsService = new DoctorsService();
      const doctorResult = await doctorsService.findDoctorByUserId(user.userId);
      if (!doctorResult.success || doctorResult.data?.id !== params.id) {
        return NextResponse.json(
          { success: false, message: 'Insufficient permissions' },
          { status: 403 }
        );
      }
    }

    // Get existing doctor data for audit log
    const db = getDb();
    const existingDoctor = await db
      .select({
        id: doctors.id,
        firstName: doctors.firstName,
        lastName: doctors.lastName,
        userId: doctors.userId,
        medicalLicenseNumber: doctors.medicalLicenseNumber,
        userEmail: users.email,
      })
      .from(doctors)
      .leftJoin(users, eq(doctors.userId, users.id))
      .where(eq(doctors.id, params.id))
      .limit(1);

    const doctorsService = new DoctorsService();
    const result = await doctorsService.updateDoctor(params.id, validation.data);
    
    if (result.success && existingDoctor.length > 0) {
      // Get request metadata
      const metadata = getRequestMetadata(req);
      const actorUserId = user.userId;
      const doctorName = `Dr. ${existingDoctor[0].firstName} ${existingDoctor[0].lastName}`;

      // Build changes object
      const oldData: any = {
        firstName: existingDoctor[0].firstName,
        lastName: existingDoctor[0].lastName,
        medicalLicenseNumber: existingDoctor[0].medicalLicenseNumber,
      };
      const newData: any = {
        firstName: validation.data.firstName,
        lastName: validation.data.lastName,
        medicalLicenseNumber: validation.data.medicalLicenseNumber,
      };
      const changes = buildChangesObject(oldData, newData, Object.keys(validation.data));

      // Create comprehensive audit log
      await createAuditLog({
        userId: actorUserId,
        actorType: user.userRole === 'admin' ? 'admin' : 'user',
        action: 'update',
        entityType: 'doctor',
        entityId: params.id,
        entityName: doctorName,
        httpMethod: 'PATCH',
        endpoint: `/api/doctors/${params.id}`,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        changes: changes,
        details: {
          doctorEmail: existingDoctor[0].userEmail,
          updatedFields: Object.keys(validation.data),
          updatedAt: new Date().toISOString(),
        },
      });
    }
    
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

async function deleteHandler(req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const user = (req as any).user;
    
    // Get existing doctor data for audit log
    const db = getDb();
    const existingDoctor = await db
      .select({
        id: doctors.id,
        firstName: doctors.firstName,
        lastName: doctors.lastName,
        userId: doctors.userId,
        userEmail: users.email,
      })
      .from(doctors)
      .leftJoin(users, eq(doctors.userId, users.id))
      .where(eq(doctors.id, params.id))
      .limit(1);

    const doctorsService = new DoctorsService();
    const result = await doctorsService.deleteDoctor(params.id);
    
    if (result.success && existingDoctor.length > 0) {
      // Get request metadata
      const metadata = getRequestMetadata(req);
      const actorUserId = user.userId;
      const doctorName = `Dr. ${existingDoctor[0].firstName} ${existingDoctor[0].lastName}`;

      // Create comprehensive audit log
      await createAuditLog({
        userId: actorUserId,
        actorType: 'admin',
        action: 'delete',
        entityType: 'doctor',
        entityId: params.id,
        entityName: doctorName,
        httpMethod: 'DELETE',
        endpoint: `/api/doctors/${params.id}`,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        details: {
          doctorEmail: existingDoctor[0].userEmail,
          deletedAt: new Date().toISOString(),
        },
      });
    }
    
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

export const GET = getHandler;
export const PATCH = withAuthAndContext(patchHandler, ['doctor', 'admin']);
export const DELETE = withAuthAndContext(deleteHandler, ['admin']);
