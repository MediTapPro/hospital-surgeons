import { NextRequest, NextResponse } from 'next/server';
import { SpecialtiesService } from '@/lib/services/specialties.service';

/**
 * @swagger
 * /api/specialties/active:
 *   get:
 *     summary: Get all active specialties
 *     tags: [Specialties]
 *     responses:
 *       200:
 *         description: List of active specialties
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 */
export async function GET(req: NextRequest) {
  try {
    const specialtiesService = new SpecialtiesService();
    const result = await specialtiesService.getActiveSpecialties();
    
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}



































