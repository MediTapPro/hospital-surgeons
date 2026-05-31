import { NextRequest, NextResponse } from 'next/server';
import { HospitalsService } from '@/lib/services/hospitals.service';
import { FilesService } from '@/lib/services/files.service';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';

const LOGO_BUCKET = 'images'; // Backend determines the bucket

/**
 * @swagger
 * /api/hospitals/{id}/logo/upload:
 *   post:
 *     summary: Upload hospital logo and update hospital profile in one call
 *     tags: [Hospitals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Hospital ID
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
 *         description: Logo uploaded and updated successfully
 *       400:
 *         description: Bad request
 *       403:
 *         description: Insufficient permissions
 */
async function postHandler(req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: hospitalId } = await context.params;
    const hospitalsService = new HospitalsService();

    // Check authorization
    const user = req.user;
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Ensure hospital access
    if (user.userRole === 'hospital') {
      const hospitalResult = await hospitalsService.findHospitalByUserId(user.userId);
      if (!hospitalResult.success || !hospitalResult.data) {
        return NextResponse.json(
          { success: false, message: 'Hospital profile not found' },
          { status: 404 }
        );
      }

      if (hospitalResult.data.id !== hospitalId) {
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
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'];
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
    const folder = `hospital-logos/${hospitalId}`;
    const bucket = LOGO_BUCKET;

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

    // Update hospital profile with new logo
    const updateResult = await hospitalsService.updateHospital(hospitalId, {
      logoId: uploadResult.fileId,
    });

    if (!updateResult.success) {
      // If profile update fails, we could optionally delete the uploaded file
      // For now, we'll just return the error
      return NextResponse.json(
        { success: false, message: updateResult.message || 'Failed to update hospital logo' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Logo uploaded and updated successfully',
      data: {
        fileId: uploadResult.fileId,
        url: uploadResult.url,
        filename: file.name,
        logoId: uploadResult.fileId,
      },
    }, { status: 200 });
  } catch (error) {
    console.error('Logo upload error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

export const POST = withAuthAndContext(postHandler, ['hospital', 'admin']);

