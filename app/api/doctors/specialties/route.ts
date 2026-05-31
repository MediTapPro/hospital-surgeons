import { NextRequest, NextResponse } from 'next/server';
import { DoctorsService } from '@/lib/services/doctors.service';
import { withAuth } from '@/lib/auth/middleware';

async function handler(req: NextRequest) {
  try {
    const user = (req as any).user;
    const doctorsService = new DoctorsService();
    const doctorResult = await doctorsService.findDoctorByUserId(user.userId);

    if (!doctorResult.success || !doctorResult.data) {
      return NextResponse.json({ success: false, message: 'Doctor profile not found' }, { status: 404 });
    }

    const doctorId = doctorResult.data.id;
    const specialtiesResult = await doctorsService.getDoctorSpecialties(doctorId);

    if (!specialtiesResult.success) {
      return NextResponse.json(specialtiesResult, { status: 400 });
    }

    // Map to a simpler format if needed, but repository already returns { doctorSpecialty, specialty }
    const formatted = (specialtiesResult.data as any[]).map(item => ({
      ...item.specialty,
      isPrimary: item.doctorSpecialty.isPrimary,
      yearsOfExperience: item.doctorSpecialty.yearsOfExperience
    }));

    return NextResponse.json({ success: true, data: formatted });
  } catch (error) {
    console.error('Error in GET /api/doctors/specialties:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
