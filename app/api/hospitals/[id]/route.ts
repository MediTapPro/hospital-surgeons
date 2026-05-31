import { NextRequest, NextResponse } from 'next/server';
import { HospitalsService } from '@/lib/services/hospitals.service';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';
import { createAuditLog, getRequestMetadata, buildChangesObject } from '@/lib/utils/audit-logger';
import { getDb } from '@/lib/db';
import { hospitals, users } from '@/src/db/drizzle/migrations/schema';
import { eq } from 'drizzle-orm';

/**
 * @swagger
 * /api/hospitals/{id}:
 *   get:
 *     summary: Get hospital by ID
 *     tags: [Hospitals]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Hospital ID
 *     responses:
 *       200:
 *         description: Hospital details
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
 *         description: Hospital not found
 *   patch:
 *     summary: Update hospital by ID
 *     tags: [Hospitals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Hospital ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               hospitalType:
 *                 type: string
 *               registrationNumber:
 *                 type: string
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               phone:
 *                 type: string
 *               website:
 *                 type: string
 *               numberOfBeds:
 *                 type: number
 *               latitude:
 *                 type: number
 *                 description: Optional - Only used if provided by frontend
 *               longitude:
 *                 type: number
 *                 description: Optional - Only used if provided by frontend
 *     responses:
 *       200:
 *         description: Hospital updated successfully
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Hospital not found
 *   delete:
 *     summary: Delete hospital by ID (Admin only)
 *     tags: [Hospitals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Hospital ID
 *     responses:
 *       200:
 *         description: Hospital deleted successfully
 *       403:
 *         description: Insufficient permissions
 */
async function getHandler(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const hospitalsService = new HospitalsService();
    const result = await hospitalsService.findHospitalById(params.id);
    
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
    const { UpdateHospitalDtoSchema } = await import('@/lib/validations/hospital.dto');
    const { validateRequest } = await import('@/lib/utils/validate-request');
    
    const validation = await validateRequest(req, UpdateHospitalDtoSchema);
    if (!validation.success) {
      return validation.response;
    }
    
    if (user.userRole !== 'admin') {
      const hospitalsService = new HospitalsService();
      const hospitalResult = await hospitalsService.findHospitalByUserId(user.userId);
      if (!hospitalResult.success || hospitalResult.data?.id !== params.id) {
        return NextResponse.json(
          { success: false, message: 'Insufficient permissions' },
          { status: 403 }
        );
      }
    }

    // Get existing hospital data for audit log
    const db = getDb();
    const existingHospital = await db
      .select({
        id: hospitals.id,
        name: hospitals.name,
        userId: hospitals.userId,
        registrationNumber: hospitals.registrationNumber,
        userEmail: users.email,
      })
      .from(hospitals)
      .leftJoin(users, eq(hospitals.userId, users.id))
      .where(eq(hospitals.id, params.id))
      .limit(1);

    const hospitalsService = new HospitalsService();
    const result = await hospitalsService.updateHospital(params.id, validation.data);
    
    if (result.success && existingHospital.length > 0) {
      // Get request metadata
      const metadata = getRequestMetadata(req);
      const actorUserId = user.userId;
      const hospitalName = existingHospital[0].name;

      // Build changes object
      const oldData: any = {
        name: existingHospital[0].name,
        registrationNumber: existingHospital[0].registrationNumber,
      };
      const newData: any = {
        name: validation.data.name,
        registrationNumber: validation.data.registrationNumber,
      };
      const changes = buildChangesObject(oldData, newData, Object.keys(validation.data));

      // Create comprehensive audit log
      await createAuditLog({
        userId: actorUserId,
        actorType: user.userRole === 'admin' ? 'admin' : 'user',
        action: 'update',
        entityType: 'hospital',
        entityId: params.id,
        entityName: hospitalName,
        httpMethod: 'PATCH',
        endpoint: `/api/hospitals/${params.id}`,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        changes: changes,
        details: {
          hospitalEmail: existingHospital[0].userEmail,
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
    
    // Get existing hospital data for audit log
    const db = getDb();
    const existingHospital = await db
      .select({
        id: hospitals.id,
        name: hospitals.name,
        userId: hospitals.userId,
        userEmail: users.email,
      })
      .from(hospitals)
      .leftJoin(users, eq(hospitals.userId, users.id))
      .where(eq(hospitals.id, params.id))
      .limit(1);

    const hospitalsService = new HospitalsService();
    const result = await hospitalsService.deleteHospital(params.id);
    
    if (result.success && existingHospital.length > 0) {
      // Get request metadata
      const metadata = getRequestMetadata(req);
      const actorUserId = user.userId;
      const hospitalName = existingHospital[0].name;

      // Create comprehensive audit log
      await createAuditLog({
        userId: actorUserId,
        actorType: 'admin',
        action: 'delete',
        entityType: 'hospital',
        entityId: params.id,
        entityName: hospitalName,
        httpMethod: 'DELETE',
        endpoint: `/api/hospitals/${params.id}`,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        details: {
          hospitalEmail: existingHospital[0].userEmail,
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
export const PATCH = withAuthAndContext(patchHandler, ['hospital', 'admin']);
export const DELETE = withAuthAndContext(deleteHandler, ['admin']);
