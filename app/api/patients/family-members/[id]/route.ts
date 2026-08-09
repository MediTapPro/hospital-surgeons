import { NextResponse } from 'next/server';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';
import { PatientProfilesService } from '@/lib/services/patient-profiles.service';
import { PatientFamilyMemberDtoSchema } from '@/lib/validations/patient-profile.dto';

/**
 * @swagger
 * /api/patients/family-members/{id}:
 *   put:
 *     summary: Update a specific saved family member by ID
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
 *         description: Saved family member ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               phone:
 *                 type: string
 *               relationship:
 *                 type: string
 *     responses:
 *       200:
 *         description: Family member updated successfully
 *       400:
 *         description: Validation failure
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Family member not found or unauthorized
 */
export const PUT = withAuthAndContext(async (
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const userId = req.user!.userId;
    const { id: memberId } = await params;
    const body = await req.json();

    const validation = PatientFamilyMemberDtoSchema.partial().safeParse(body);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        message: validation.error.issues[0].message,
      }, { status: 400 });
    }

    const service = new PatientProfilesService();
    const updated = await service.updateFamilyMember(userId, memberId, validation.data);

    return NextResponse.json({
      success: true,
      message: 'Family member updated successfully',
      data: updated,
    });
  } catch (error) {
    console.error('Error updating patient family member:', error);
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
 * /api/patients/family-members/{id}:
 *   delete:
 *     summary: Delete a specific saved family member by ID
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
 *         description: Saved family member ID
 *     responses:
 *       200:
 *         description: Family member deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Family member not found or unauthorized
 */
export const DELETE = withAuthAndContext(async (
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const userId = req.user!.userId;
    const { id: memberId } = await params;

    const service = new PatientProfilesService();
    const deleted = await service.deleteFamilyMember(userId, memberId);

    return NextResponse.json({
      success: true,
      message: 'Family member deleted successfully',
      data: deleted,
    });
  } catch (error) {
    console.error('Error deleting patient family member:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const status = errorMessage.includes('unauthorized') || errorMessage.includes('not found') ? 404 : 400;
    return NextResponse.json({
      success: false,
      message: errorMessage,
    }, { status });
  }
}, ['patient']);
