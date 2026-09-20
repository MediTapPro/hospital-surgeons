import { NextResponse } from 'next/server';
import { ProceduresService } from '@/lib/services/procedures.service';
import { validateRequest, validateQuery } from '@/lib/utils/validate-request';
import { CreateProcedureDtoSchema, ProceduresQuerySchema } from '@/lib/validations/procedure.dto';
import { getRequestMetadata } from '@/lib/utils/audit-logger';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { PROCEDURE_ERROR_STATUS } from '@/lib/enums/procedures.enums';
/**
 * @swagger
 * /api/admin/procedures:
 *   get:
 *     summary: List procedures (Admin)
 *     description: Retrieve medical procedures, optionally filtered by specialty, category, or name.
 *     tags: [Admin, Procedures]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: specialtyId
 *         schema: { type: string, format: uuid }
 *         description: Filter by specialty
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *         description: Filter by procedure category
 *       - in: query
 *         name: search
 *         schema: { type: string, maxLength: 100 }
 *         description: Case-insensitive search by procedure name
 *     responses:
 *       200:
 *         description: List of procedures
 *       400:
 *         description: Invalid query parameters
 *       401:
 *         description: Authorization header missing or invalid token
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 *
 *   post:
 *     summary: Create a procedure (Admin)
 *     tags: [Admin, Procedures]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [specialtyId, name]
 *             properties:
 *               specialtyId: { type: string, format: uuid }
 *               categoryId: { type: string, format: uuid }
 *               name: { type: string }
 *               description: { type: string }
 *               isActive: { type: boolean }
 *               typeIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Procedure created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authorization header missing or invalid token
 *       403:
 *         description: Insufficient permissions
 *       409:
 *         description: A procedure with this name already exists for this specialty
 *       500:
 *         description: Internal server error
 */

async function getHandler(req: AuthenticatedRequest) {
  const validation = validateQuery(req.nextUrl.searchParams, ProceduresQuerySchema);
  if (!validation.success) {
    return validation.response;
  }

  const { specialtyId, categoryId, search } = validation.data;

  try {
    const result = await new ProceduresService().getProcedures({
      specialtyId,
      categoryId,
      search: search || undefined,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in GET /api/admin/procedures:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

async function postHandler(req: AuthenticatedRequest) {
  try {
    const validation = await validateRequest(req, CreateProcedureDtoSchema);
    if (!validation.success) {
      return validation.response;
    }

    const result = await new ProceduresService().createProcedure(validation.data, {
      adminUserId: req.user!.userId,
      requestMetadata: getRequestMetadata(req),
    });

    if (!result.success) {
      return NextResponse.json(result, { status: PROCEDURE_ERROR_STATUS[result.code] ?? 500 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/admin/procedures:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler, ['admin', 'doctor']);
export const POST = withAuth(postHandler, ['admin']);
