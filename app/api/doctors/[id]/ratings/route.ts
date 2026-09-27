import { NextResponse } from 'next/server';
import { withAuthAndContext, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { DoctorsRepository } from '@/lib/repositories/doctors.repository';
import { ReviewsService } from '@/lib/services/reviews.service';

/**
 * @swagger
 * /api/doctors/{id}/ratings:
 *   get:
 *     summary: List ratings and reviews for a doctor
 *     tags: [Doctors, Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 50, default: 10 }
 *     responses:
 *       200: { description: Reviews retrieved successfully }
 *       403: { description: Doctor can only view their own reviews; patients may view public review content; admins may view any doctor }
 */
export const GET = withAuthAndContext(async (
  req: AuthenticatedRequest,
  context: { params: Promise<{ id: string }> },
) => {
  const { id } = await context.params;
  const { userId, userRole } = req.user!;
  const doctor = new DoctorsRepository();
  const ownDoctor = userRole === 'doctor' ? await doctor.findDoctorByUserId(userId) : null;
  if (userRole === 'doctor' && (!ownDoctor || ownDoctor.id !== id)) {
    return NextResponse.json({ success: false, message: 'You can only view your own reviews' }, { status: 403 });
  }

  const searchParams = req.nextUrl.searchParams;
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 10)));
  const result = await new ReviewsService().list({ doctorId: id, page, limit });
  if (userRole === 'patient' && result.success && result.data) {
    result.data = result.data.map((row: any) => ({
      ...row,
      hospital: null,
      patient: null,
    }));
  }
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}, ['doctor', 'admin', 'patient']);
