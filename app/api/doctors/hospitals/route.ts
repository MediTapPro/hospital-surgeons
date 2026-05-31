import { NextRequest, NextResponse } from 'next/server';
import { DoctorsService } from '@/lib/services/doctors.service';
import { withAuth } from '@/lib/auth/middleware';

/**
 * @swagger
 * /api/doctors/hospitals:
 *   get:
 *     summary: Get doctor's affiliated hospitals
 *     description: Returns a list of hospitals where the doctor is currently active.
 *     tags: [Doctors, Hospitals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Hospitals retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *       401:
 *         description: Unauthorized
 */
export const GET = withAuth(async (req) => {
  try {
    const user = req.user;
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found in session' }, { status: 401 });
    }

    const doctorsService = new DoctorsService();
    const doctorResult = await doctorsService.findDoctorByUserId(user.userId);

    if (!doctorResult.success || !doctorResult.data) {
      return NextResponse.json({ success: false, message: 'Doctor profile not found' }, { status: 404 });
    }

    const doctorId = doctorResult.data.id;
    const result = await doctorsService.getDoctorHospitals(doctorId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in GET /api/doctors/hospitals:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
});
