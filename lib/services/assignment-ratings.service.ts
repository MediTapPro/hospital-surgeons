import { withTransaction } from '@/lib/db/transaction';
import { AssignmentRatingsRepository } from '@/lib/repositories/assignment-ratings.repository';
import { PatientProfilesRepository } from '@/lib/repositories/patient-profiles.repository';
import type { CreateAssignmentRatingDto } from '@/lib/validations/assignment-rating.dto';

export class AssignmentRatingsService {
  private readonly ratingsRepository = new AssignmentRatingsRepository();
  private readonly patientProfilesRepository = new PatientProfilesRepository();

  async createPatientRating(assignmentId: string, userId: string, dto: CreateAssignmentRatingDto) {
    const patientProfile = await this.patientProfilesRepository.findProfileByUserId(userId);
    if (!patientProfile) {
      return { success: false, status: 404, message: 'Patient profile not found' };
    }

    try {
      const result = await withTransaction(async (tx) => {
        const assignment = await this.ratingsRepository.findHomeVisitAssignmentForPatient(
          assignmentId,
          patientProfile.id,
          tx,
        );
        if (!assignment) {
          return { success: false, status: 404, message: 'Home visit assignment not found' };
        }
        if (assignment.assignment.status !== 'completed') {
          return { success: false, status: 409, message: 'Only completed home visits can be rated' };
        }
        if (assignment.existingRating) {
          return { success: false, status: 409, message: 'This home visit has already been rated' };
        }

        const rating = await this.ratingsRepository.createPatientRating({
          assignmentId,
          doctorId: assignment.assignment.doctorId,
          patientProfileId: patientProfile.id,
          ...dto,
        }, tx);
        const doctorSummary = await this.ratingsRepository.updateDoctorAggregate(
          assignment.assignment.doctorId,
          tx,
        );
        return { success: true, status: 201, rating, doctorSummary };
      });
      return result;
    } catch (error: any) {
      if (error?.code === '23505') {
        return { success: false, status: 409, message: 'This home visit has already been rated' };
      }
      throw error;
    }
  }

  async updatePatientRating(assignmentId: string, userId: string, dto: CreateAssignmentRatingDto) {
    const patientProfile = await this.patientProfilesRepository.findProfileByUserId(userId);
    if (!patientProfile) return { success: false, status: 404, message: 'Patient profile not found' };
    const result = await withTransaction(async (tx) => {
      const assignment = await this.ratingsRepository.findHomeVisitAssignmentForPatient(assignmentId, patientProfile.id, tx);
      if (!assignment) return { success: false, status: 404, message: 'Home visit assignment not found' };
      if (assignment.assignment.status !== 'completed') return { success: false, status: 409, message: 'Only completed home visits can be rated' };
      if (!assignment.existingRating || assignment.existingRating.reviewerType !== 'patient' || assignment.existingRating.patientProfileId !== patientProfile.id) {
        return { success: false, status: 404, message: 'Your review was not found' };
      }
      const rating = await this.ratingsRepository.updatePatientRating(assignment.existingRating.id, dto, tx);
      const doctorSummary = await this.ratingsRepository.updateDoctorAggregate(assignment.assignment.doctorId, tx);
      return { success: true, status: 200, rating, doctorSummary };
    });
    return result;
  }
}
