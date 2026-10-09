/**
 * Offline Sync Manager for UC02: Submit and Verify Ground Report.
 * UC02 Alternate Flow: Offline Capture and Delayed Synchronisation.
 * UC02 Exception Flow: Synchronisation Failure.
 * 
 * Manages automated background synchronisation when connectivity restores:
 * - Monitors network connectivity transitions via NetInfo.
 * - Automatically triggers queue processing when the device comes online.
 * - Concurrency control: Prevents overlapping parallel sync batches.
 * - Exponential backoff retry for failed reports without discarding captured observations.
 * - Reactive progress pub/sub subscriptions for UI components and status indicators.
 */
import NetInfo, { type NetInfoSubscription } from '@react-native-community/netinfo';
import {
  getQueuedReports,
  syncSingleQueuedReport,
  type SyncBatchSummary,
  type SyncResult,
} from './offlineQueueService';
import type { OfflineReportQueueItem } from '@/types/groundReport';

export type SyncState = 'idle' | 'syncing' | 'completed' | 'error';

export interface SyncProgressEvent {
  state: SyncState;
  total: number;
  synced: number;
  failed: number;
  currentQueueId?: string | null;
  error?: string | null;
  timestamp: string;
}

export type SyncEventListener = (event: SyncProgressEvent) => void;

class OfflineSyncManager {
  private isSyncing = false;
  private netInfoUnsubscribe: NetInfoSubscription | null = null;
  private isAutoSyncEnabled = false;
  private listeners: Set<SyncEventListener> = new Set();
  private retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private currentProgress: SyncProgressEvent = {
    state: 'idle',
    total: 0,
    synced: 0,
    failed: 0,
    currentQueueId: null,
    error: null,
    timestamp: new Date().toISOString(),
  };

  /**
   * Calculate exponential backoff delay based on attempt count.
   * Base: 2 seconds, Multiplier: 2^(attempts), Max: 60 seconds.
   */
  public calculateBackoffDelay(attempts: number): number {
    const baseMs = 2000;
    const maxMs = 60000;
    const delay = baseMs * Math.pow(2, Math.max(0, attempts - 1));
    return Math.min(delay, maxMs);
  }

