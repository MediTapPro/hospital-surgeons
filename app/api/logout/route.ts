import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { userDevices } from '@/src/db/drizzle/migrations/schema';
import { and, eq } from 'drizzle-orm';

async function postHandler(req: AuthenticatedRequest) {
  try {
    const user = (req as any).user;

    if (!user?.userId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const deviceToken: string | undefined =
      body?.device_token || body?.deviceToken || undefined;

    const db = getDb();

    const updated = deviceToken
      ? await db
          .update(userDevices)
          .set({ isActive: false })
          .where(
            and(eq(userDevices.userId, user.userId), eq(userDevices.deviceToken, deviceToken))
          )
          .returning({ id: userDevices.id })
      : await db
          .update(userDevices)
          .set({ isActive: false })
          .where(eq(userDevices.userId, user.userId))
          .returning({ id: userDevices.id });

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully',
      data: {
        deactivatedDevices: updated.length,
      },
    });
  } catch (error) {
    console.error('Error logging out:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to logout',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const POST = withAuth(postHandler, ['doctor', 'hospital', 'admin']);
