import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
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
  return new Promise((resolve, reject) => {
    if (typeof FileReader === 'undefined') {
      reject(new Error('Could not read the photograph. Please take or choose it again.'));
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string' && reader.result.length > 30) resolve(reader.result);
      else reject(new Error('The photograph could not be read.'));
    };
    reader.onerror = () => reject(new Error('The photograph could not be read.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Resize and compress an image Blob or Data URL on Web using HTML5 Canvas.
 * Ensures the output string is ~30KB-60KB, far below Firestore's 1,048,487 byte document field limit.
 */
function compressImageOnWeb(
  source: Blob | string,
  maxDimension = 800,
  quality = 0.6
): Promise<string> {
  return new Promise((resolve, reject) => {
    const resolveOriginal = () => {
      if (typeof source === 'string') resolve(source.length > 800000 ? '' : source);
      else blobToDataUrl(source).then(res => resolve(res.length > 800000 ? '' : res), reject);
    };
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      resolveOriginal();
      return;
    }

    let objectUrl: string | null = null;
    const releaseObjectUrl = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    };
    try {
      const img = new window.Image();
      objectUrl = typeof source === 'string' ? null : URL.createObjectURL(source);
      const srcUrl = typeof source === 'string' ? source : objectUrl!;

      img.onload = () => {
        releaseObjectUrl();
        try {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(width, 1);
          canvas.height = Math.max(height, 1);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolveOriginal();
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl.length > 800000 ? '' : compressedDataUrl);
        } catch {
          reject(new Error('Could not process the photograph. Please take or choose it again.'));
        }
      };

      img.onerror = () => {
        releaseObjectUrl();
        reject(new Error('Could not read the photograph. Please take or choose it again.'));
      };

      img.src = srcUrl;
    } catch {
      releaseObjectUrl();
      resolveOriginal();
    }
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
  identifier: string
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

    // Fast-path: if localUri is already a Data URL, compress it to fit Firestore
    if (isWeb && localUri.startsWith('data:')) {
      const compressed = await compressImageOnWeb(localUri);
      if (!compressed)
        throw new Error('The photograph is too large. Please choose a smaller image.');
      return {
        photoUrl: compressed,
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
      throw new Error(
        'Failed to read photograph from local device storage: ' +
          ((readErr as Error)?.message || 'file missing')
      );
    }

    // On web browser environment, Firebase Cloud Storage enforces CORS preflight headers
    // which block localhost/browser origins unless bucket CORS is configured via gsutil.
    // Resize and compress image to a compact Base64 data URL (<60KB) to safely fit Firestore limits.
    if (isWeb) {
      const dataUrl = await compressImageOnWeb(blob);
      if (!dataUrl) throw new Error('The photograph could not be read.');
      return {
        photoUrl: dataUrl,
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
