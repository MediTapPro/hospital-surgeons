import { NextResponse } from 'next/server';
import { DoctorsService } from '@/lib/services/doctors.service';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';

const doctorsService = new DoctorsService();

/**
 * @swagger
 * /api/doctors/{id}/availability/templates/{templateId}:
 *   patch:
 *     summary: Update an availability template
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
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Template ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
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
 *               validFrom:
 *                 type: string
 *                 format: date
 *               validUntil:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Template updated successfully
 *       400:
 *         description: Bad request (overlapping template or invalid data)
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Template not found
 *   delete:
 *     summary: Delete an availability template
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
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Template ID
 *     responses:
 *       200:
 *         description: Template deleted successfully
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Template not found
 */

async function patchHandler(
  req: AuthenticatedRequest,
  context: { params: Promise<{ id: string; templateId: string }> }
) {
  try {
    const params = await context.params;
    const body = await req.json();
    const result = await doctorsService.updateAvailabilityTemplate(params.id, params.templateId, body);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

async function deleteHandler(
  _req: AuthenticatedRequest,
  context: { params: Promise<{ id: string; templateId: string }> }
) {
  try {
    const params = await context.params;
    const result = await doctorsService.deleteAvailabilityTemplate(params.id, params.templateId);
    return NextResponse.json(result, { status: result.success ? 200 : 404 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

export const PATCH = withAuthAndContext(patchHandler, ['doctor', 'admin']);
export const DELETE = withAuthAndContext(deleteHandler, ['doctor', 'admin']);


