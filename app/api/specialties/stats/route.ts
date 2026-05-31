import { NextRequest, NextResponse } from 'next/server';
import { SpecialtiesService } from '@/lib/services/specialties.service';
import { withAuth } from '@/lib/auth/middleware';

/**
 * @swagger
 * /api/specialties/stats:
 *   get:
 *     summary: Get statistics for all specialties (Admin only)
 *     tags: [Specialties]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Specialty statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
async function handler(req: NextRequest) {
  try {
    const specialtiesService = new SpecialtiesService();
    const result = await specialtiesService.getAllSpecialtiesStats();
    
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

export const GET = withAuth(handler, ['admin']);



































