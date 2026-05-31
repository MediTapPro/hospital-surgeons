import { getDb } from '@/lib/db';
import { 
  assignmentRatings, // Use assignmentRatings instead of reviews
  users, 
  assignments,
  hospitals,
  doctors
} from '@/src/db/drizzle/migrations/schema';
import { eq, desc, and, gte, lte } from 'drizzle-orm';

export interface CreateReviewData {
  assignmentId: string; // Replaces bookingId
  hospitalId: string; // Replaces reviewerId (hospital reviews doctor)
  doctorId: string; // Replaces revieweeId (doctor being reviewed)
  rating: number;
  reviewText?: string;
  positiveTags?: string[];
  negativeTags?: string[];
  // isApproved removed - not in assignmentRatings table
}

export interface ReviewQuery {
  page?: number;
  limit?: number;
  assignmentId?: string;
  hospitalId?: string;
  doctorId?: string;
  minRating?: number;
  maxRating?: number;
}

export class ReviewsRepository {
  private db = getDb();

  async create(dto: CreateReviewData) {
    // Use assignmentRatings table
    const [row] = await this.db
      .insert(assignmentRatings)
      .values({
        assignmentId: dto.assignmentId,
        hospitalId: dto.hospitalId,
        doctorId: dto.doctorId,
        rating: dto.rating,
        reviewText: dto.reviewText,
        positiveTags: dto.positiveTags,
        negativeTags: dto.negativeTags,
      })
      .returning();
    return row;
  }

  async list(query: ReviewQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    const whereConditions = [];
    if (query.assignmentId) whereConditions.push(eq(assignmentRatings.assignmentId, query.assignmentId));
    if (query.hospitalId) whereConditions.push(eq(assignmentRatings.hospitalId, query.hospitalId));
    if (query.doctorId) whereConditions.push(eq(assignmentRatings.doctorId, query.doctorId));
    if (query.minRating !== undefined) whereConditions.push(gte(assignmentRatings.rating, query.minRating));
    if (query.maxRating !== undefined) whereConditions.push(lte(assignmentRatings.rating, query.maxRating));

    const data = await this.db
      .select({
        review: assignmentRatings,
        hospital: { id: hospitals.id, name: hospitals.name },
        doctor: { id: doctors.id, firstName: doctors.firstName, lastName: doctors.lastName },
        assignment: { id: assignments.id },
      })
      .from(assignmentRatings)
      .leftJoin(hospitals, eq(hospitals.id, assignmentRatings.hospitalId))
      .leftJoin(doctors, eq(doctors.id, assignmentRatings.doctorId))
      .leftJoin(assignments, eq(assignments.id, assignmentRatings.assignmentId))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(assignmentRatings.createdAt))
      .limit(limit)
      .offset(offset);

    return { data, page, limit };
  }

  async get(id: string) {
    const [row] = await this.db
      .select({
        review: assignmentRatings,
        hospital: { id: hospitals.id, name: hospitals.name },
        doctor: { id: doctors.id, firstName: doctors.firstName, lastName: doctors.lastName },
        assignment: { id: assignments.id },
      })
      .from(assignmentRatings)
      .leftJoin(hospitals, eq(hospitals.id, assignmentRatings.hospitalId))
      .leftJoin(doctors, eq(doctors.id, assignmentRatings.doctorId))
      .leftJoin(assignments, eq(assignments.id, assignmentRatings.assignmentId))
      .where(eq(assignmentRatings.id, id))
      .limit(1);
    return row;
  }

  async update(id: string, dto: Partial<CreateReviewData>) {
    const updateFields: any = {};
    
    if (dto.assignmentId) updateFields.assignmentId = dto.assignmentId;
    if (dto.hospitalId) updateFields.hospitalId = dto.hospitalId;
    if (dto.doctorId) updateFields.doctorId = dto.doctorId;
    if (dto.rating !== undefined) updateFields.rating = dto.rating;
    if (dto.reviewText !== undefined) updateFields.reviewText = dto.reviewText;
    if (dto.positiveTags !== undefined) updateFields.positiveTags = dto.positiveTags;
    if (dto.negativeTags !== undefined) updateFields.negativeTags = dto.negativeTags;

    const [row] = await this.db
      .update(assignmentRatings)
      .set(updateFields)
      .where(eq(assignmentRatings.id, id))
      .returning();
    return row;
  }

  async remove(id: string) {
    await this.db.delete(assignmentRatings).where(eq(assignmentRatings.id, id));
  }
}


