import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { PatientProfilesService } from '@/lib/services/patient-profiles.service';
import { PatientFamilyMemberDtoSchema } from '@/lib/validations/patient-profile.dto';

/**
 * @swagger
 * /api/patients/family-members:
 *   get:
 *     summary: Get logged-in patient's saved family members
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of saved family members
 *       401:
 *         description: Unauthorized
 */
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const userId = req.user!.userId;
    const service = new PatientProfilesService();
    const members = await service.getFamilyMembers(userId);

    return NextResponse.json({
      success: true,
      data: members,
    });
  } catch (error) {
    console.error('Error fetching patient family members:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      success: false,
      message: errorMessage,
    }, { status: 400 });
  }
}, ['patient']);

/**
 * @swagger
 * /api/patients/family-members:
 *   post:
 *     summary: Add a new saved family member for the logged-in patient
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - phone
 *               - relationship
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: "Jane Doe Jr."
 *               phone:
 *                 type: string
 *                 example: "9876543211"
 *               relationship:
 *                 type: string
 *                 example: "Child"
 *     responses:
 *       201:
 *         description: Family member saved successfully
 *       400:
 *         description: Validation failure
 *       401:
 *         description: Unauthorized
 */
export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const userId = req.user!.userId;
    const body = await req.json();

    const validation = PatientFamilyMemberDtoSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        message: validation.error.issues[0].message,
      }, { status: 400 });
    }

    const service = new PatientProfilesService();
    const createdMember = await service.addFamilyMember(userId, validation.data);

    return NextResponse.json({
      success: true,
      message: 'Family member saved successfully',
      data: createdMember,
    }, { status: 201 });
  } catch (error) {
    console.error('Error adding patient family member:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      success: false,
      message: errorMessage,
    }, { status: 400 });
  }
}, ['patient']);
