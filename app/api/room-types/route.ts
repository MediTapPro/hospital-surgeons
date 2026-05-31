import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { roomTypes } from '@/src/db/drizzle/migrations/schema';
import { withAuth } from '@/lib/auth/middleware';
import { eq } from 'drizzle-orm';

async function handler(req: NextRequest) {
  try {
    const db = getDb();
    const data = await db.select().from(roomTypes).where(eq(roomTypes.isActive, true));

    return NextResponse.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Error in GET /api/room-types:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
// Note: withAuth is used to ensure only authenticated users can fetch room types. 
// Admin or public access could be adjusted if needed.
