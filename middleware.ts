import { NextRequest, NextResponse } from 'next/server';
// import { corsMiddleware } from './lib/middleware/cors';

export function middleware(request: NextRequest) {
  // // Apply CORS middleware for API routes
  // if (request.nextUrl.pathname.startsWith('/api')) {
  //   const corsResponse = corsMiddleware(request);
  //   if (corsResponse) {
  //     return corsResponse;
  //   }
  // }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};









































