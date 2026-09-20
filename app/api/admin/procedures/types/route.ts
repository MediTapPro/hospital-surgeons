import { NextResponse } from 'next/server';
import { ProceduresService } from '@/lib/services/procedures.service';
import { validateQuery } from '@/lib/utils/validate-request';
import { ProcedureTypesQuerySchema } from '@/lib/validations/procedure.dto';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
/**
 * @swagger
 * /api/admin/procedures/types:
 *   get:
 *     summary: List procedure types (Admin)
 *     description: Retrieve the pricing-option procedure types, optionally restricted to the types assigned to one procedure.
 *     tags: [Admin, Procedures]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: procedureId
 *         schema: { type: string, format: uuid }
 *         description: Only return the types mapped to this procedure
 *     responses:
 *       200:
 *         description: List of procedure types
 *       400:
 *         description: Invalid query parameters
 *       401:
 *         description: Authorization header missing or invalid token
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */

export const dynamic = 'force-dynamic';

async function getHandler(req: AuthenticatedRequest) {
  const validation = validateQuery(req.nextUrl.searchParams, ProcedureTypesQuerySchema);
  if (!validation.success) {
    return validation.response;
  }

  try {
    const result = await new ProceduresService().getProcedureTypes(validation.data.procedureId);

    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching procedure types:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch procedure types' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler, ['admin', 'doctor']);
