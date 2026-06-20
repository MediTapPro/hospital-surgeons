import { NextRequest, NextResponse } from 'next/server';
import { generateAvailabilityFromTemplates } from '@/lib/jobs/generateAvailabilityFromTemplates';

const CRON_SECRET = process.env.CRON_SECRET;

async function handler(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const providedSecret = req.headers.get('x-cron-secret');
    
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}` && providedSecret !== CRON_SECRET) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

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


