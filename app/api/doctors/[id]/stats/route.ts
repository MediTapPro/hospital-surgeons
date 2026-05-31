import { NextRequest, NextResponse } from 'next/server';
import { DoctorsService } from '@/lib/services/doctors.service';

/**
 * @swagger
 * /api/doctors/{id}/stats:
 *   get:
 *     summary: Get statistics for a doctor
 *     tags: [Doctors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Doctor ID
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
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
 *                     totalBookings:
 *                       type: number
 *                       description: Total completed assignments
 *                     averageRating:
 *                       type: number
 *                       description: Average rating (0-5)
 *                     totalRatings:
 *                       type: number
 *                       description: Total number of ratings
 *       400:
 *         description: Bad request
 *       404:
 *         description: Doctor not found
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const doctorsService = new DoctorsService();
    const result = await doctorsService.getDoctorStats(params.id);
    
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}









































