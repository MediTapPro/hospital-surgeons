import { NextRequest, NextResponse } from 'next/server';
import { DoctorsService } from '@/lib/services/doctors.service';
import { FilesService } from '@/lib/services/files.service';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';

const ALLOWED_TYPES = ['degree', 'certificate', 'license', 'other'];
const CREDENTIALS_BUCKET = 'images'; // Backend determines the bucket

/**
 * @swagger
 * /api/doctors/{id}/credentials/upload:
 *   post:
 *     summary: Upload credential file and create credential record in one call
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
 *               - credentialType
 *               - title
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               credentialType:
 *                 type: string
 *                 enum: [degree, certificate, license, other]
 *               title:
 *                 type: string
 *               institution:
 *                 type: string
 *     responses:
 *       201:
 *         description: Credential uploaded and created successfully
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
          hint: 'Check that all fields are properly formatted in FormData/MultipartBody.'
        },
        { status: 400 }
      );
    }

    // Validate FormData fields with Zod
    const { CreateDoctorCredentialFormDataSchema } = await import('@/lib/validations/doctor.dto');
    const { validateFormData } = await import('@/lib/utils/validate-formdata');
    
    const validation = validateFormData(formData, CreateDoctorCredentialFormDataSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { file, credentialType, title, institution } = validation.data;

    // Validate file separately (Zod can't validate File objects properly)
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Invalid file format',
          hint: 'File must be a proper File object. For React Native, ensure you are using the correct format: { uri, type, name }'
        },
        { status: 400 }
      );
    }

    // credentialType and title are already validated by Zod

    // Backend determines folder and bucket (frontend doesn't need to know)
    const folder = `doctor-credentials/${doctorId}`;
    const bucket = CREDENTIALS_BUCKET;

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

    // Create credential record
    // institution is optional in database but required in interface, so use empty string if not provided
    const credentialResult = await doctorsService.addCredential(doctorId, {
      fileId: uploadResult.fileId,
      credentialType: credentialType, // Already validated by Zod
      title: title, // Already validated by Zod
      institution: institution || '', // Use empty string if not provided (database allows null but interface requires string)
      verificationStatus: 'pending',
    });

    if (!credentialResult.success) {
      // If credential creation fails, we could optionally delete the uploaded file
      // For now, we'll just return the error
      return NextResponse.json(
        { success: false, message: credentialResult.message || 'Failed to create credential record' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Credential uploaded and created successfully',
      data: {
        credential: credentialResult.data,
        file: {
          fileId: uploadResult.fileId,
          url: uploadResult.url,
          filename: file.name,
        },
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Credential upload error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

export const POST = withAuthAndContext(postHandler, ['doctor', 'admin']);

