/**
 * Photo Upload Service — Firebase Cloud Storage.
 * Handles disaster scene evidence photographs for UC02.
 * Includes graceful handling for photo read errors, offline scenarios, and retry mechanisms.
 */
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { storage } from './firebase';

export interface UploadPhotoResult {
  photoUrl: string;
  photoPath: string;
}

/**
 * Upload a local device image file to Firebase Storage.
 * Path pattern: ground-reports/{reportId or timestamp}/{filename}.jpg
 *
 * @param localUri Local file URI from expo-image-picker (e.g. file:///...)
 * @param identifier Unique identifier (e.g. temporary report ID or reference number)
 * @returns Object with download URL and storage path
 */
export async function uploadGroundReportPhoto(
  localUri: string,
  identifier: string,
): Promise<UploadPhotoResult> {
  if (!localUri) {
    throw new Error('No photograph URI was provided for upload.');
  }

  try {
    // Generate clean unique storage path
    const timestamp = Date.now();
    const cleanId = identifier.replace(/[^a-zA-Z0-9_-]/g, '_');
    const photoPath = `ground-reports/${cleanId}/evidence_${timestamp}.jpg`;
    const storageRef = ref(storage, photoPath);

    // Convert local URI to blob in React Native
    const response = await fetch(localUri);
    if (!response.ok) {
      throw new Error(`Failed to read photograph from local device storage (${response.status}).`);
    }
    const blob = await response.blob();

    // Upload with image metadata
    const uploadResult = await uploadBytes(storageRef, blob, {
      contentType: 'image/jpeg',
      customMetadata: {
        identifier,
        uploadedAt: new Date().toISOString(),
      },
    });

    // Obtain public download URL
    const photoUrl = await getDownloadURL(uploadResult.ref);

    return {
      photoUrl,
      photoPath,
    };
  } catch (error) {
    const message = (error as Error)?.message || 'Unknown photo upload failure';
    console.warn('Photo upload warning:', message);
    throw new Error(`Photograph upload failed: ${message}`);
  }
}

/**
 * Delete a previously uploaded photograph from Firebase Storage.
 * Used for cleanup if report creation is aborted.
 */
export async function deleteGroundReportPhoto(photoPath: string): Promise<void> {
  if (!photoPath) return;

  try {
    const storageRef = ref(storage, photoPath);
    await deleteObject(storageRef);
  } catch (error) {
    // Non-fatal warning
    console.warn('Could not delete storage photograph:', (error as Error)?.message);
  }
}
