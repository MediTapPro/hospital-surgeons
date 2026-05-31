import { NextRequest, NextResponse } from 'next/server';
import { HospitalsService } from '@/lib/services/hospitals.service';
import { withAuth } from '@/lib/auth/middleware';

/**
 * @swagger
 * /api/hospitals:
 *   get:
 *     summary: Get all hospitals (Generic)
 *     description: Returns a list of all hospitals in the system. Used for testing and general lookup.
 *     tags: [Hospitals]
 *     responses:
 *       200:
 *         description: Hospitals retrieved successfully
 *       500:
 *         description: Internal server error
 */
async function handler(req: NextRequest) {
  try {
    const hospitalsService = new HospitalsService();
    // Fetch with a large limit for the generic lookup
    const result = await hospitalsService.findHospitals({ limit: 100 });
    
    if (result.success && result.data) {
      // Flatten the result to just return the hospital objects
      const formatted = (result.data as any[]).map(item => item.hospital);
      return NextResponse.json({ success: true, data: formatted });
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in GET /api/hospitals:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

export const GET = handler; // Public or use withAuth if needed, but user said "generic"
