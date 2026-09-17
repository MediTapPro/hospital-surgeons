import { NextRequest, NextResponse } from 'next/server';
import { withAuthAndContext, AuthenticatedRequest } from '@/lib/auth/middleware';
import { PlatformFeesService } from '@/lib/services/platform-fees.service';

const feesService = new PlatformFeesService();

async function deleteHandler(
  req: AuthenticatedRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const id = params.id;

  const result = await feesService.deletePlatformFee(id);
  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}

export const DELETE = withAuthAndContext(deleteHandler, ['admin']);
