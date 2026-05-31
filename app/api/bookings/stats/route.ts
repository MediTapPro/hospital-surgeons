import { NextRequest, NextResponse } from 'next/server';
import { BookingsService } from '@/lib/services/bookings.service';
import { withAuth } from '@/lib/auth/middleware';

async function handler(req: NextRequest) {
  try {
    const bookingsService = new BookingsService();
    const result = await bookingsService.getBookingStats();
    
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

export const GET = withAuth(handler, ['admin']);









































