import { NextRequest, NextResponse } from 'next/server';

/**
 * CORS middleware for Next.js API routes
 * Reads allowed origins from CORS environment variable
 * Format: CORS=http://localhost:3000,https://example.com
 */
export function corsMiddleware(req: NextRequest): NextResponse | null {
  const origin = req.headers.get('origin');
  const corsEnv = process.env.CORS || '';
  const allowedOrigins = corsEnv.split(',').map(o => o.trim()).filter(Boolean);

  // If no CORS configured, allow all (for development)
  if (allowedOrigins.length === 0) {
    return null; // Let Next.js handle it
  }

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 });
    
    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }
    
    return response;
  }

  // For actual requests, add CORS headers
  const response = NextResponse.next();
  
  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  return response;
}

/**
 * Helper function to add CORS headers to a response
 */
export function addCorsHeaders(response: NextResponse, req: NextRequest): NextResponse {
  const origin = req.headers.get('origin');
  const corsEnv = process.env.CORS || '';
  const allowedOrigins = corsEnv.split(',').map(o => o.trim()).filter(Boolean);

  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  return response;
}









































