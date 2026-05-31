import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './jwt';
import { JWTPayload } from './jwt';

export interface AuthenticatedRequest extends NextRequest {
  user?: JWTPayload;
}

export function withAuth(
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>,
  allowedRoles?: string[]
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      const authHeader = req.headers.get('authorization');
      
      if (!authHeader) {
        return NextResponse.json(
          { success: false, message: 'Authorization header missing' },
          { status: 401 }
        );
      }

      const token = authHeader.split(' ')[1]; // Bearer <token>
      if (!token) {
        return NextResponse.json(
          { success: false, message: 'Token not provided' },
          { status: 401 }
        );
      }

      const payload = verifyToken(
        token,
        process.env.JWT_ACCESS_TOKEN_SECRET!
      );

      // Check role if specified
      if (allowedRoles && !allowedRoles.includes(payload.userRole)) {
        return NextResponse.json(
          { success: false, message: 'Insufficient permissions' },
          { status: 403 }
        );
      }

      // Attach user to request
      (req as AuthenticatedRequest).user = payload;

      return handler(req as AuthenticatedRequest);
    } catch (error) {
      return NextResponse.json(
        { success: false, message: 'Invalid token' },
        { status: 401 }
      );
    }
  };
}

// Helper for dynamic routes that need context
export function withAuthAndContext<T extends { params: Promise<Record<string, string>> }>(
  handler: (req: AuthenticatedRequest, context: T) => Promise<NextResponse>,
  allowedRoles?: string[]
) {
  return async (req: NextRequest, context: T): Promise<NextResponse> => {
    try {
      const authHeader = req.headers.get('authorization');
      
      if (!authHeader) {
        return NextResponse.json(
          { success: false, message: 'Authorization header missing' },
          { status: 401 }
        );
      }

      const token = authHeader.split(' ')[1];
      if (!token) {
        return NextResponse.json(
          { success: false, message: 'Token not provided' },
          { status: 401 }
        );
      }

      const payload = verifyToken(
        token,
        process.env.JWT_ACCESS_TOKEN_SECRET!
      );

      if (allowedRoles && !allowedRoles.includes(payload.userRole)) {
        return NextResponse.json(
          { success: false, message: 'Insufficient permissions' },
          { status: 403 }
        );
      }

      (req as AuthenticatedRequest).user = payload;

      return handler(req as AuthenticatedRequest, context);
    } catch (error) {
      console.error('Authentication error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Invalid token';
      return NextResponse.json(
        { success: false, message: errorMessage },
        { status: 401 }
      );
    }
  };
}

