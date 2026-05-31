import { NextResponse } from 'next/server';
import { swaggerSpec } from '@/lib/swagger/config';

/**
 * @swagger
 * /api/docs:
 *   get:
 *     summary: Get Swagger API documentation
 *     tags: [Documentation]
 *     responses:
 *       200:
 *         description: Swagger JSON specification
 */
export async function GET() {
  try {
    // Log spec info for debugging
    const pathCount = swaggerSpec.paths ? Object.keys(swaggerSpec.paths).length : 0;
    console.log(`📚 [SWAGGER] Serving spec with ${pathCount} paths`);
    
    // Add CORS headers for Swagger UI
    return NextResponse.json(swaggerSpec, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error: any) {
    console.error('❌ [SWAGGER] Error serving spec:', error);
    return NextResponse.json(
      { error: 'Failed to load API documentation', message: error.message },
      { status: 500 }
    );
  }
}



































