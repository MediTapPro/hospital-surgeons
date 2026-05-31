import { NextRequest, NextResponse } from 'next/server';
import { FeesService } from '@/lib/services/fees.service';
import { HospitalsService } from '@/lib/services/hospitals.service';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { z } from 'zod';

const statusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['approved', 'rejected']),
  reason: z.string().optional(),
});

/**
 * @swagger
 * /api/hospitals/fees/status:
 *   post:
 *     summary: Approve or reject a fee proposal
 *     description: Update the status of a specific fee proposal for the authenticated hospital.
 *     tags: [Hospital Fees]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id, status]
 *             properties:
 *               id:
 *                 type: string
 *                 format: uuid
 *                 description: The ID of the fee proposal (doctor_procedure_fees.id)
 *               status:
 *                 type: string
 *                 enum: [approved, rejected]
 *               reason:
 *                 type: string
 *                 description: Reason for acceptance or rejection
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       400:
 *         description: Invalid request or update failed
 *       404:
 *         description: Fee proposal or hospital profile not found
 *       401:
 *         description: Unauthorized
 */
async function handler(req: AuthenticatedRequest) {
  try {
    const user = req.user!;

    const body = await req.json();
    const validated = statusSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ success: false, message: 'Invalid request data', errors: validated.error.issues }, { status: 400 });
    }

    const hospitalsService = new HospitalsService();
    const hospitalResult = await hospitalsService.findHospitalByUserId(user.userId);

    if (!hospitalResult.success || !hospitalResult.data) {
      return NextResponse.json({ success: false, message: 'Hospital profile not found' }, { status: 404 });
    }

    const hospitalId = (hospitalResult.data as any).id;
    const feesService = new FeesService();
    const result = await feesService.updateProposalStatus(validated.data.id, hospitalId, validated.data.status, validated.data.reason);

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error('Error in POST /api/hospitals/fees/status:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withAuth(handler, ['hospital']);
