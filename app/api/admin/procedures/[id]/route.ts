import { NextResponse } from 'next/server';
import { ProceduresService } from '@/lib/services/procedures.service';
import { validateRequest } from '@/lib/utils/validate-request';
import { UpdateProcedureDtoSchema } from '@/lib/validations/procedure.dto';
import { getRequestMetadata } from '@/lib/utils/audit-logger';
import { withAuthAndContext, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { PROCEDURE_ERROR_STATUS } from '@/lib/enums/procedures.enums';
/**
 * @swagger
 * /api/admin/procedures/{id}:
 *   get:
 *     summary: Get a procedure (Admin)
 *     tags: [Admin, Procedures]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Procedure details, including assigned procedure type IDs
 *       401:
 *         description: Authorization header missing or invalid token
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Procedure not found
 *       500:
 *         description: Internal server error
 *
 *   put:
 *     summary: Update a procedure (Admin)
 *     description: >
 *       Update a procedure. Supplying `typeIds` replaces the procedure's pricing-type
 *       mappings entirely.
 *     tags: [Admin, Procedures]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               specialtyId: { type: string, format: uuid }
 *               categoryId: { type: string, format: uuid, nullable: true }
 *               name: { type: string }
 *               description: { type: string }
 *               isActive: { type: boolean }
 *               typeIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Procedure updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authorization header missing or invalid token
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Procedure not found
 *       409:
 *         description: A procedure with this name already exists for this specialty
 *       500:
 *         description: Internal server error
 *
 *   delete:
 *     summary: Delete a procedure (Admin)
 *     description: >
 *       Deletion is rejected while the procedure is referenced by a doctor procedure fee or an
 *       assignment. The procedure's own procedure type mappings cascade with it and are not
 *       treated as a blocking reference.
 *     tags: [Admin, Procedures]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Procedure deleted successfully
 *       401:
 *         description: Authorization header missing or invalid token
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Procedure not found
 *       409:
 *         description: Cannot delete procedure as it is referenced by dependent records
 *       500:
 *         description: Internal server error
 */

async function getHandler(
  req: AuthenticatedRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const result = await new ProceduresService().getProcedureById(id);

    if (!result.success) {
      return NextResponse.json(result, { status: PROCEDURE_ERROR_STATUS[result.code] ?? 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in GET /api/admin/procedures/[id]:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

async function putHandler(
  req: AuthenticatedRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const validation = await validateRequest(req, UpdateProcedureDtoSchema);
    if (!validation.success) {
      return validation.response;
    }

    const result = await new ProceduresService().updateProcedure(id, validation.data, {
      adminUserId: req.user!.userId,
      requestMetadata: getRequestMetadata(req),
    });

    if (!result.success) {
      return NextResponse.json(result, { status: PROCEDURE_ERROR_STATUS[result.code] ?? 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in PUT /api/admin/procedures/[id]:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

async function deleteHandler(
  req: AuthenticatedRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const result = await new ProceduresService().deleteProcedure(id, {
      adminUserId: req.user!.userId,
      requestMetadata: getRequestMetadata(req),
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: result.message,
          data: 'data' in result ? result.data : undefined,
        },
        { status: PROCEDURE_ERROR_STATUS[result.code] ?? 500 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in DELETE /api/admin/procedures/[id]:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuthAndContext(getHandler, ['admin']);
export const PUT = withAuthAndContext(putHandler, ['admin']);
export const DELETE = withAuthAndContext(deleteHandler, ['admin']);
