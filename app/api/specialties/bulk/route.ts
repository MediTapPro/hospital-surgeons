import { NextRequest, NextResponse } from 'next/server';
import { SpecialtiesService } from '@/lib/services/specialties.service';
import { withAuth } from '@/lib/auth/middleware';

/**
 * @swagger
 * /api/specialties/bulk:
 *   post:
 *     summary: Create multiple specialties in bulk (Admin only)
 *     tags: [Specialties]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               specialties:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *     responses:
 *       201:
 *         description: Specialties created successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
async function handler(req: NextRequest) {
  try {
    const body = await req.json();
    const specialtiesService = new SpecialtiesService();
    const result = await specialtiesService.createBulkSpecialties(body);
    
    return NextResponse.json(result, { status: result.success ? 201 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

export const POST = withAuth(handler, ['admin']);



































