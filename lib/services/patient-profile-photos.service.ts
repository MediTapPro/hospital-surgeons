import { getDb } from '@/lib/db';
import { FilesService } from '@/lib/services/files.service';
import { PatientProfilesRepository } from '@/lib/repositories/patient-profiles.repository';
import { PATIENT_PROFILE_PHOTO_BUCKET } from '@/lib/utils/constants';

export class PatientProfilePhotosService {
  private db = getDb();
  private filesService = new FilesService();

  async upload(userId: string, file: File) {
    const uploadedFile = await this.filesService.uploadFile(
      Buffer.from(await file.arrayBuffer()),
      file.name,
      `patient-profiles/${userId}`,
      file.type,
      PATIENT_PROFILE_PHOTO_BUCKET
    );

    const fileId = await this.db.transaction(async (tx) => {
      const profilesRepository = new PatientProfilesRepository(tx);
      const profile = await profilesRepository.findProfileByUserId(userId);
      if (!profile) {
        throw new Error('Patient profile not found');
      }

      const savedFileId = await this.filesService.saveFileMetadata({
        filename: file.name,
        url: uploadedFile.url,
        mimetype: file.type,
        size: file.size,
        storageBucket: PATIENT_PROFILE_PHOTO_BUCKET,
        storageKey: uploadedFile.path,
        isPublic: true,
      }, tx);

      await profilesRepository.updateProfilePhoto(profile.id, savedFileId, tx);
      return savedFileId;
    });

    return { fileId, url: uploadedFile.url };
  }
}
