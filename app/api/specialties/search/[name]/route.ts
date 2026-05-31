import { NextRequest, NextResponse } from 'next/server';
import { SpecialtiesService } from '@/lib/services/specialties.service';

/**
 * @swagger
 * /api/specialties/search/{name}:
 *   get:
 *     summary: Search for a specialty by name
 *     tags: [Specialties]
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Specialty name to search for
 *     responses:
 *       200:
 *         description: Specialty found
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
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ name: string }> }
) {
  try {
    const params = await context.params;
    const specialtiesService = new SpecialtiesService();
    const result = await specialtiesService.findSpecialtyByName(params.name);
    
    return NextResponse.json(result, { status: result.success ? 200 : 404 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}



































