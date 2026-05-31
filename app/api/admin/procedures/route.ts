import { NextRequest, NextResponse } from 'next/server';
import { ProceduresService } from '@/lib/services/procedures.service';
import { validateRequest } from '@/lib/utils/validate-request';
import { CreateProcedureDtoSchema } from '@/lib/validations/procedure.dto';
import { createAuditLog, getRequestMetadata } from '@/lib/utils/audit-logger';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const specialtyId = searchParams.get('specialtyId') || undefined;
    const categoryId = searchParams.get('categoryId') || undefined;
    const search = searchParams.get('search') || undefined;

    const service = new ProceduresService();
    const result = await service.getProcedures({ specialtyId, categoryId, search });

    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in GET /api/admin/procedures:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const validation = await validateRequest(req, CreateProcedureDtoSchema);
    if (!validation.success) {
      return validation.response;
    }

    const service = new ProceduresService();
    const result = await service.createProcedure(validation.data);

    if (result.success) {
      // Audit Log
      const metadata = getRequestMetadata(req);
      const adminUserId = req.headers.get('x-user-id') || null;
      
      await createAuditLog({
        userId: adminUserId,
        actorType: 'admin',
        action: 'create',
        entityType: 'procedure',
        entityId: result.data?.id || 'new-procedure',
        entityName: result.data?.name || 'New Procedure',
        httpMethod: 'POST',
        endpoint: '/api/admin/procedures',
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        details: {
          specialtyId: validation.data.specialtyId,
          categoryId: validation.data.categoryId,
        },
      });

      return NextResponse.json(result, { status: 201 });
    }

    return NextResponse.json(result, { status: 400 });
  } catch (error) {
    console.error('Error in POST /api/admin/procedures:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
