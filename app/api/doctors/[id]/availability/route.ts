import { NextRequest, NextResponse } from 'next/server';
import { DoctorsService } from '@/lib/services/doctors.service';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';
import { doctorAvailability } from '@/src/db/drizzle/migrations/schema';
import { eq, and, isNull, asc, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';

/**
 * @swagger
 * /api/doctors/{id}/availability:
 *   get:
 *     summary: Get all availability slots for a doctor
 *     tags: [Doctors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Doctor ID
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Optional date filter (YYYY-MM-DD)
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [hospital, home_visit]
 *         description: Optional slot type filter
 *       - in: query
 *         name: allSlots
 *         schema:
 *           type: boolean
 *         description: Return all slots (parent + sub-slots) in flat format
 *     responses:
 *       200:
 *         description: Availability slots retrieved successfully
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
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       doctorId:
 *                         type: string
 *                         format: uuid
 *                       slotDate:
 *                         type: string
 *                         format: date
 *                       startTime:
 *                         type: string
 *                         format: time
 *                       endTime:
 *                         type: string
 *                         format: time
 *                       status:
 *                         type: string
 *                         enum: [available, booked, blocked]
 *                       slotType:
 *                         type: string
 *                         enum: [hospital, home_visit]
 *                       type:
 *                         type: string
 *                         enum: [hospital, home_visit]
 *                       isManual:
 *                         type: boolean
 *       400:
 *         description: Bad request
 *   post:
 *     summary: Create a new availability slot for a doctor
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - slotDate
 *               - startTime
 *               - endTime
 *             properties:
 *               slotDate:
 *                 type: string
 *                 format: date
 *               startTime:
 *                 type: string
 *                 format: time
 *               endTime:
 *                 type: string
 *                 format: time
 *               templateId:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *               status:
 *                 type: string
 *                 enum: [available, booked, blocked]
 *                 default: available
 *               slotType:
 *                 type: string
 *                 enum: [hospital, home_visit]
 *                 default: hospital
 *               isManual:
 *                 type: boolean
 *                 default: false
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Availability slot created successfully
 *       400:
 *         description: Bad request (overlapping slot or invalid data)
 *       403:
 *         description: Insufficient permissions
 */
async function getHandler(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const type = searchParams.get('type') || searchParams.get('slotType');
    const allSlots = searchParams.get('allSlots') === 'true';
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');

    const shouldPaginate = pageParam !== null || limitParam !== null;
    const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
    const limit = limitParam ? Math.max(1, parseInt(limitParam, 10)) : 10;
    const offset = (page - 1) * limit;

    const { DoctorsRepository } = await import('@/lib/repositories/doctors.repository');
    const doctorsRepository = new DoctorsRepository();
    const db = getDb();

    if (allSlots) {
      const conditions = [
        eq(doctorAvailability.doctorId, params.id)
      ];

      if (date) {
        conditions.push(eq(doctorAvailability.slotDate, date));
      }

      if (type) {
        conditions.push(eq(doctorAvailability.slotType, type));
      }

      let allSlotsResult: any[];
      let total = 0;
      if (shouldPaginate) {
        const countResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(doctorAvailability)
          .where(and(...conditions));
        total = Number(countResult[0]?.count || 0);

        allSlotsResult = await db
          .select()
          .from(doctorAvailability)
          .where(and(...conditions))
          .orderBy(asc(doctorAvailability.slotDate), asc(doctorAvailability.startTime))
          .limit(limit)
          .offset(offset);
      } else {
        allSlotsResult = await db
          .select()
          .from(doctorAvailability)
          .where(and(...conditions))
          .orderBy(asc(doctorAvailability.slotDate), asc(doctorAvailability.startTime));
      }

      const formattedAllSlots = allSlotsResult.map((slot: any) => ({
        ...slot,
        type: slot.slotType,
      }));

      return NextResponse.json(
        {
          success: true,
          data: formattedAllSlots,
          ...(shouldPaginate && {
            pagination: {
              page,
              limit,
              total,
              totalPages: Math.ceil(total / limit),
            }
          })
        },
        { status: 200 }
      );
    }

    const conditions = [
      eq(doctorAvailability.doctorId, params.id),
      isNull(doctorAvailability.parentSlotId)
    ];

    if (date) {
      conditions.push(eq(doctorAvailability.slotDate, date));
    }

    if (type) {
      conditions.push(eq(doctorAvailability.slotType, type));
    }

    let parentSlots: any[];
    let total = 0;
    if (shouldPaginate) {
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(doctorAvailability)
        .where(and(...conditions));
      total = Number(countResult[0]?.count || 0);

      parentSlots = await db
        .select()
        .from(doctorAvailability)
        .where(and(...conditions))
        .orderBy(asc(doctorAvailability.startTime))
        .limit(limit)
        .offset(offset);
    } else {
      parentSlots = await db
        .select()
        .from(doctorAvailability)
        .where(and(...conditions))
        .orderBy(asc(doctorAvailability.startTime));
    }

    const result = await Promise.all(
      parentSlots.map(async (parentSlot) => {
        const subSlots = await doctorsRepository.getSubSlotsByParent(parentSlot.id);
        
        const bookedSubslots = subSlots
          .filter((subSlot: any) => subSlot.status === 'booked')
          .map((subSlot: any) => ({
            id: subSlot.id,
            start: subSlot.startTime,
            end: subSlot.endTime,
            slotType: subSlot.slotType,
            type: subSlot.slotType,
          }));

        return {
          parentSlot: {
            id: parentSlot.id,
            start: parentSlot.startTime,
            end: parentSlot.endTime,
            slotDate: parentSlot.slotDate,
            slotType: parentSlot.slotType,
            type: parentSlot.slotType,
          },
          bookedSubslots,
        };
      })
    );

    return NextResponse.json(
      {
        success: true,
        data: result,
        ...(shouldPaginate && {
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          }
        })
      },
      { status: 200 }
    );
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
    const doctorsService = new DoctorsService();
    const result = await doctorsService.addAvailability(params.id, body);
    
    return NextResponse.json(result, { status: result.success ? 201 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

export const GET = getHandler;
export const POST = withAuthAndContext(postHandler, ['doctor', 'admin']);

