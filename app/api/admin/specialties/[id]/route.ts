import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/utils/validate-request';
import { UpdateSpecialtyDtoSchema } from '@/lib/validations/specialty.dto';
import { getRequestMetadata } from '@/lib/utils/audit-logger';
import { withAuthAndContext, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { SpecialtiesService } from '@/lib/services/specialties.service';
import { SPECIALTY_ERROR_CODES } from '@/lib/enums/specialties.enums';
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
 *       401:
 *         description: Authorization header missing or invalid token
 *       403:
 *         description: Insufficient permissions
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
 *       401:
 *         description: Authorization header missing or invalid token
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Specialty not found
 *       409:
 *         description: A specialty with this name already exists (case-insensitive)
 *       500:
 *         description: Internal server error
 *
 *   delete:
 *     summary: Delete specialty (Admin)
 *     description: >
 *       Remove a specialty. Deletion is rejected while the specialty is referenced by any
 *       doctor specialty, hospital department, procedure category, procedure, assignment,
 *       doctor procedure fee, or platform home-visit fee configuration. Six of those
 *       relationships cascade on delete, so this check prevents silently destroying
 *       referencing rows.
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
 *       401:
 *         description: Authorization header missing or invalid token
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Specialty not found
 *       409:
 *         description: Cannot delete specialty as it is currently referenced by dependent records
 *       500:
 *         description: Internal server error
 */

async function getHandler(
  req: AuthenticatedRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const result = await new SpecialtiesService().getSpecialtyForAdmin(id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error fetching specialty:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch specialty' },
      { status: 500 }
    );
  }
}

async function putHandler(
  req: AuthenticatedRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const validation = await validateRequest(req, UpdateSpecialtyDtoSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { id } = await context.params;
    const result = await new SpecialtiesService().updateSpecialtyForAdmin(id, validation.data, {
      adminUserId: req.user!.userId,
      requestMetadata: getRequestMetadata(req),
    });

    if (!result.success) {
      const status =
        result.code === SPECIALTY_ERROR_CODES.NOT_FOUND
          ? 404
          : result.code === SPECIALTY_ERROR_CODES.DUPLICATE_NAME
            ? 409
            : 500;

      return NextResponse.json({ success: false, message: result.message }, { status });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    console.error('Error updating specialty:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update specialty' },
      { status: 500 }
    );
  }
}

async function deleteHandler(
  req: AuthenticatedRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const result = await new SpecialtiesService().deleteSpecialtyForAdmin(id, {
      adminUserId: req.user!.userId,
      requestMetadata: getRequestMetadata(req),
    });

    if (!result.success) {
      const status =
        result.code === SPECIALTY_ERROR_CODES.NOT_FOUND
          ? 404
          : result.code === SPECIALTY_ERROR_CODES.SPECIALTY_IN_USE
            ? 409
            : 500;

      return NextResponse.json(
        {
          success: false,
          message: result.message,
          data: 'data' in result ? result.data : undefined,
        },
        { status }
      );
    }

    return NextResponse.json({ success: true, message: result.message });
  } catch (error) {
    console.error('Error deleting specialty:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete specialty' },
      { status: 500 }
    );
  }
}

export const GET = withAuthAndContext(getHandler, ['admin']);
export const PUT = withAuthAndContext(putHandler, ['admin']);
export const DELETE = withAuthAndContext(deleteHandler, ['admin']);
