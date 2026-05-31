import { NextRequest, NextResponse } from 'next/server';
import { FilesService } from '@/lib/services/files.service';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getSupabaseClient } from '@/lib/services/supabase';

/**
 * @swagger
 * /api/files/{id}/download:
 *   get:
 *     summary: Download a file by ID (forces browser download)
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *     responses:
 *       200:
 *         description: File downloaded successfully
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: File not found
 *       401:
 *         description: Unauthorized
 */
async function getHandler(req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const filesService = new FilesService();
    const file = await filesService.getFileById(params.id);

    if (!file) {
      return NextResponse.json(
        { success: false, message: 'File not found' },
        { status: 404 }
      );
    }

    // Get the file from Supabase Storage
    const supabase = getSupabaseClient();
    const bucket = file.storageBucket || 'images';
    
    // Extract path from storageKey or URL
    let path = file.storageKey;
    if (!path && file.url) {
      // Extract path from Supabase public URL
      // URL format: https://xxx.supabase.co/storage/v1/object/public/bucket/path/to/file
      const urlParts = file.url.split('/storage/v1/object/public/');
      if (urlParts.length > 1) {
        path = urlParts[1].substring(bucket.length + 1); // Remove bucket name from path
      } else {
        // Fallback: try to extract from end of URL
        const urlPath = new URL(file.url).pathname;
        const bucketIndex = urlPath.indexOf(`/${bucket}/`);
        if (bucketIndex !== -1) {
          path = urlPath.substring(bucketIndex + bucket.length + 2);
        }
      }
    }
    
    if (!path) {
      return NextResponse.json(
        { success: false, message: 'File path not found' },
        { status: 404 }
      );
    }

    // Download the file from Supabase
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(path);

    if (error || !data) {
      console.error('Error downloading file from Supabase:', error);
      // Fallback: redirect to the public URL
      return NextResponse.redirect(file.url);
    }

    // Convert blob to buffer
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Return file with download headers
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': file.mimetype || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(file.filename)}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error downloading file:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to download file',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export const GET = withAuthAndContext(getHandler);

