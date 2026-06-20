import { NextRequest, NextResponse } from 'next/server';
import { SubscriptionsService } from '@/lib/services/subscriptions.service';

/**
 * Cron job endpoint to process expired subscriptions with pending plan changes
 * This should be called by a cron service (e.g., Vercel Cron, GitHub Actions, etc.)
 * 
 * To secure this endpoint, add authentication:
 * - API key in headers
 * - Or use Vercel Cron secret
 */
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const providedSecret = req.headers.get('x-cron-secret');
    
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}` && providedSecret !== CRON_SECRET) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const subscriptionsService = new SubscriptionsService();
    const result = await subscriptionsService.processExpiredSubscriptionsWithPendingChanges();

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (error: any) {
    console.error('Process expired subscriptions error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// Also support POST for cron services that use POST
export async function POST(req: NextRequest) {
  return GET(req);
}

