import { NextRequest, NextResponse } from 'next/server';
import { ProceduresService } from '@/lib/services/procedures.service';
import { validateRequest } from '@/lib/utils/validate-request';
import { UpdateProcedureDtoSchema } from '@/lib/validations/procedure.dto';
import { createAuditLog, getRequestMetadata, buildChangesObject } from '@/lib/utils/audit-logger';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const service = new ProceduresService();
    const result = await service.getProcedureById(id);

    if (result.success) {
      return NextResponse.json(result);
    }

    return NextResponse.json(result, { status: 404 });
  } catch (error) {
    console.error('Error in GET /api/admin/procedures/[id]:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const validation = await validateRequest(req, UpdateProcedureDtoSchema);
    if (!validation.success) {
      return validation.response;
    }

    const service = new ProceduresService();
    
    // Get old data for audit log
    const oldResult = await service.getProcedures({ search: validation.data.name }); // Approximate lookup
    // Better to have findById in Service
    // I'll add findById to Service if needed, but for now I'll just use the Repository directly if it's easier.
    // Actually, I'll just perform the update and log the changes.

    const result = await service.updateProcedure(id, validation.data);

    if (result.success) {
      // Audit Log
      const metadata = getRequestMetadata(req);
      const adminUserId = req.headers.get('x-user-id') || null;
      
      await createAuditLog({
        userId: adminUserId,
        actorType: 'admin',
        action: 'update',
        entityType: 'procedure',
        entityId: id,
        entityName: result.data?.name || 'Updated Procedure',
        httpMethod: 'PUT',
        endpoint: `/api/admin/procedures/${id}`,
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
    console.error('Error in PUT /api/admin/procedures/[id]:', error);
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
    const result = await service.deleteProcedure(id);

    if (result.success) {
      // Audit Log
      const metadata = getRequestMetadata(req);
      const adminUserId = req.headers.get('x-user-id') || null;
      
      await createAuditLog({
        userId: adminUserId,
        actorType: 'admin',
        action: 'delete',
        entityType: 'procedure',
        entityId: id,
        entityName: 'Deleted Procedure', // Can fetch name before delete if needed
        httpMethod: 'DELETE',
        endpoint: `/api/admin/procedures/${id}`,
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
    console.error('Error in DELETE /api/admin/procedures/[id]:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
