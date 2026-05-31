import { NextResponse } from 'next/server';
import { DoctorsService } from '@/lib/services/doctors.service';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';

const doctorsService = new DoctorsService();

/**
 * @swagger
 * /api/doctors/{id}/availability/templates:
 *   get:
 *     summary: Get all availability templates for a doctor
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
 *     responses:
 *       200:
 *         description: Templates retrieved successfully
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
 *                       templateName:
 *                         type: string
 *                       startTime:
 *                         type: string
 *                         format: time
 *                       endTime:
 *                         type: string
 *                         format: time
 *                       recurrencePattern:
 *                         type: string
 *                         enum: [daily, weekly, monthly, custom]
 *                       recurrenceDays:
 *                         type: array
 *                         items:
 *                           type: string
 *                       validFrom:
 *                         type: string
 *                         format: date
 *                       validUntil:
 *                         type: string
 *                         format: date
 *                         nullable: true
 *       400:
 *         description: Bad request
 *   post:
 *     summary: Create a new availability template for a doctor
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
 *               - templateName
 *               - startTime
 *               - endTime
 *               - recurrencePattern
 *               - validFrom
 *             properties:
 *               templateName:
 *                 type: string
 *               startTime:
 *                 type: string
 *                 format: time
 *               endTime:
 *                 type: string
 *                 format: time
 *               recurrencePattern:
 *                 type: string
 *                 enum: [daily, weekly, monthly, custom]
 *               recurrenceDays:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Required for weekly pattern (e.g., ["mon", "wed", "fri"])
 *               validFrom:
 *                 type: string
 *                 format: date
 *               validUntil:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Template created successfully
 *       400:
 *         description: Bad request (overlapping template or invalid data)
 *       403:
 *         description: Insufficient permissions
 */

async function getHandler(_req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const result = await doctorsService.getDoctorAvailabilityTemplates(params.id);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
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
    const result = await doctorsService.createAvailabilityTemplate(params.id, body);
    return NextResponse.json(result, { status: result.success ? 201 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

export const GET = withAuthAndContext(getHandler, ['doctor', 'admin']);
export const POST = withAuthAndContext(postHandler, ['doctor', 'admin']);


