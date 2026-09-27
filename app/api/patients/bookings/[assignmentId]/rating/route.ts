import { NextResponse } from 'next/server';
import { withAuthAndContext, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { AssignmentRatingsService } from '@/lib/services/assignment-ratings.service';
import { CreateAssignmentRatingDtoSchema } from '@/lib/validations/assignment-rating.dto';

/**
 * @swagger
 * /api/patients/bookings/{assignmentId}/rating:
 *   post:
 *     summary: Rate a completed home visit
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rating]
 *             properties:
 *               rating: { type: integer, minimum: 1, maximum: 5 }
 *               reviewText: { type: string, maxLength: 2000 }
 *               positiveTags: { type: array, items: { type: string } }
 *               negativeTags: { type: array, items: { type: string } }
 *     responses:
 *       201: { description: Rating created successfully }
 *       409: { description: Visit is not completed or was already rated }
 *   patch:
 *     summary: Update the authenticated patient's home-visit rating
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Rating updated successfully }
 *       403: { description: Review belongs to another patient }
 *       404: { description: Review not found }
 */
export const POST = withAuthAndContext(async (
  req: AuthenticatedRequest,
  context: { params: Promise<{ assignmentId: string }> },
) => {
  const { assignmentId } = await context.params;
  const parsed = CreateAssignmentRatingDtoSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid rating' }, { status: 400 });
  }

  try {
    const result = await new AssignmentRatingsService().createPatientRating(
      assignmentId,
      req.user!.userId,
      parsed.data,
    );
    if (!result.success || !('rating' in result)) {
      return NextResponse.json({ success: false, message: result.message }, { status: result.status });
    }
    return NextResponse.json({
      success: true,
      data: {
        rating: result.rating,
        doctorSummary: result.doctorSummary,
      },
    }, { status: result.status });
  } catch (error) {
    console.error('POST /api/patients/bookings/[assignmentId]/rating error:', error);
    return NextResponse.json({ success: false, message: 'Failed to create rating' }, { status: 500 });
  }
}, ['patient']);

export const PATCH = withAuthAndContext(async (
  req: AuthenticatedRequest,
  context: { params: Promise<{ assignmentId: string }> },
) => {
  const { assignmentId } = await context.params;
  const parsed = CreateAssignmentRatingDtoSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid rating' }, { status: 400 });
  try {
    const result = await new AssignmentRatingsService().updatePatientRating(assignmentId, req.user!.userId, parsed.data);
    if (!result.success || !('rating' in result)) return NextResponse.json({ success: false, message: result.message }, { status: result.status });
    return NextResponse.json({ success: true, data: { rating: result.rating, doctorSummary: result.doctorSummary } }, { status: result.status });
  } catch (error) {
    console.error('PATCH /api/patients/bookings/[assignmentId]/rating error:', error);
    return NextResponse.json({ success: false, message: 'Failed to update rating' }, { status: 500 });
  }
}, ['patient']);
