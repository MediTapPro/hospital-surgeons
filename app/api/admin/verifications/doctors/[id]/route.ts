import { NextResponse } from 'next/server';
import { withAuthAndContext, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { ProviderVerificationsService } from '@/lib/services/provider-verifications.service';

/**
 * @swagger
 * /api/admin/verifications/doctors/{id}:
 *   get:
 *     summary: Get doctor verification details and credential statuses (Admin only)
 *     tags: [Admin Verifications]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Doctor verification details }
 *       404: { description: Doctor not found }
 */
async function getHandler(_req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const data = await new ProviderVerificationsService().getDoctorDetails(id);
    if (!data) return NextResponse.json({ success: false, message: 'Doctor not found' }, { status: 404 });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching doctor verification details:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch doctor verification details' }, { status: 500 });
  }
}

export const GET = withAuthAndContext(getHandler, ['admin']);
