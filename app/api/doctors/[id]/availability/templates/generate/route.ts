import { NextRequest, NextResponse } from 'next/server';
import { generateAvailabilityFromTemplates } from '@/lib/jobs/generateAvailabilityFromTemplates';
import { decodeToken } from '@/lib/auth/utils';

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * @swagger
 * /api/doctors/{id}/availability/templates/generate:
 *   post:
 *     summary: Generate availability slots from templates for a doctor
 *     description: Can generate from all templates or a specific template. Used by both cron jobs (no auth) and manual triggers (with auth).
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
 *       - in: header
 *         name: authorization
 *         schema:
 *           type: string
 *         description: Optional - Bearer token for authenticated requests. For cron jobs, use x-cron-secret header instead.
 *       - in: header
 *         name: x-cron-secret
 *         schema:
 *           type: string
 *         description: Optional - Cron secret for unauthenticated cron job calls
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               templateId:
 *                 type: string
 *                 format: uuid
 *                 description: Optional - Generate slots only for this specific template. If not provided, generates for all templates.
 *               startDate:
 *                 type: string
 *                 format: date
 *                 description: Optional - Start date for slot generation (YYYY-MM-DD). If not provided, uses today.
 *               endDate:
 *                 type: string
 *                 format: date
 *                 description: Optional - End date for slot generation (YYYY-MM-DD). If not provided, calculates from days.
 *               days:
 *                 type: number
 *                 default: 7
 *                 description: "Optional - Number of days to generate slots for (default: 7). Only used if startDate/endDate not provided."
 *     responses:
 *       200:
 *         description: Availability slots generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   description: Summary of generated slots
 *       401:
 *         description: Unauthorized - Invalid or missing authentication
 *       500:
 *         description: Failed to generate slots
 */
async function postHandler(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const doctorId = params.id;

    // Check authentication - support both JWT token and cron secret
    const authHeader = req.headers.get('authorization');
    const cronSecretHeader = req.headers.get('x-cron-secret');
    
    let isAuthenticated = false;
    let userId: string | null = null;

    // Check for JWT token (manual/user calls)
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const decoded = decodeToken(token);
        if (decoded && decoded.userId) {
          isAuthenticated = true;
          userId = decoded.userId;
          // Verify the doctor ID matches the authenticated user (if user is a doctor)
          // For now, we'll allow it if authenticated
        }
      } catch (err) {
        // Token invalid, continue to check cron secret
      }
    }

    // Check for cron secret (cron job calls)
    const isVercelCron = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;
    const isManualCron = CRON_SECRET && cronSecretHeader === CRON_SECRET;

    // Allow if authenticated OR if cron secret matches
    if (!isAuthenticated && CRON_SECRET && !isVercelCron && !isManualCron) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { templateId, days, startDate, endDate } = body;

    const options: any = {
      doctorIds: [doctorId],
    };

    // If startDate and endDate are provided, use them
    if (startDate && endDate) {
      options.startDate = new Date(startDate);
      options.endDate = new Date(endDate);
    } else if (days) {
      // If only days provided, use it (startDate will default to today in generation function)
      options.days = days;
    } else {
      // Default to 7 days if nothing provided
      options.days = 7;
    }

    // If templateId is provided, only generate for that template
    if (templateId) {
      options.templateIds = [templateId];
    }

    const summary = await generateAvailabilityFromTemplates(options);
    
    // If generating for a specific template, return only that template's summary
    if (templateId) {
      const templateSummary = summary.templates.find(t => t.templateId === templateId);
      return NextResponse.json({ 
        success: true, 
        data: {
          templateId: templateId,
          templateName: templateSummary?.templateName || 'Unknown',
          slotsCreated: templateSummary?.created || 0,
          skippedExisting: templateSummary?.skippedExisting || 0,
          consideredDates: templateSummary?.consideredDates || [],
        }
      });
    }

    return NextResponse.json({ success: true, data: summary });
  } catch (error) {
    console.error('Generate availability error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to generate slots', error: String(error) },
      { status: 500 }
    );
  }
}

export const POST = postHandler;


