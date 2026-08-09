import { NextResponse } from 'next/server';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';
import { PatientProfilesService } from '@/lib/services/patient-profiles.service';
import { PatientAddressDtoSchema } from '@/lib/validations/patient-profile.dto';

/**
 * @swagger
 * /api/patients/addresses/{id}:
 *   put:
 *     summary: Update a specific saved address by ID
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Saved address ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               label:
 *                 type: string
 *               addressText:
 *                 type: string
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *               isDefault:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Address updated successfully
 *       400:
 *         description: Validation failure
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Address not found or unauthorized
 */
export const PUT = withAuthAndContext(async (
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const userId = req.user!.userId;
    const { id: addressId } = await params;
    const body = await req.json();

    const validation = PatientAddressDtoSchema.partial().safeParse(body);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        message: validation.error.issues[0].message,
      }, { status: 400 });
    }

    const service = new PatientProfilesService();
    const updated = await service.updateAddress(userId, addressId, validation.data);

    return NextResponse.json({
      success: true,
      message: 'Address updated successfully',
      data: updated,
    });
  } catch (error) {
    console.error('Error updating patient address:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const status = errorMessage.includes('unauthorized') || errorMessage.includes('not found') ? 404 : 400;
    return NextResponse.json({
      success: false,
      message: errorMessage,
    }, { status });
  }
}, ['patient']);

/**
 * @swagger
 * /api/patients/addresses/{id}:
 *   delete:
 *     summary: Delete a specific saved address by ID
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Saved address ID
 *     responses:
 *       200:
 *         description: Address deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Address not found or unauthorized
 */
export const DELETE = withAuthAndContext(async (
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const userId = req.user!.userId;
    const { id: addressId } = await params;

    const service = new PatientProfilesService();
    const deleted = await service.deleteAddress(userId, addressId);

    return NextResponse.json({
      success: true,
      message: 'Address deleted successfully',
      data: deleted,
    });
  } catch (error) {
    console.error('Error deleting patient address:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const status = errorMessage.includes('unauthorized') || errorMessage.includes('not found') ? 404 : 400;
    return NextResponse.json({
      success: false,
      message: errorMessage,
    }, { status });
  }
}, ['patient']);
