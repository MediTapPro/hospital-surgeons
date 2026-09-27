import { getDb } from '@/lib/db';
import { assignmentRatings, assignments, doctors } from '@/src/db/drizzle/migrations/schema';
import { and, desc, eq, sql } from 'drizzle-orm';

export class AssignmentRatingsRepository {
  constructor(private readonly db: any = getDb()) {}

  async findHomeVisitAssignmentForPatient(assignmentId: string, patientProfileId: string, tx?: any) {
    const client = tx || this.db;
    const [row] = await client
      .select({
        assignment: assignments,
        existingRating: assignmentRatings,
      })
      .from(assignments)
      .leftJoin(assignmentRatings, eq(assignmentRatings.assignmentId, assignments.id))
      .where(and(
        eq(assignments.id, assignmentId),
        eq(assignments.source, 'patient'),
        eq(assignments.patientProfileId, patientProfileId),
      ))
      .limit(1);
    return row || null;
  }

  async createPatientRating(
    data: {
      assignmentId: string;
      doctorId: string;
      patientProfileId: string;
      rating: number;
      reviewText?: string;
      positiveTags?: string[];
      negativeTags?: string[];
    },
    tx?: any,
  ) {
    const client = tx || this.db;
    const [row] = await client.insert(assignmentRatings).values({
      assignmentId: data.assignmentId,
      doctorId: data.doctorId,
      reviewerType: 'patient',
      patientProfileId: data.patientProfileId,
      hospitalId: null,
      rating: data.rating,
      reviewText: data.reviewText,
      positiveTags: data.positiveTags,
      negativeTags: data.negativeTags,
    }).returning();
    return row;
  }

  async updatePatientRating(ratingId: string, data: { rating: number; reviewText?: string; positiveTags?: string[]; negativeTags?: string[] }, tx?: any) {
    const client = tx || this.db;
    const [row] = await client.update(assignmentRatings).set({
      rating: data.rating,
      reviewText: data.reviewText,
      positiveTags: data.positiveTags,
      negativeTags: data.negativeTags,
    }).where(eq(assignmentRatings.id, ratingId)).returning();
    return row;
  }

  async updateDoctorAggregate(doctorId: string, tx?: any) {
    const client = tx || this.db;
    const [summary] = await client
      .select({
        averageRating: sql<string>`coalesce(avg(${assignmentRatings.rating}), 0)`,
        totalRatings: sql<number>`count(${assignmentRatings.id})::int`,
      })
      .from(assignmentRatings)
      .where(eq(assignmentRatings.doctorId, doctorId));

    const [doctor] = await client.update(doctors).set({
      averageRating: summary?.averageRating || '0',
      totalRatings: summary?.totalRatings || 0,
    }).where(eq(doctors.id, doctorId)).returning({
      averageRating: doctors.averageRating,
      totalRatings: doctors.totalRatings,
    });
    return doctor;
  }
}
