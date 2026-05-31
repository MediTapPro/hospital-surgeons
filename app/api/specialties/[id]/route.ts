import { NextRequest, NextResponse } from 'next/server';
import { SpecialtiesService } from '@/lib/services/specialties.service';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';

/**
 * @swagger
 * /api/specialties/{id}:
 *   get:
 *     summary: Get specialty by ID
 *     tags: [Specialties]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Specialty ID
 *     responses:
 *       200:
 *         description: Specialty details
 *       404:
 *         description: Specialty not found
 *   patch:
 *     summary: Update specialty by ID (Admin only)
 *     tags: [Specialties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Specialty ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Specialty updated successfully
 *       403:
 *         description: Insufficient permissions
 *   delete:
 *     summary: Delete specialty by ID (Admin only)
 *     tags: [Specialties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Specialty ID
 *     responses:
 *       200:
 *         description: Specialty deleted successfully
 *       403:
 *         description: Insufficient permissions
 */
async function getHandler(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const specialtiesService = new SpecialtiesService();
    const result = await specialtiesService.findSpecialtyById(params.id);
    
    return NextResponse.json(result, { status: result.success ? 200 : 404 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

async function patchHandler(req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const body = await req.json();
    const specialtiesService = new SpecialtiesService();
    const result = await specialtiesService.updateSpecialty(params.id, body);
    
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

async function deleteHandler(req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const specialtiesService = new SpecialtiesService();
    const result = await specialtiesService.deleteSpecialty(params.id);
    
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

export const GET = getHandler;
export const PATCH = withAuthAndContext(patchHandler, ['admin']);
export const DELETE = withAuthAndContext(deleteHandler, ['admin']);
