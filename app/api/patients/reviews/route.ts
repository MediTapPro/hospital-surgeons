import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { PatientProfilesRepository } from '@/lib/repositories/patient-profiles.repository';
import { ReviewsService } from '@/lib/services/reviews.service';

/**
 * @swagger
 * /api/patients/reviews:
 *   get:
 *     summary: List the authenticated patient's own assignment reviews
 *     tags: [Patients, Reviews]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Patient reviews retrieved successfully }
 *       401: { description: Unauthorized }
 */
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const profile = await new PatientProfilesRepository().findProfileByUserId(req.user!.userId);
    if (!profile) return NextResponse.json({ success: false, message: 'Patient profile not found' }, { status: 404 });
    const params = req.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get('page') || 1));
    const limit = Math.min(50, Math.max(1, Number(params.get('limit') || 10)));
    const result = await new ReviewsService().list({ patientProfileId: profile.id, page, limit });
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error('GET /api/patients/reviews error:', error);
    return NextResponse.json({ success: false, message: 'Failed to load your reviews' }, { status: 500 });
  }
}, ['patient']);
