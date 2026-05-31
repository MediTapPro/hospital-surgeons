import { NextRequest, NextResponse } from 'next/server';
import { DoctorsService } from '@/lib/services/doctors.service';

/**
 * @swagger
 * /api/doctors:
 *   get:
 *     summary: Get all doctors with filters
 *     tags: [Doctors]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: specialtyId
 *         schema:
 *           type: string
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *       - in: query
 *         name: minRating
 *         schema:
 *           type: number
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: List of doctors
 *   post:
 *     summary: Create a new doctor
 *     tags: [Doctors]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - phone
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               password:
 *                 type: string
 *               name:
 *                 type: string
 *               latitude:
 *                 type: number
 *                 description: Optional - Only used if provided by frontend
 *               longitude:
 *                 type: number
 *                 description: Optional - Only used if provided by frontend
 *     responses:
 *       201:
 *         description: Doctor created successfully
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = {
      search: searchParams.get('search') || undefined,
      specialtyId: searchParams.get('specialtyId') || undefined,
      city: searchParams.get('city') || undefined,
      minRating: searchParams.get('minRating') ? parseFloat(searchParams.get('minRating')!) : undefined,
      maxFee: searchParams.get('maxFee') ? parseFloat(searchParams.get('maxFee')!) : undefined,
      isAvailable: searchParams.get('isAvailable') === 'true' ? true : undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10,
      sortBy: searchParams.get('sortBy') as 'rating' | 'fee' | 'experience' | 'createdAt' | undefined,
      sortOrder: searchParams.get('sortOrder') as 'asc' | 'desc' | undefined,
    };

    const doctorsService = new DoctorsService();
    const result = await doctorsService.findDoctors(query);
    
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const doctorsService = new DoctorsService();
    const result = await doctorsService.createDoctor(body);
    
    return NextResponse.json(result, { status: result.success ? 201 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}
