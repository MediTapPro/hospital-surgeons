import { NextRequest, NextResponse } from 'next/server';
import { DoctorsService } from '@/lib/services/doctors.service';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';

const ALLOWED_TYPES = ['degree', 'certificate', 'license', 'other'];

/**
 * @swagger
 * /api/doctors/{id}/credentials:
 *   get:
 *     summary: Get all credentials for a doctor
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
 *         description: Credentials retrieved successfully
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
 *                       fileId:
 *                         type: string
 *                         format: uuid
 *                       credentialType:
 *                         type: string
 *                         enum: [degree, certificate, license, other]
 *                       title:
 *                         type: string
 *                       institution:
 *                         type: string
 *                         nullable: true
 *                       verificationStatus:
 *                         type: string
 *                         enum: [pending, verified, rejected]
 *                       uploadedAt:
 *                         type: string
 *                         format: date-time
 *                       file:
 *                         type: object
 *                         nullable: true
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Doctor not found
 *   post:
 *     summary: Upload a new credential for a doctor
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
 *               - fileId
 *               - credentialType
 *               - title
 *             properties:
 *               fileId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the uploaded file
 *               credentialType:
 *                 type: string
 *                 enum: [degree, certificate, license, other]
 *               title:
 *                 type: string
 *                 description: Title of the credential
 *               institution:
 *                 type: string
 *                 description: Institution that issued the credential
 *     responses:
 *       201:
 *         description: Credential uploaded successfully
 *       400:
 *         description: Bad request (missing required fields or invalid credential type)
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Doctor not found
 */

async function getHandler(req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: doctorId } = await context.params;
    const doctorsService = new DoctorsService();

    const authorizationResult = await ensureDoctorAccess(req, doctorId, doctorsService);
    if (!authorizationResult.allowed) {
      return NextResponse.json(
        { success: false, message: authorizationResult.message },
        { status: authorizationResult.status }
      );
    }

    const result = await doctorsService.getDoctorCredentials(doctorId);
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
    const { id: doctorId } = await context.params;
    const doctorsService = new DoctorsService();

    const authorizationResult = await ensureDoctorAccess(req, doctorId, doctorsService);
    if (!authorizationResult.allowed) {
      return NextResponse.json(
        { success: false, message: authorizationResult.message },
        { status: authorizationResult.status }
      );
    }

    const body = await req.json();
    if (!body?.fileId || !body?.credentialType || !body?.title) {
      return NextResponse.json(
        { success: false, message: 'fileId, credentialType and title are required' },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(body.credentialType)) {
      return NextResponse.json(
        { success: false, message: 'Invalid credential type' },
        { status: 400 }
      );
    }

    const payload = {
      fileId: body.fileId,
      credentialType: body.credentialType,
      title: body.title,
      institution: body.institution,
      verificationStatus: 'pending' as const,
    };

    const result = await doctorsService.addCredential(doctorId, payload);
    return NextResponse.json(result, { status: result.success ? 201 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

async function ensureDoctorAccess(
  req: AuthenticatedRequest,
  doctorId: string,
  doctorsService: DoctorsService
) {
  const user = req.user;
  if (!user) {
    return { allowed: false, status: 401, message: 'Unauthorized' };
  }

  if (user.userRole === 'doctor') {
    const doctorResult = await doctorsService.findDoctorByUserId(user.userId);
    if (!doctorResult.success || !doctorResult.data) {
      return { allowed: false, status: 404, message: 'Doctor profile not found' };
    }

    if (doctorResult.data.id !== doctorId) {
      return { allowed: false, status: 403, message: 'Insufficient permissions' };
    }
  }

  return { allowed: true, status: 200 };
}

export const GET = withAuthAndContext(getHandler, ['doctor', 'admin']);
export const POST = withAuthAndContext(postHandler, ['doctor', 'admin']);

