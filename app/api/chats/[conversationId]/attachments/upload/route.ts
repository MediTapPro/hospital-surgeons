import { NextRequest, NextResponse } from 'next/server';
import { FilesService } from '@/lib/services/files.service';
import { ChatService } from '@/lib/services/chat.service';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';

/**
 * @swagger
 * /api/chats/{conversationId}/attachments/upload:
 *   post:
 *     summary: Upload an attachment for a chat conversation
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Conversation ID
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
 *         description: File uploaded successfully
 *       400:
 *         description: Bad request
 *       403:
 *         description: Insufficient permissions
 */
async function postHandler(req: AuthenticatedRequest, context: { params: Promise<{ conversationId: string }> }) {
  try {
    const { conversationId } = await context.params;
    const { userId, userRole } = req.user!;
    
    // 1. Verify access to conversation
    const chatService = new ChatService();
    const conversation = await chatService.getConversationById(conversationId, userId, userRole);
    if (!conversation) {
      return NextResponse.json(
        { success: false, message: 'Conversation not found or unauthorized' },
        { status: 404 }
      );
    }

    // 2. Parse form data
    const formData = await req.formData();
    // Support either 'file' (single/array) or 'files' (array) in the FormData
    const files = formData.getAll('file').concat(formData.getAll('files')) as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No files provided' },
        { status: 400 }
      );
    }

    if (files.length > 10) {
      return NextResponse.json(
        { success: false, message: 'Maximum 10 files allowed per request' },
        { status: 400 }
      );
    }

    // 3. Size limit 25MB per file
    const MAX_FILE_SIZE = 25 * 1024 * 1024;
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { success: false, message: `File ${file.name} is too large. Maximum size is 25MB.` },
          { status: 400 }
        );
      }
    }

    const filesService = new FilesService();
    const folder = `chats/${conversationId}`;

    // 4. Upload all files in parallel
    const uploadPromises = files.map(async (file) => {
      const isImage = file.type.startsWith('image/');
      const bucket = isImage ? 'images' : 'documents';
      
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const result = await filesService.uploadAndSave({
        buffer,
        filename: file.name,
        folder,
        mimetype: file.type,
        size: file.size,
        bucket,
        isPublic: true,
      });

      // Return just the string ID for the mobile developer
      return result.fileId;
    });

    const uploadedFiles = await Promise.all(uploadPromises);

    return NextResponse.json({
      success: true,
      message: `${uploadedFiles.length} file(s) uploaded successfully`,
      data: uploadedFiles, // Return array of results
    });
  } catch (error: any) {
    console.error('Chat attachment upload error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to upload attachments' },
      { status: 500 }
    );
  }
}

export const POST = withAuthAndContext(postHandler, ['doctor', 'hospital']);
