/**
 * Offline Queue Service for UC02: Submit and Verify Ground Report.
 * Handles offline report storage, local queue persistence, and delayed synchronization.
 * Aligned with UC02 Alternate Flow: Offline Capture and Delayed Synchronisation,
 * and Exception Flow: Synchronisation Failure (preserves queued report and supports retry).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  CreateGroundReportData,
  OfflineReportQueueItem,
} from '@/types/groundReport';
import type { UserRole } from '@/types/auth';
import { uploadGroundReportPhoto } from './photoUploadService';
import { submitGroundReport } from './groundReportService';

const QUEUE_STORAGE_KEY = '@ground_reports_offline_queue_v1';

export interface SyncResult {
  queueId: string;
  success: boolean;
  referenceNumber?: string;
  reportId?: string;
  error?: string;
}

export interface SyncBatchSummary {
  total: number;
  syncedCount: number;
  failedCount: number;
  results: SyncResult[];
}

/**
 * Get all reports currently in the local offline queue.
 */
export async function getQueuedReports(): Promise<OfflineReportQueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to read offline report queue from storage:', err);
    return [];
  }
}

/**
 * Get the current count of queued offline reports.
 */
export async function getOfflineQueueCount(): Promise<number> {
  const queue = await getQueuedReports();
  return queue.length;
}

/**
 * Store a ground report in the offline queue (UC02 Alternate Flow).
 * Preserves observation type, description, photograph URI, GPS location, and capture time.
 */
export async function queueOfflineReport(
  data: CreateGroundReportData,
  submitter: {
    id: string;
    fullName: string;
    role: UserRole;
  },
): Promise<OfflineReportQueueItem> {
  const queue = await getQueuedReports();
  const queueId = `offline-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const queueItem: OfflineReportQueueItem = {
    queueId,
    reportData: {
      observationType: data.observationType,
      description: data.description,
      location: data.location,
      locationName: data.locationName,
      district: data.district,
      isManualLocation: data.isManualLocation,
      captureTime: data.captureTime,
    },
    localPhotoUri: data.photoUri,
    submitterId: submitter.id,
    submitterName: submitter.fullName,
    submitterRole: submitter.role,
    queuedAt: new Date().toISOString(),
    syncAttempts: 0,
    lastSyncError: null,
  };

  queue.push(queueItem);
  await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  return queueItem;
}

/**
 * Remove an item from the offline queue after successful synchronization.
 */
export async function removeQueuedReport(queueId: string): Promise<void> {
  try {
    const queue = await getQueuedReports();
    const filtered = queue.filter((item) => item.queueId !== queueId);
    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.warn('Failed to remove synced report from queue:', err);
  }
}

/**
 * Record a failed sync attempt and update error message without discarding data.
 */
export async function recordSyncAttemptFailure(
  queueId: string,
  errorMessage: string,
): Promise<void> {
  try {
    const queue = await getQueuedReports();
    const updated = queue.map((item) => {
      if (item.queueId === queueId) {
        return {
          ...item,
          syncAttempts: (item.syncAttempts || 0) + 1,
          lastSyncError: errorMessage,
        };
      }
      return item;
    });
    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to update sync attempt failure:', err);
  }
}

/**
 * Synchronize a single queued report to Cloud Firebase.
 * Uploads photo, creates Firestore document, and clears it from local queue on success.
 */
export async function syncSingleQueuedReport(
  item: OfflineReportQueueItem,
): Promise<SyncResult> {
  try {
    // 1. Upload photograph to Firebase Storage
    let photoUrl = '';
    let photoPath: string | null = null;

    if (item.localPhotoUri) {
      const uploadRes = await uploadGroundReportPhoto(
        item.localPhotoUri,
        item.queueId,
      );
      photoUrl = uploadRes.photoUrl;
      photoPath = uploadRes.photoPath;
    }

    // 2. Submit report into Cloud Firestore
    const res = await submitGroundReport(
      {
        ...item.reportData,
        photoUri: item.localPhotoUri,
      },
      photoUrl,
      photoPath,
      {
        id: item.submitterId,
        fullName: item.submitterName,
        role: item.submitterRole,
      },
    );

    // 3. Remove from local queue
    await removeQueuedReport(item.queueId);

    return {
      queueId: item.queueId,
      success: true,
      referenceNumber: res.referenceNumber,
      reportId: res.id,
    };
  } catch (error) {
    const errorMsg = (error as Error)?.message || 'Synchronization failed';
    await recordSyncAttemptFailure(item.queueId, errorMsg);
    return {
      queueId: item.queueId,
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Synchronize all reports currently waiting in the offline queue (delayed synchronisation).
 * Preserves failed reports for subsequent retries.
 */
export async function syncAllQueuedReports(): Promise<SyncBatchSummary> {
  const queue = await getQueuedReports();
  if (queue.length === 0) {
    return {
      total: 0,
      syncedCount: 0,
      failedCount: 0,
      results: [],
    };
  }

  const results: SyncResult[] = [];
  let syncedCount = 0;
  let failedCount = 0;

  for (const item of queue) {
    const res = await syncSingleQueuedReport(item);
    results.push(res);
    if (res.success) {
      syncedCount++;
    } else {
      failedCount++;
    }
  }

  return {
    total: queue.length,
    syncedCount,
    failedCount,
    results,
  };
}

/**
 * Clear all items in the queue (e.g. for testing / debugging reset).
 */
export async function clearOfflineQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
}
