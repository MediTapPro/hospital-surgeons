import { getSupabaseClient } from './supabase';
import { getDb } from '@/lib/db';
import { files } from '@/src/db/drizzle/migrations/schema';
import { eq } from 'drizzle-orm';

export interface FileMetadata {
  filename: string;
  url: string;
  mimetype: string;
  size: number;
  thumbnail?: string;
  storageBucket?: string;
  storageKey?: string;
  cdnUrl?: string;
  isPublic?: boolean;
}

export class FilesService {
  private supabase = getSupabaseClient();
  private db = getDb();

  /**
   * Ensures bucket exists, creates it if it doesn't
   * Note: This requires service role key or bucket must be created manually in Supabase dashboard
   */
  private async ensureBucketExists(bucket: string): Promise<void> {
    try {
      // Try to list buckets to check if it exists
      const { data: buckets, error: listError } = await this.supabase.storage.listBuckets();
      
      if (listError) {
        // If we can't list buckets, we'll try to create it
        console.warn(`Cannot list buckets: ${listError.message}. Attempting to create bucket if it doesn't exist.`);
      } else {
        const bucketExists = buckets?.some(b => b.name === bucket);
        if (bucketExists) {
          return; // Bucket exists, no need to create
        }
      }

      // Try to create the bucket
      // Note: This might fail if using anon key - buckets should be created in Supabase dashboard
      const { error: createError } = await this.supabase.storage.createBucket(bucket, {
        public: true,
        allowedMimeTypes: null, // Allow all file types
        fileSizeLimit: 52428800, // 50MB
      });

      if (createError) {
        // If creation fails, it might be because bucket already exists or we don't have permissions
        // Check if error is about bucket already existing
        if (createError.message.includes('already exists') || createError.message.includes('duplicate')) {
          return; // Bucket exists, continue
        }
        
        // For other errors, log but don't throw - let the upload attempt happen
        // The actual upload will fail with a clearer error if bucket doesn't exist
        console.warn(`Could not create bucket '${bucket}': ${createError.message}. Make sure the bucket exists in Supabase Storage.`);
      }
    } catch (error) {
      // If bucket check/creation fails, log but continue
      // The upload will fail with a clear error if bucket doesn't exist
      console.warn(`Error checking/creating bucket '${bucket}':`, error);
    }
  }

  /**
   * Uploads file to Supabase Storage
   */
  async uploadFile(
    buffer: Buffer,
    filename: string,
    folder: string,
    mimetype: string,
    bucket: string = 'images'
  ): Promise<{ url: string; path: string }> {
    // Ensure bucket exists before uploading
    await this.ensureBucketExists(bucket);

    const { data, error } = await this.supabase.storage
      .from(bucket)
      .upload(`${folder}/${filename}`, buffer, {
        contentType: mimetype,
        upsert: true,
      });

    if (error) {
      // Provide more helpful error message for bucket not found
      if (error.message.includes('Bucket not found') || error.message.includes('not found')) {
        throw new Error(
          `Storage bucket '${bucket}' not found. Please create it in your Supabase dashboard: ` +
          `Storage > Buckets > New bucket. Make it public if you want public access.`
        );
      }
      throw new Error(`Failed to upload file: ${error.message}`);
    }

    const { data: urlData } = this.supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return { url: urlData.publicUrl, path: data.path };
  }

  /**
   * Saves file metadata in database
   */
  async saveFileMetadata(metadata: FileMetadata): Promise<string> {
    const values: any = {
      filename: metadata.filename,
      url: metadata.url,
      mimetype: metadata.mimetype,
      size: BigInt(metadata.size),
    };

    if (metadata.thumbnail) values.thumbnail = metadata.thumbnail;
    if (metadata.storageBucket) values.storageBucket = metadata.storageBucket;
    if (metadata.storageKey) values.storageKey = metadata.storageKey;
    if (metadata.cdnUrl) values.cdnUrl = metadata.cdnUrl;
    if (metadata.isPublic !== undefined) values.isPublic = metadata.isPublic;

    const [result] = await this.db
      .insert(files)
      .values(values)
      .returning({ id: files.id });

    return result.id;
  }

  /**
   * Convenience method: upload file and save metadata in one call
   */
  async uploadAndSave(file: {
    buffer: Buffer;
    filename: string;
    folder: string;
    mimetype: string;
    size: number;
    thumbnail?: string;
    bucket?: string;
    isPublic?: boolean;
  }): Promise<{ fileId: string; url: string; path: string }> {
    const uniqueFilename = this.getUniqueFilename(file.filename);
    const { url, path } = await this.uploadFile(
      file.buffer,
      uniqueFilename,
      file.folder,
      file.mimetype,
      file.bucket
    );

    const fileId = await this.saveFileMetadata({
      filename: file.filename,
      url,
      mimetype: file.mimetype,
      size: file.size,
      thumbnail: file.thumbnail,
      storageBucket: file.bucket || 'images',
      storageKey: path,
      isPublic: file.isPublic ?? false,
    });

    return { fileId, url, path };
  }

  private getUniqueFilename(originalName: string) {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const extension = originalName.includes('.') ? originalName.split('.').pop() : '';
    const baseName = originalName.replace(/\.[^/.]+$/, '');
    return extension ? `${baseName}-${timestamp}-${randomStr}.${extension}` : `${baseName}-${timestamp}-${randomStr}`;
  }

  /**
   * Get file by ID
   */
  async getFileById(fileId: string) {
    const result = await this.db
      .select()
      .from(files)
      .where(eq(files.id, fileId))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Delete file from storage and database
   */
  async deleteFile(fileId: string, bucket: string = 'images'): Promise<boolean> {
    try {
      // Get file metadata
      const file = await this.getFileById(fileId);
      if (!file) {
        return false;
      }

      // Delete from Supabase Storage
      if (file.storageKey) {
        const { error: storageError } = await this.supabase.storage
          .from(bucket)
          .remove([file.storageKey]);

        if (storageError) {
          console.error('Failed to delete file from storage:', storageError);
        }
      }

      // Delete from database
      await this.db
        .delete(files)
        .where(eq(files.id, fileId));

      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }
}

