import { NextRequest, NextResponse } from 'next/server';
import { BookingsService } from '@/lib/services/bookings.service';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const doctorId = searchParams.get('doctorId');
    const bookingDate = searchParams.get('bookingDate');
    
    if (!doctorId || !bookingDate) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: doctorId and bookingDate' },
        { status: 400 }
      );
    }

    const bookingsService = new BookingsService();
    const result = await bookingsService.getAvailableTimeSlots(doctorId, bookingDate);
    
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}









































