import { NextRequest, NextResponse } from 'next/server';
import { FilesService } from '@/lib/services/files.service';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * @swagger
 * /api/files/upload:
 *   post:
 *     summary: Upload a file
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               folder:
 *                 type: string
 *               bucket:
 *                 type: string
 *     responses:
 *       200:
 *         description: File uploaded successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
async function postHandler(req: AuthenticatedRequest) {
  let bucket = 'images'; // Default bucket
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    // Folder and bucket are optional - backend can determine based on context
    // If not provided, use default 'general' folder
    const folder = (formData.get('folder') as string) || 'general';
    bucket = (formData.get('bucket') as string) || 'images';

    if (!file) {
      return NextResponse.json(
        { success: false, message: 'No file provided' },
        { status: 400 }
      );
    }

    const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, message: 'File too large. Maximum size is 25MB.' },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const fileExtension = file.name.split('.').pop() || '';
    const filename = `${timestamp}-${randomStr}.${fileExtension}`;

    // Upload file
    const filesService = new FilesService();
    const result = await filesService.uploadAndSave({
      buffer,
      filename: file.name,
      folder,
      mimetype: file.type,
      size: file.size,
      bucket,
      isPublic: true,
    });

    return NextResponse.json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        fileId: result.fileId,
        url: result.url,
        path: result.path,
        filename: file.name,
      },
    });
  } catch (error) {
    console.error('File upload error:', error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Provide helpful message for bucket not found
    let userMessage = 'Failed to upload file';
    if (errorMessage.includes('Bucket not found') || errorMessage.includes('not found')) {
      userMessage = `Storage bucket '${bucket}' not found. Please create it in your Supabase dashboard (Storage > Buckets) or run the initialization script.`;
    } else {
      userMessage = errorMessage;
    }
    
    return NextResponse.json(
      {
        success: false,
        message: userMessage,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

export const POST = withAuth(postHandler);

