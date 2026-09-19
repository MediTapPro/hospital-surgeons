import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { HomeVisitSettingsService } from '@/lib/services/home-visit-settings.service';

const settingsService = new HomeVisitSettingsService();

/**
 * @swagger
 * /api/admin/home-visit-settings:
 *   get:
 *     summary: Get global home-visit and assignment-completion settings
 *     tags: [Admin Home Visits]
 *     security: [{ bearerAuth: [] }]
 *   put:
 *     summary: Update global home-visit and assignment-completion settings
 *     description: Allow early assignment completion applies to both hospital assignments and patient home visits.
 *     tags: [Admin Home Visits]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Settings saved }
 *       400: { description: Invalid settings }
 *       403: { description: Admin access required }
 */
async function getHandler(_req: AuthenticatedRequest) {
  const result = await settingsService.getSettings();
  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}

async function putHandler(req: AuthenticatedRequest) {
  try {
    const result = await settingsService.updateSettings(await req.json());
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: 'Invalid home visit settings request.',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 400 }
    );
  }
}

export const GET = withAuth(getHandler, ['admin']);
export const PUT = withAuth(putHandler, ['admin']);
