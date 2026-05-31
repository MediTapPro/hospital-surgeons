import { NextRequest, NextResponse } from 'next/server';
import { SpecialtiesService } from '@/lib/services/specialties.service';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';

/**
 * @swagger
 * /api/specialties/{id}/usage:
 *   get:
 *     summary: Get usage information for a specialty (Admin only)
 *     tags: [Specialties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Specialty ID
 *     responses:
 *       200:
 *         description: Specialty usage information retrieved successfully
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
 *         description: Specialty not found
 *       401:
 *         description: Unauthorized
 */
async function handler(req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const specialtiesService = new SpecialtiesService();
    const result = await specialtiesService.getSpecialtyUsageInfo(params.id);
    
    return NextResponse.json(result, { status: result.success ? 200 : 404 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

export const GET = withAuthAndContext(handler, ['admin']);

