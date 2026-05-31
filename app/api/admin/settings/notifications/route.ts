import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { notificationPreferences } from '@/src/db/drizzle/migrations/schema';
import { sql } from 'drizzle-orm';

const DEFAULT_NOTIFICATION_SETTINGS = {
  bookingUpdatesPush: true,
  bookingUpdatesEmail: true,
  paymentPush: true,
  remindersPush: true,
};

export async function GET(req: NextRequest) {
  try {
    // Return default notification settings
    // In a real application, you might want to fetch from a system-wide settings table
    return NextResponse.json({
      success: true,
      data: DEFAULT_NOTIFICATION_SETTINGS,
    });
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch notification settings',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { bookingUpdatesPush, bookingUpdatesEmail, paymentPush, remindersPush } = body;

    // In a real application, you would save to a system settings table
    // For now, just return success
    return NextResponse.json({
      success: true,
      message: 'Notification settings updated successfully',
      data: {
        bookingUpdatesPush: bookingUpdatesPush !== undefined ? bookingUpdatesPush : DEFAULT_NOTIFICATION_SETTINGS.bookingUpdatesPush,
        bookingUpdatesEmail: bookingUpdatesEmail !== undefined ? bookingUpdatesEmail : DEFAULT_NOTIFICATION_SETTINGS.bookingUpdatesEmail,
        paymentPush: paymentPush !== undefined ? paymentPush : DEFAULT_NOTIFICATION_SETTINGS.paymentPush,
        remindersPush: remindersPush !== undefined ? remindersPush : DEFAULT_NOTIFICATION_SETTINGS.remindersPush,
      },
    });
  } catch (error) {
    console.error('Error updating notification settings:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to update notification settings',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}





