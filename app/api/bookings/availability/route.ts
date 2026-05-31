import { NextRequest, NextResponse } from 'next/server';
import { BookingsService } from '@/lib/services/bookings.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { doctorId, bookingDate, startTime, endTime } = body;
    
    if (!doctorId || !bookingDate || !startTime || !endTime) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    const bookingsService = new BookingsService();
    const result = await bookingsService.checkAvailability(doctorId, bookingDate, startTime, endTime);
    
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}









































