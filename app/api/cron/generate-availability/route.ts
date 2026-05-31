import { NextRequest, NextResponse } from 'next/server';
import { generateAvailabilityFromTemplates } from '@/lib/jobs/generateAvailabilityFromTemplates';

const CRON_SECRET = process.env.CRON_SECRET;

async function handler(req: NextRequest) {
  try {
    // Vercel Cron Jobs send this header automatically
    const authHeader = req.headers.get('authorization');
    const isVercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    
    // Also support manual calls with x-cron-secret header
    const providedSecret = req.headers.get('x-cron-secret');
    const isManualCall = CRON_SECRET && providedSecret === CRON_SECRET;
    
    // // Allow if it's a Vercel cron job OR if secret matches (for manual testing)
    // if (CRON_SECRET && !isVercelCron && !isManualCall) {
    //   return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    // }

    const summary = await generateAvailabilityFromTemplates();
    return NextResponse.json({ success: true, data: summary });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to generate availability', error: String(error) },
      { status: 500 }
    );
  }
}

export const GET = handler;
export const POST = handler;


