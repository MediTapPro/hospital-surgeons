import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/utils/validate-request';
import { CreateSpecialtyDtoSchema } from '@/lib/validations/specialty.dto';
import { getRequestMetadata } from '@/lib/utils/audit-logger';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { SpecialtiesService } from '@/lib/services/specialties.service';
import {
  SPECIALTY_ERROR_CODES,
  SPECIALTY_LIST_DEFAULT_LIMIT,
  SPECIALTY_LIST_MAX_LIMIT,
  SPECIALTY_SORT_FIELDS,
  SPECIALTY_SORT_ORDERS,
  type SpecialtySortField,
  type SpecialtySortOrder,
} from '@/lib/enums/specialties.enums';
/**
 * @swagger
 * /api/admin/specialties:
 *   get:
 *     summary: List all specialties (Admin)
 *     description: Retrieve a paginated list of all medical specialties with usage counts.
 *     tags: [Admin, Specialties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 100
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Case-insensitive search by specialty name
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, id]
 *           default: name
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Paginated list of specialties
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
 *                     properties:
 *                       id: { type: string }
 *                       name: { type: string }
 *                       description: { type: string, nullable: true }
 *                       activeDoctors: { type: integer }
 *                       activeHospitals: { type: integer }
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     total: { type: integer }
 *                     totalPages: { type: integer }
 *       400:
 *         description: Invalid query parameters
 *       401:
 *         description: Authorization header missing or invalid token
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 *
 *   post:
 *     summary: Create a new specialty (Admin)
 *     description: Add a new medical specialty to the system.
 *     tags: [Admin, Specialties]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: Cardiology
 *               description:
 *                 type: string
 *                 example: Diseases and abnormalities of the heart.
 *     responses:
 *       201:
 *         description: Specialty created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authorization header missing or invalid token
 *       403:
 *         description: Insufficient permissions
 *       409:
 *         description: A specialty with this name already exists (case-insensitive)
 *       500:
 *         description: Internal server error
 */

async function getHandler(req: AuthenticatedRequest) {
  const searchParams = req.nextUrl.searchParams;
  const page = Number(searchParams.get('page') || 1);
  const limit = Number(searchParams.get('limit') || SPECIALTY_LIST_DEFAULT_LIMIT);
  const search = searchParams.get('search')?.trim() || undefined;
  const sortBy = (searchParams.get('sortBy') || 'name') as SpecialtySortField;
  const sortOrder = (searchParams.get('sortOrder') || 'asc') as SpecialtySortOrder;

  if (!Number.isInteger(page) || page < 1) {
    return NextResponse.json(
      { success: false, message: 'Page must be at least 1.' },
      { status: 400 }
    );
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > SPECIALTY_LIST_MAX_LIMIT) {
    return NextResponse.json(
      { success: false, message: `Limit must be between 1 and ${SPECIALTY_LIST_MAX_LIMIT}.` },
      { status: 400 }
    );
  }

  if (!SPECIALTY_SORT_FIELDS.includes(sortBy)) {
    return NextResponse.json(
      { success: false, message: `Invalid sort field. Must be one of: ${SPECIALTY_SORT_FIELDS.join(', ')}` },
      { status: 400 }
    );
  }

  if (!SPECIALTY_SORT_ORDERS.includes(sortOrder)) {
    return NextResponse.json(
      { success: false, message: `Invalid sort order. Must be one of: ${SPECIALTY_SORT_ORDERS.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    const result = await new SpecialtiesService().listForAdmin({
      page,
      limit,
      search,
      sortBy,
      sortOrder,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Error fetching specialties:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch specialties' },
      { status: 500 }
    );
  }
}

async function postHandler(req: AuthenticatedRequest) {
  try {
    const validation = await validateRequest(req, CreateSpecialtyDtoSchema);
    if (!validation.success) {
      return validation.response;
    }

    const result = await new SpecialtiesService().createSpecialtyForAdmin(validation.data, {
      adminUserId: req.user!.userId,
      requestMetadata: getRequestMetadata(req),
    });

    if (!result.success) {
      const status = result.code === SPECIALTY_ERROR_CODES.DUPLICATE_NAME ? 409 : 500;
      return NextResponse.json({ success: false, message: result.message }, { status });
    }

    return NextResponse.json(
      { success: true, message: result.message, data: result.data },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating specialty:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create specialty' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler, ['admin']);
export const POST = withAuth(postHandler, ['admin']);
