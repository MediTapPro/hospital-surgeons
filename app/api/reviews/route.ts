import { NextRequest, NextResponse } from 'next/server';
import { ReviewsService } from '@/lib/services/reviews.service';
import { withAuth } from '@/lib/auth/middleware';

/**
 * @swagger
 * /api/reviews:
 *   get:
 *     summary: Get all reviews
 *     tags: [Reviews]
 *     parameters:
 *       - in: query
 *         name: bookingId
 *         schema:
 *           type: string
 *       - in: query
 *         name: reviewerId
 *         schema:
 *           type: string
 *       - in: query
 *         name: revieweeId
 *         schema:
 *           type: string
 *       - in: query
 *         name: minRating
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *       - in: query
 *         name: maxRating
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: List of reviews
 *   post:
 *     summary: Create a new review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bookingId
 *               - reviewerId
 *               - revieweeId
 *               - rating
 *             properties:
 *               bookingId:
 *                 type: string
 *               reviewerId:
 *                 type: string
 *               revieweeId:
 *                 type: string
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               reviewText:
 *                 type: string
 *     responses:
 *       201:
 *         description: Review created successfully
 */
async function getHandler(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = {
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10,
      bookingId: searchParams.get('bookingId') || undefined,
      reviewerId: searchParams.get('reviewerId') || undefined,
      revieweeId: searchParams.get('revieweeId') || undefined,
      minRating: searchParams.get('minRating') ? parseInt(searchParams.get('minRating')!) : undefined,
      maxRating: searchParams.get('maxRating') ? parseInt(searchParams.get('maxRating')!) : undefined,
      isApproved: searchParams.get('isApproved') === 'true' ? true : searchParams.get('isApproved') === 'false' ? false : undefined,
    };

    const reviewsService = new ReviewsService();
    const result = await reviewsService.list(query);
    
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

async function postHandler(req: NextRequest) {
  try {
    const body = await req.json();
    const reviewsService = new ReviewsService();
    const result = await reviewsService.create(body);
    
    return NextResponse.json(result, { status: result.success ? 201 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

export const GET = getHandler;
export const POST = withAuth(postHandler);
