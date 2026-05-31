import { NextRequest, NextResponse } from 'next/server';
import { DoctorsService } from '@/lib/services/doctors.service';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';

/**
 * @swagger
 * /api/doctors/{id}/specialties/{specialtyId}:
 *   delete:
 *     summary: Remove a specialty from a doctor
 *     tags: [Doctors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Doctor ID
 *       - in: path
 *         name: specialtyId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Specialty ID to remove
 *     responses:
 *       200:
 *         description: Specialty removed successfully
 *       400:
 *         description: Bad request
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Specialty not found
 */
async function deleteHandler(
  req: AuthenticatedRequest,
  context: { params: Promise<{ id: string; specialtyId: string }> }
) {
  try {
    const params = await context.params;
    const doctorsService = new DoctorsService();
    const result = await doctorsService.removeSpecialty(params.id, params.specialtyId);
    
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

export const DELETE = withAuthAndContext(deleteHandler, ['doctor', 'admin']);

