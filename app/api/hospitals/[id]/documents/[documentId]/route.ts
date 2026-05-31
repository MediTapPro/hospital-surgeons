import { NextRequest, NextResponse } from 'next/server';
import { HospitalsService } from '@/lib/services/hospitals.service';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';

/**
 * @swagger
 * /api/hospitals/{id}/documents/{documentId}:
 *   delete:
 *     summary: Delete a hospital document (Hospital/Admin only)
 *     tags: [Hospitals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Hospital ID
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID
 *     responses:
 *       200:
 *         description: Document deleted successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
async function deleteHandler(req: AuthenticatedRequest, context: { params: Promise<{ id: string; documentId: string }> }) {
  try {
    const params = await context.params;
    const hospitalsService = new HospitalsService();

    // Ensure the user has access to this hospital
    const authorizationResult = await ensureHospitalAccess(req, params.id, hospitalsService);
    if (!authorizationResult.allowed) {
      return NextResponse.json(
        { success: false, message: authorizationResult.message },
        { status: authorizationResult.status }
      );
    }

    const result = await hospitalsService.deleteDocument(params.id, params.documentId);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

async function ensureHospitalAccess(
  req: AuthenticatedRequest,
  hospitalId: string,
  hospitalsService: HospitalsService
): Promise<{ allowed: boolean; message?: string; status?: number }> {
  const user = req.user;
  if (!user) {
    return { allowed: false, message: 'Unauthorized', status: 401 };
  }

  // Admin can access any hospital
  if (user.userRole === 'admin') {
    return { allowed: true };
  }

  // Hospital users can only access their own hospital
  if (user.userRole === 'hospital') {
    const hospitalResult = await hospitalsService.findHospitalByUserId(user.userId);
    if (!hospitalResult.success || !hospitalResult.data) {
      return { allowed: false, message: 'Hospital profile not found', status: 404 };
    }

    if (hospitalResult.data.id !== hospitalId) {
      return { allowed: false, message: 'You do not have permission to access this hospital', status: 403 };
    }

    return { allowed: true };
  }

  return { allowed: false, message: 'You do not have permission to access hospital documents', status: 403 };
}

export const DELETE = withAuthAndContext(deleteHandler, ['hospital', 'admin']);

