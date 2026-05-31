import { NextRequest, NextResponse } from 'next/server';
import { HospitalsService } from '@/lib/services/hospitals.service';
import { FilesService } from '@/lib/services/files.service';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';

const ALLOWED_DOCUMENT_TYPES = ['license', 'accreditation', 'insurance', 'other'];
const DOCUMENTS_BUCKET = 'documents'; // Backend determines the bucket

/**
 * @swagger
 * /api/hospitals/{id}/documents/upload:
 *   post:
 *     summary: Upload document file and create document record in one call
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
 *               - documentType
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               documentType:
 *                 type: string
 *                 enum: [license, accreditation, insurance, other]
 *     responses:
 *       201:
 *         description: Document uploaded and created successfully
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
          hint: 'Check that all fields are properly formatted in FormData/MultipartBody.'
        },
        { status: 400 }
      );
    }

    // Validate FormData fields with Zod
    const { CreateHospitalDocumentFormDataSchema } = await import('@/lib/validations/hospital.dto');
    const { validateFormData } = await import('@/lib/utils/validate-formdata');
    
    const validation = validateFormData(formData, CreateHospitalDocumentFormDataSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { file, documentType } = validation.data;

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

    // documentType is already validated by Zod

    // Backend determines folder and bucket (frontend doesn't need to know)
    const folder = `hospital-documents/${hospitalId}`;
    const bucket = DOCUMENTS_BUCKET;

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
      isPublic: false, // Documents are typically private
    });

    // Create document record
    const documentResult = await hospitalsService.addDocument(hospitalId, {
      fileId: uploadResult.fileId,
      documentType: documentType, // Already validated by Zod as enum
    });

    if (!documentResult.success) {
      // If document creation fails, we could optionally delete the uploaded file
      // For now, we'll just return the error
      return NextResponse.json(
        { success: false, message: documentResult.message || 'Failed to create document record' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Document uploaded and created successfully',
      data: {
        document: documentResult.data,
        file: {
          fileId: uploadResult.fileId,
          url: uploadResult.url,
          filename: file.name,
        },
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Document upload error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

export const POST = withAuthAndContext(postHandler, ['hospital', 'admin']);

