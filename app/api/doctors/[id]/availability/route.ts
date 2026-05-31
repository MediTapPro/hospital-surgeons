import { NextRequest, NextResponse } from 'next/server';
import { DoctorsService } from '@/lib/services/doctors.service';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';
import { doctorAvailability } from '@/src/db/drizzle/migrations/schema';
import { eq, and, isNull, asc } from 'drizzle-orm';
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
    const date = searchParams.get('date'); // Optional date filter
    const allSlots = searchParams.get('allSlots') === 'true'; // Return all slots (parent + sub-slots) in flat format

    const { DoctorsRepository } = await import('@/lib/repositories/doctors.repository');
    const doctorsRepository = new DoctorsRepository();
    const db = getDb();

    if (allSlots) {
      // Return all slots in flat format (for doctor's schedule page)
      const conditions = [
        eq(doctorAvailability.doctorId, params.id)
      ];

      if (date) {
        conditions.push(eq(doctorAvailability.slotDate, date));
      }

      const allSlotsResult = await db
        .select()
        .from(doctorAvailability)
        .where(and(...conditions))
        .orderBy(asc(doctorAvailability.slotDate), asc(doctorAvailability.startTime));

      return NextResponse.json(
        {
          success: true,
          data: allSlotsResult,
        },
        { status: 200 }
      );
    }

    // Default: Return parent slots with booked sub-slots (for hospital find-doctors)
    const conditions = [
      eq(doctorAvailability.doctorId, params.id),
      isNull(doctorAvailability.parentSlotId) // Only parent slots
    ];

    // If date is provided, filter by date
    if (date) {
      conditions.push(eq(doctorAvailability.slotDate, date));
    }

    // Fetch parent slots
    const parentSlots = await db
      .select()
      .from(doctorAvailability)
      .where(and(...conditions))
      .orderBy(asc(doctorAvailability.startTime));

    // For each parent slot, fetch its booked sub-slots
    const result = await Promise.all(
      parentSlots.map(async (parentSlot) => {
        const subSlots = await doctorsRepository.getSubSlotsByParent(parentSlot.id);
        
        // Filter only booked sub-slots
        const bookedSubslots = subSlots
          .filter(subSlot => subSlot.status === 'booked')
          .map(subSlot => ({
            id: subSlot.id,
            start: subSlot.startTime,
            end: subSlot.endTime,
          }));

        return {
          parentSlot: {
            id: parentSlot.id,
            start: parentSlot.startTime,
            end: parentSlot.endTime,
            slotDate: parentSlot.slotDate,
          },
          bookedSubslots,
        };
      })
    );

    return NextResponse.json(
      {
        success: true,
        data: result,
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

