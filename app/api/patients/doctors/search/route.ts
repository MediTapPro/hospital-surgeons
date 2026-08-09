import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { PatientDoctorSearchQuerySchema } from '@/lib/validations/patient-doctor-search.dto';
import { PatientDoctorSearchService, LocationRequiredError } from '@/lib/services/patient-doctor-search.service';

/**
 * @swagger
 * /api/patients/doctors/search:
 *   get:
 *     summary: Search verified doctors for home visits by name, specialty or radius
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Free text search across doctor name or specialty name
 *       - in: query
 *         name: specialtyId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter doctors that have this specialty
 *       - in: query
 *         name: lat
 *         schema:
 *           type: number
 *           format: float
 *           minimum: -90
 *           maximum: 90
 *         description: Latitude of the search center. Optional — when omitted, the patient's default saved address is used.
 *       - in: query
 *         name: lon
 *         schema:
 *           type: number
 *           format: float
 *           minimum: -180
 *           maximum: 180
 *         description: Longitude of the search center. Optional — when omitted, the patient's default saved address is used.
 *       - in: query
 *         name: radius
 *         schema:
 *           type: integer
 *           default: 50
 *           minimum: 1
 *           maximum: 100
 *         description: Search radius in kilometers
 *       - in: query
 *         name: minRating
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 5
 *         description: Minimum average rating
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [distance, rating, experience]
 *           default: distance
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Defaults to asc for distance, desc for rating/experience
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 50
 *     responses:
 *       200:
 *         description: List of doctors matched by the search
 *       400:
 *         description: Invalid query parameters
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const searchParams = req.nextUrl.searchParams;

    const payload = {
      search: searchParams.get('search') || undefined,
      specialtyId: searchParams.get('specialtyId') || undefined,
      lat: searchParams.get('lat') || undefined,
      lon: searchParams.get('lon') || undefined,
      radius: searchParams.get('radius') || undefined,
      minRating: searchParams.get('minRating') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
      sortOrder: searchParams.get('sortOrder') || undefined,
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit'),
    };

    const parsed = PatientDoctorSearchQuerySchema.passthrough().safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        message: parsed.error.issues[0].message,
      }, { status: 400 });
    }

    const service = new PatientDoctorSearchService();
    const data = await service.search(req.user!.userId, parsed.data);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error in GET /api/patients/doctors/search:', error);
    const message = error instanceof Error ? error.message : 'Failed to search doctors';
    const status = error instanceof LocationRequiredError ? 400 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}, ['patient']);