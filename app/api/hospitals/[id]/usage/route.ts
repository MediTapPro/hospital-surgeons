import { NextRequest, NextResponse } from 'next/server';
import { HospitalUsageService } from '@/lib/services/hospital-usage.service';

/**
 * @swagger
 * /api/hospitals/{id}/usage:
 *   get:
 *     summary: Get usage statistics for a hospital
 *     tags: [Hospitals]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Hospital ID
 *     responses:
 *       200:
 *         description: Usage statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     patients:
 *                       type: object
 *                     assignments:
 *                       type: object
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const hospitalId = params.id;
    
    const hospitalUsageService = new HospitalUsageService();
    const usage = await hospitalUsageService.getUsage(hospitalId);

    return NextResponse.json({
      success: true,
      data: usage,
    });
  } catch (error) {
    console.error('Error fetching hospital usage:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch usage', 
        error: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}

