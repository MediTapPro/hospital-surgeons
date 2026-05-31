import { NextRequest, NextResponse } from 'next/server';
import { AnalyticsService } from '@/lib/services/analytics.service';
import { withAuth } from '@/lib/auth/middleware';

/**
 * @swagger
 * /api/analytics/events:
 *   get:
 *     summary: Get analytics events (Admin only)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *       - in: query
 *         name: eventType
 *         schema:
 *           type: string
 *       - in: query
 *         name: eventName
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: List of analytics events
 *   post:
 *     summary: Create an analytics event (Public for tracking)
 *     tags: [Analytics]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eventType
 *               - eventName
 *             properties:
 *               userId:
 *                 type: string
 *               eventType:
 *                 type: string
 *               eventName:
 *                 type: string
 *               properties:
 *                 type: object
 *     responses:
 *       201:
 *         description: Analytics event created successfully
 */
async function getHandler(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = {
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10,
      userId: searchParams.get('userId') || undefined,
      eventType: searchParams.get('eventType') || undefined,
      eventName: searchParams.get('eventName') || undefined,
    };

    const analyticsService = new AnalyticsService();
    const result = await analyticsService.list(query);
    
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

async function postHandler(req: NextRequest) {
  try {
    const body = await req.json();
    const analyticsService = new AnalyticsService();
    const result = await analyticsService.create(body);
    
    return NextResponse.json(result, { status: result.success ? 201 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler, ['admin']);
export const POST = postHandler; // Allow public event tracking
