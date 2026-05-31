import { NextRequest, NextResponse } from 'next/server';
import { HospitalsService } from '@/lib/services/hospitals.service';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';

/**
 * @swagger
 * /api/hospitals/{id}/favorite-doctors:
 *   get:
 *     summary: Get hospital's favorite doctors
 *     tags: [Hospitals]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Hospital ID
 *     responses:
 *       200:
 *         description: List of favorite doctors
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 *   post:
 *     summary: Add a doctor to hospital's favorites
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - doctorId
 *             properties:
 *               doctorId:
 *                 type: string
 *                 format: uuid
 *                 description: Doctor ID to add to favorites
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       201:
 *         description: Favorite doctor added successfully
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
 *                   example: "Favorite doctor added successfully"
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
async function getHandler(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const hospitalsService = new HospitalsService();
    const result = await hospitalsService.getHospitalFavoriteDoctors(params.id);
    
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

async function postHandler(req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const body = await req.json();
    const hospitalsService = new HospitalsService();
    const result = await hospitalsService.addFavoriteDoctor(params.id, body);
    
    return NextResponse.json(result, { status: result.success ? 201 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

export const GET = getHandler;
export const POST = withAuthAndContext(postHandler, ['hospital', 'admin']);

