import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { PatientProfilesService } from '@/lib/services/patient-profiles.service';
import { PatientAddressDtoSchema } from '@/lib/validations/patient-profile.dto';

/**
 * @swagger
 * /api/patients/addresses:
 *   get:
 *     summary: Get logged-in patient's saved addresses
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of saved addresses
 *       401:
 *         description: Unauthorized
 */
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const userId = req.user!.userId;
    const service = new PatientProfilesService();
    const addresses = await service.getAddresses(userId);

    return NextResponse.json({
      success: true,
      data: addresses,
    });
  } catch (error) {
    console.error('Error fetching patient addresses:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      success: false,
      message: errorMessage,
    }, { status: 400 });
  }
}, ['patient']);

/**
 * @swagger
 * /api/patients/addresses:
 *   post:
 *     summary: Add a new saved address for the logged-in patient
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
 *               - label
 *               - addressText
 *             properties:
 *               label:
 *                 type: string
 *                 example: "Home"
 *               addressText:
 *                 type: string
 *                 example: "123 Main St, Bandra, Mumbai"
 *               latitude:
 *                 type: number
 *                 example: 19.076
 *               longitude:
 *                 type: number
 *                 example: 72.877
 *               isDefault:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: Address saved successfully
 *       400:
 *         description: Validation failure
 *       401:
 *         description: Unauthorized
 */
export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const userId = req.user!.userId;
    const body = await req.json();

    const validation = PatientAddressDtoSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        message: validation.error.issues[0].message,
      }, { status: 400 });
    }

    const service = new PatientProfilesService();
    const createdAddress = await service.addAddress(userId, validation.data);

    return NextResponse.json({
      success: true,
      message: 'Address saved successfully',
      data: createdAddress,
    }, { status: 201 });
  } catch (error) {
    console.error('Error adding patient address:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      success: false,
      message: errorMessage,
    }, { status: 400 });
  }
}, ['patient']);
