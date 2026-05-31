import { NextRequest, NextResponse } from 'next/server';
import { HospitalsService } from '@/lib/services/hospitals.service';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';

/**
 * @swagger
 * /api/hospitals/{id}/staff/{staffId}:
 *   patch:
 *     summary: Update a staff member (Hospital/Admin only)
 *     tags: [Hospitals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Hospital ID
 *       - in: path
 *         name: staffId
 *         required: true
 *         schema:
 *           type: string
 *         description: Staff member ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Staff member updated successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *   delete:
 *     summary: Delete a staff member (Hospital/Admin only)
 *     tags: [Hospitals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Hospital ID
 *       - in: path
 *         name: staffId
 *         required: true
 *         schema:
 *           type: string
 *         description: Staff member ID
 *     responses:
 *       200:
 *         description: Staff member deleted successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
async function patchHandler(
  req: AuthenticatedRequest,
  context: { params: Promise<{ id: string; staffId: string }> }
) {
  try {
    const params = await context.params;
    const body = await req.json();
    const hospitalsService = new HospitalsService();
    const result = await hospitalsService.updateStaff(params.staffId, body);
    
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

async function deleteHandler(
  req: AuthenticatedRequest,
  context: { params: Promise<{ id: string; staffId: string }> }
) {
  try {
    const params = await context.params;
    const hospitalsService = new HospitalsService();
    const result = await hospitalsService.deleteStaff(params.staffId);
    
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

export const PATCH = withAuthAndContext(patchHandler, ['hospital', 'admin']);
export const DELETE = withAuthAndContext(deleteHandler, ['hospital', 'admin']);