  /**
   * Broadcast current progress snapshot to all registered subscribers.
   */
  private notifyListeners() {
    const event = { ...this.currentProgress };
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.warn('Sync listener invocation error:', err);
      }
    });
  }

  /**
   * Subscribe to real-time synchronisation progress updates.
   * Returns an unsubscribe function.
   */
  public subscribe(listener: SyncEventListener): () => void {
    this.listeners.add(listener);
    // Immediately notify subscriber with current status
    listener({ ...this.currentProgress });

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Current status snapshot.
   */
  public getStatus(): SyncProgressEvent {
    return { ...this.currentProgress };
  }

  /**
   * Whether a sync cycle is currently active.
   */
  public getIsSyncing(): boolean {
    return this.isSyncing;
  }

  /**
   * Start listening for connectivity changes to trigger automatic delayed sync.
   */
  public startAutoSync(): void {
    if (this.isAutoSyncEnabled) return;
    this.isAutoSyncEnabled = true;

    let wasOffline = false;

    this.netInfoUnsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);

      if (wasOffline && isOnline) {
        // Transitioned from offline to online -> trigger delayed synchronisation
        console.log('[OfflineSyncManager] Network restored. Triggering auto-sync...');
        this.syncQueue();
      }

      wasOffline = !isOnline;
    });

    // Also test initial connectivity on startup
    NetInfo.fetch().then((state) => {
      const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
      if (isOnline) {
        this.syncQueue();
      } else {
        wasOffline = true;
      }
    });
  }

  /**
   * Stop automated network monitoring.
   */
  public stopAutoSync(): void {
    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
      this.netInfoUnsubscribe = null;
    }
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
    this.isAutoSyncEnabled = false;
  }

  /**
   * Execute synchronisation for all locally queued reports.
   * Concurrency-guarded: skips if another sync cycle is already active.
   */
  public async syncQueue(): Promise<SyncBatchSummary> {
    if (this.isSyncing) {
      console.log('[OfflineSyncManager] Sync cycle already running. Skipping concurrent request.');
      return {
        total: this.currentProgress.total,
        syncedCount: this.currentProgress.synced,
        failedCount: this.currentProgress.failed,
        results: [],
      };
    }

    // Verify online status before beginning
    const netState = await NetInfo.fetch();
    const isOnline = Boolean(netState.isConnected && netState.isInternetReachable !== false);

    if (!isOnline) {
      console.log('[OfflineSyncManager] Device is offline. Sync postponed.');
      return {
        total: 0,
        syncedCount: 0,
        failedCount: 0,
        results: [],
      };
    }

    const queue: OfflineReportQueueItem[] = await getQueuedReports();
    if (queue.length === 0) {
      this.currentProgress = {
        state: 'idle',
        total: 0,
        synced: 0,
        failed: 0,
        currentQueueId: null,
        error: null,
        timestamp: new Date().toISOString(),
      };
      this.notifyListeners();
      return {
        total: 0,
        syncedCount: 0,
        failedCount: 0,
        results: [],
      };
    }

    this.isSyncing = true;
    this.currentProgress = {
      state: 'syncing',
      total: queue.length,
      synced: 0,
      failed: 0,
      currentQueueId: queue[0]?.queueId || null,
      error: null,
      timestamp: new Date().toISOString(),
    };
    this.notifyListeners();

    const results: SyncResult[] = [];
    let syncedCount = 0;
    let failedCount = 0;
    let maxFailedAttempts = 0;

    for (const item of queue) {
      // Re-verify network liveness before each upload to prevent partial stalls
      const currentNet = await NetInfo.fetch();
      const stillOnline = Boolean(currentNet.isConnected && currentNet.isInternetReachable !== false);

      if (!stillOnline) {
        console.log('[OfflineSyncManager] Network disconnected mid-sync. Aborting remainder of queue.');
        failedCount += queue.length - (syncedCount + failedCount);
        break;
      }

      this.currentProgress = {
        ...this.currentProgress,
        currentQueueId: item.queueId,
        synced: syncedCount,
        failed: failedCount,
        timestamp: new Date().toISOString(),
      };
      this.notifyListeners();

      const res = await syncSingleQueuedReport(item);
      results.push(res);

      if (res.success) {
        syncedCount++;
      } else {
        failedCount++;
        maxFailedAttempts = Math.max(maxFailedAttempts, (item.syncAttempts || 0) + 1);
      }
    }

    this.isSyncing = false;
    this.currentProgress = {
      state: failedCount === 0 ? 'completed' : 'error',
      total: queue.length,
      synced: syncedCount,
      failed: failedCount,
      currentQueueId: null,
      error: failedCount > 0 ? `${failedCount} report(s) could not be uploaded.` : null,
      timestamp: new Date().toISOString(),
    };
    this.notifyListeners();

    // If some reports failed, schedule a backoff retry if auto-sync is enabled
    if (failedCount > 0 && this.isAutoSyncEnabled) {
      const delayMs = this.calculateBackoffDelay(maxFailedAttempts);
      console.log(`[OfflineSyncManager] Scheduling retry in ${delayMs / 1000}s for failed reports.`);
      this.retryTimeoutId = setTimeout(() => {
        this.syncQueue();
      }, delayMs);
    }

    return {
      total: queue.length,
      syncedCount,
      failedCount,
      results,
    };
  }
}

// Global Singleton Instance
export const offlineSyncManager = new OfflineSyncManager();

/**
 * Public convenience functions matching Phase 5.2 specification.
 */
export function startAutoSync(): void {
  offlineSyncManager.startAutoSync();
}

export function stopAutoSync(): void {
  offlineSyncManager.stopAutoSync();
}

export function triggerSyncNow(): Promise<SyncBatchSummary> {
  return offlineSyncManager.syncQueue();
}

export function subscribeToSyncProgress(listener: SyncEventListener): () => void {
  return offlineSyncManager.subscribe(listener);
}

export function getSyncManagerStatus(): SyncProgressEvent {
  return offlineSyncManager.getStatus();
}
