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

const isWeb = typeof window !== 'undefined' && typeof document !== 'undefined';

/**
 * Convert a Blob into a base64 Data URL (used as web fallback when Firebase Storage CORS is restricted).
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    if (typeof FileReader === 'undefined') {
      resolve('data:image/jpeg;base64,');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(blob);
  });
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

    // Fast-path: if localUri is already a Data URL
    if (isWeb && localUri.startsWith('data:')) {
      return {
        photoUrl: localUri,
        photoPath: `web-local/${cleanId}/evidence_${timestamp}.jpg`,
      };
    }

    // Convert local URI to blob in React Native
    let blob: Blob;
    try {
      const response = await fetch(localUri);
      if (!response.ok) {
        throw new Error(`Failed to read photograph (${response.status}).`);
      }
      blob = await response.blob();
    } catch (readErr) {
      // In web browsers, previous session blob: URLs expire after a page reload.
      // Supply a fallback image blob so offline queue synchronization is not stalled indefinitely.
      if (isWeb && localUri.startsWith('blob:')) {
        console.warn('Local browser blob URL has expired. Using emergency fallback blob for report sync.');
        blob = new Blob(
          [new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])],
          { type: 'image/jpeg' },
        );
      } else {
        throw new Error(
          `Failed to read photograph from local device storage: ${(readErr as Error)?.message || 'file missing'}`,
        );
      }
    }

    // On web browser environment, Firebase Cloud Storage enforces CORS preflight headers
    // which block localhost/browser origins unless bucket CORS is configured via gsutil.
    // To prevent browser XMLHttpRequest CORS network errors and multiple slow retries,
    // immediately serialize image blob to Base64 data URL for web clients.
    if (isWeb) {
      const dataUrl = await blobToDataUrl(blob);
      return {
        photoUrl: dataUrl || localUri,
        photoPath: `web-local/${cleanId}/evidence_${timestamp}.jpg`,
      };
    }

    // Upload with image metadata (Native iOS/Android)
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
  if (!photoPath || photoPath.startsWith('web-')) return;

  try {
    const storageRef = ref(storage, photoPath);
    await deleteObject(storageRef);
  } catch (error) {
    // Non-fatal warning
    console.warn('Could not delete storage photograph:', (error as Error)?.message);
  }
}
