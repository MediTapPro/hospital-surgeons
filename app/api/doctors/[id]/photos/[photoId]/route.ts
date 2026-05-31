import { NextRequest, NextResponse } from 'next/server';
import { DoctorsService } from '@/lib/services/doctors.service';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';

/**
 * @swagger
 * /api/doctors/{id}/photos/{photoId}:
 *   patch:
 *     summary: Set a photo as primary profile photo
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
 *         name: photoId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Photo ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isPrimary
 *             properties:
 *               isPrimary:
 *                 type: boolean
 *                 description: Set to true to make this the primary photo
 *     responses:
 *       200:
 *         description: Photo updated successfully
 *       400:
 *         description: Bad request
 *       403:
 *         description: Insufficient permissions
 *   delete:
 *     summary: Delete a profile photo
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
 *         name: photoId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Photo ID
 *     responses:
 *       200:
 *         description: Photo deleted successfully
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Photo not found
 */
async function patchHandler(req: AuthenticatedRequest, context: { params: Promise<{ id: string; photoId: string }> }) {
  try {
    const { id: doctorId, photoId } = await context.params;
    const doctorsService = new DoctorsService();

    const authorizationResult = await ensureDoctorAccess(req, doctorId, doctorsService);
    if (!authorizationResult.allowed) {
      return NextResponse.json(
        { success: false, message: authorizationResult.message },
        { status: authorizationResult.status }
      );
    }

    const body = await req.json();
    if (body.isPrimary === true) {
      const result = await doctorsService.setPrimaryPhoto(doctorId, photoId);
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    return NextResponse.json(
      { success: false, message: 'Invalid operation' },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

async function deleteHandler(req: AuthenticatedRequest, context: { params: Promise<{ id: string; photoId: string }> }) {
  try {
    const { id: doctorId, photoId } = await context.params;
    const doctorsService = new DoctorsService();

    const authorizationResult = await ensureDoctorAccess(req, doctorId, doctorsService);
    if (!authorizationResult.allowed) {
      return NextResponse.json(
        { success: false, message: authorizationResult.message },
        { status: authorizationResult.status }
      );
    }

    const result = await doctorsService.deleteProfilePhoto(doctorId, photoId);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
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

export const PATCH = withAuthAndContext(patchHandler, ['doctor', 'admin']);
export const DELETE = withAuthAndContext(deleteHandler, ['doctor', 'admin']);

