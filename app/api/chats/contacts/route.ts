import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getDb } from '@/lib/db';
import { doctors, hospitals } from '@/src/db/drizzle/migrations/schema';
import { ilike, or, gt, asc, sql } from 'drizzle-orm';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * @swagger
 * /api/chats/contacts:
 *   get:
 *     summary: List chat contacts
 *     description: Returns hospitals if the user is a doctor, or doctors if the user is a hospital.
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or city
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Contacts retrieved successfully
 *       403:
 *         description: Invalid role
 *       500:
 *         description: Internal server error
 */
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { userRole } = req.user!;
    const db = getDb();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim() ?? '';
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10)));
    const offset = (page - 1) * limit;

    if (userRole === 'doctor') {
      const conditions = search
        ? or(
            ilike(hospitals.name, `%${search}%`),
            ilike(hospitals.city, `%${search}%`),
          )
        : undefined;

      const [rows, countRow] = await Promise.all([
        db
          .select({ id: hospitals.id, name: hospitals.name, city: hospitals.city, logoId: hospitals.logoId })
          .from(hospitals)
          .where(conditions)
          .orderBy(asc(hospitals.name))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(hospitals)
          .where(conditions),
      ]);

      const total = countRow[0]?.count ?? 0;

      return NextResponse.json({
        success: true,
        data: rows.map(h => ({ id: h.id, name: h.name, city: h.city, logoId: h.logoId, type: 'hospital' })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });

    } else if (userRole === 'hospital') {
      const conditions = search
        ? or(
            ilike(doctors.firstName, `%${search}%`),
            ilike(doctors.lastName, `%${search}%`),
            ilike(doctors.city, `%${search}%`),
          )
        : undefined;

      const [rows, countRow] = await Promise.all([
        db
          .select({ id: doctors.id, firstName: doctors.firstName, lastName: doctors.lastName, city: doctors.city, profilePhotoId: doctors.profilePhotoId })
          .from(doctors)
          .where(conditions)
          .orderBy(asc(doctors.firstName), asc(doctors.lastName))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(doctors)
          .where(conditions),
      ]);

      const total = countRow[0]?.count ?? 0;

      return NextResponse.json({
        success: true,
        data: rows.map(d => ({
          id: d.id,
          name: `Dr. ${d.firstName} ${d.lastName}`.trim(),
          city: d.city,
          profilePhotoId: d.profilePhotoId,
          type: 'doctor',
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    }

    return NextResponse.json({ success: false, message: 'Invalid role' }, { status: 403 });
  } catch (error) {
    console.error('GET /api/chats/contacts error:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch contacts' }, { status: 500 });
  }
}, ['doctor', 'hospital']);
