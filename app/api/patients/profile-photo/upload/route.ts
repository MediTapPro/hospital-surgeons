import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { PatientProfilePhotosService } from '@/lib/services/patient-profile-photos.service';
import {
  PATIENT_PROFILE_PHOTO_ALLOWED_MIME_TYPES,
  PATIENT_PROFILE_PHOTO_MAX_SIZE_BYTES,
} from '@/lib/utils/constants';

/**
 * @swagger
 * /api/patients/profile-photo/upload:
 *   post:
 *     summary: Upload and set the signed-in patient's profile photo
 *     tags: [Patients]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200: { description: Profile photo uploaded successfully }
 *       400: { description: Invalid image or upload request }
 *       401: { description: Authentication required }
 */
export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const contentType = req.headers.get('content-type') ?? '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { success: false, message: 'Expected a multipart/form-data request.' },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: 'A profile image file is required.' }, { status: 400 });
    }

    if (!PATIENT_PROFILE_PHOTO_ALLOWED_MIME_TYPES.includes(
      file.type as (typeof PATIENT_PROFILE_PHOTO_ALLOWED_MIME_TYPES)[number]
    )) {
      return NextResponse.json({ success: false, message: 'Profile photo must be a JPG, PNG, or WebP image.' }, { status: 400 });
    }

    if (file.size > PATIENT_PROFILE_PHOTO_MAX_SIZE_BYTES) {
      return NextResponse.json({ success: false, message: 'Profile photo must be 5 MB or smaller.' }, { status: 400 });
    }

    const uploadResult = await new PatientProfilePhotosService().upload(req.user!.userId, file);

    return NextResponse.json({
      success: true,
      message: 'Profile photo updated successfully.',
      data: {
        fileId: uploadResult.fileId,
        profilePhotoId: uploadResult.fileId,
        url: uploadResult.url,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Unable to upload profile photo.', error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}, ['patient']);
