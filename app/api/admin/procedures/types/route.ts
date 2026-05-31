import { NextRequest, NextResponse } from 'next/server';
import { ProceduresRepository } from '@/lib/repositories/procedures.repository';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const procedureId = searchParams.get('procedureId') || undefined;

    const repository = new ProceduresRepository();
    const result = await repository.findProcedureTypes(procedureId);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching procedure types:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch procedure types' }, { status: 500 });
  }
}
