import { NextResponse } from 'next/server';
import { withAuthAndContext, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { HomeVisitPaymentsService } from '@/lib/services/home-visit-payments.service';

const homeVisitPaymentsService = new HomeVisitPaymentsService();

async function postHandler(
  req: AuthenticatedRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const userId = req.user?.userId;
  if (!userId) {
    return NextResponse.json({ success: false, message: 'User context not found.' }, { status: 401 });
  }

  const result = await homeVisitPaymentsService.createPaymentOrder(userId, id);
  return NextResponse.json(result, { status: result.success ? 201 : 400 });
}

export const POST = withAuthAndContext(postHandler, ['patient']);
