import { NextRequest, NextResponse } from 'next/server';
import { FilesService } from '@/lib/services/files.service';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';

/**
 * @swagger
 * /api/files/{id}:
 *   get:
 *     summary: Get file by ID
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: File retrieved successfully
 *       404:
 *         description: File not found
 *   delete:
 *     summary: Delete a file
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: File deleted successfully
 *       404:
 *         description: File not found
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

    return NextResponse.json({
      success: true,
      data: {
        ...file,
        size: Number(file.size), // Convert BigInt to number
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error',
        error: String(error),
      },
      { status: 500 }
    );
  }
}

async function deleteHandler(req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const filesService = new FilesService();
    const deleted = await filesService.deleteFile(params.id);

    if (!deleted) {
      return NextResponse.json(
        { success: false, message: 'File not found or failed to delete' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error',
        error: String(error),
      },
      { status: 500 }
    );
  }
}

export const GET = withAuthAndContext(getHandler);
export const DELETE = withAuthAndContext(deleteHandler);









































