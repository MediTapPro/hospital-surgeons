import { NextRequest, NextResponse } from 'next/server';
import { ProceduresService } from '@/lib/services/procedures.service';
import { validateRequest } from '@/lib/utils/validate-request';
import { UpdateCategoryDtoSchema } from '@/lib/validations/procedure.dto';
import { createAuditLog, getRequestMetadata } from '@/lib/utils/audit-logger';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const validation = await validateRequest(req, UpdateCategoryDtoSchema);
    if (!validation.success) {
      return validation.response;
    }

    const service = new ProceduresService();
    const result = await service.updateCategory(id, validation.data);

    if (result.success) {
      // Audit Log
      const metadata = getRequestMetadata(req);
      const adminUserId = req.headers.get('x-user-id') || null;
      
      await createAuditLog({
        userId: adminUserId,
        actorType: 'admin',
        action: 'update',
        entityType: 'procedure_category',
        entityId: id,
        entityName: result.data?.name || 'Updated Category',
        httpMethod: 'PUT',
        endpoint: `/api/admin/procedures/categories/${id}`,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        details: {
          updatedAt: new Date().toISOString(),
        },
      });

      return NextResponse.json(result);
    }

    return NextResponse.json(result, { status: 400 });
  } catch (error) {
    console.error(`Error in PUT /api/admin/procedures/categories/${id}:`, error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const service = new ProceduresService();
    const result = await service.deleteCategory(id);

    if (result.success) {
      // Audit Log
      const metadata = getRequestMetadata(req);
      const adminUserId = req.headers.get('x-user-id') || null;
      
      await createAuditLog({
        userId: adminUserId,
        actorType: 'admin',
        action: 'delete',
        entityType: 'procedure_category',
        entityId: id,
        entityName: 'Deleted Category',
        httpMethod: 'DELETE',
        endpoint: `/api/admin/procedures/categories/${id}`,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        details: {
          deletedAt: new Date().toISOString(),
        },
      });

      return NextResponse.json(result);
    }

    return NextResponse.json(result, { status: 400 });
  } catch (error) {
    console.error(`Error in DELETE /api/admin/procedures/categories/${id}:`, error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
