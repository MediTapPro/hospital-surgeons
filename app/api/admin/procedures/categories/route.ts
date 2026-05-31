import { NextRequest, NextResponse } from 'next/server';
import { ProceduresService } from '@/lib/services/procedures.service';
import { validateRequest } from '@/lib/utils/validate-request';
import { CreateCategoryDtoSchema } from '@/lib/validations/procedure.dto';
import { createAuditLog, getRequestMetadata } from '@/lib/utils/audit-logger';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const specialtyId = searchParams.get('specialtyId') || undefined;

    const service = new ProceduresService();
    const result = await service.getCategories(specialtyId);

    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in GET /api/admin/procedures/categories:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const validation = await validateRequest(req, CreateCategoryDtoSchema);
    if (!validation.success) {
      return validation.response;
    }

    const service = new ProceduresService();
    const result = await service.createCategory(validation.data);

    if (result.success) {
      // Audit Log
      const metadata = getRequestMetadata(req);
      const adminUserId = req.headers.get('x-user-id') || null;
      
      await createAuditLog({
        userId: adminUserId,
        actorType: 'admin',
        action: 'create',
        entityType: 'procedure_category',
        entityId: result.data?.id || 'new-category',
        entityName: result.data?.name || 'New Category',
        httpMethod: 'POST',
        endpoint: '/api/admin/procedures/categories',
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        details: {
          specialtyId: validation.data.specialtyId,
        },
      });

      return NextResponse.json(result, { status: 201 });
    }

    return NextResponse.json(result, { status: 400 });
  } catch (error) {
    console.error('Error in POST /api/admin/procedures/categories:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
