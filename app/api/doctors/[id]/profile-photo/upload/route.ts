import { NextRequest, NextResponse } from 'next/server';
import { DoctorsService } from '@/lib/services/doctors.service';
import { FilesService } from '@/lib/services/files.service';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';

const PROFILE_PHOTO_BUCKET = 'images'; // Backend determines the bucket

/**
 * @swagger
 * /api/doctors/{id}/profile-photo/upload:
 *   post:
 *     summary: Upload profile photo and update doctor profile in one call
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Profile photo uploaded and updated successfully
 *       400:
 *         description: Bad request
 *       403:
 *         description: Insufficient permissions
 */
async function postHandler(req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: doctorId } = await context.params;
    const doctorsService = new DoctorsService();

    // Check authorization
    const user = req.user;
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (user.userRole === 'doctor') {
      const doctorResult = await doctorsService.findDoctorByUserId(user.userId);
      if (!doctorResult.success || !doctorResult.data) {
        return NextResponse.json(
          { success: false, message: 'Doctor profile not found' },
          { status: 404 }
        );
      }

      if (doctorResult.data.id !== doctorId) {
        return NextResponse.json(
          { success: false, message: 'Insufficient permissions' },
          { status: 403 }
        );
      }
    }

    // Check Content-Type to help mobile developers debug
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Invalid Content-Type. Expected multipart/form-data. Make sure you are sending FormData and not setting Content-Type header manually.',
          hint: 'For mobile: Use FormData/MultipartBody and let the HTTP client set Content-Type automatically with boundary.'
        },
        { status: 400 }
      );
    }

    // Parse form data
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (error) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Failed to parse form data. Ensure you are sending multipart/form-data with correct format.',
          error: error instanceof Error ? error.message : String(error),
          hint: 'Check that the file is properly formatted in FormData/MultipartBody.'
        },
        { status: 400 }
      );
    }

    // Extract and validate file
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'File is required',
          hint: 'Ensure you are appending the file to FormData with the field name "file". For React Native, use: formData.append("file", { uri, type, name })'
        },
        { status: 400 }
      );
    }

    // Check if file is actually a File object
    if (!(file instanceof File)) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Invalid file format',
          hint: 'File must be a proper File object. For React Native, ensure you are using the correct format: { uri, type, name }'
        },
        { status: 400 }
      );
    }

    // Validate file type (images only)
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { 
          success: false, 
          message: `Invalid file type: ${file.type}`,
          hint: `File must be an image. Allowed types: ${allowedTypes.join(', ')}`
        },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'File too large',
          hint: `File size must be less than 5MB. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`
        },
        { status: 400 }
      );
    }

    // Backend determines folder and bucket (frontend doesn't need to know)
    const folder = `doctor-profiles/${doctorId}`;
    const bucket = PROFILE_PHOTO_BUCKET;

    // Upload file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const filesService = new FilesService();
    const uploadResult = await filesService.uploadAndSave({
      buffer,
      filename: file.name,
      folder,
      mimetype: file.type,
      size: file.size,
      bucket,
      isPublic: true,
    });

    // Update doctor profile with new photo
    const updateResult = await doctorsService.updateDoctor(doctorId, {
      profilePhotoId: uploadResult.fileId,
    });

    if (!updateResult.success) {
      // If profile update fails, we could optionally delete the uploaded file
      // For now, we'll just return the error
      return NextResponse.json(
        { success: false, message: updateResult.message || 'Failed to update profile photo' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Profile photo uploaded and updated successfully',
      data: {
        fileId: uploadResult.fileId,
        url: uploadResult.url,
        filename: file.name,
        profilePhotoId: uploadResult.fileId,
      },
    }, { status: 200 });
  } catch (error) {
    console.error('Profile photo upload error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

export const POST = withAuthAndContext(postHandler, ['doctor', 'admin']);

