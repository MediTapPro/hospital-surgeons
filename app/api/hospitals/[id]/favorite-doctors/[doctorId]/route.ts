import { NextRequest, NextResponse } from 'next/server';
import { HospitalsService } from '@/lib/services/hospitals.service';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';

/**
 * @swagger
 * /api/hospitals/{id}/favorite-doctors/{doctorId}:
 *   delete:
 *     summary: Remove a doctor from hospital's favorites
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
 *       - in: path
 *         name: doctorId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Doctor ID to remove from favorites
 *     responses:
 *       200:
 *         description: Favorite doctor removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Favorite doctor removed successfully"
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
async function deleteHandler(
  req: AuthenticatedRequest,
  context: { params: Promise<{ id: string; doctorId: string }> }
) {
  try {
    const params = await context.params;
    const hospitalsService = new HospitalsService();
    const result = await hospitalsService.removeFavoriteDoctor(params.id, params.doctorId);
    
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

export const DELETE = withAuthAndContext(deleteHandler, ['hospital', 'admin']);

