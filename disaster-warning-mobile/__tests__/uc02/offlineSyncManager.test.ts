import {
  offlineSyncManager,
  startAutoSync,
  stopAutoSync,
  triggerSyncNow,
  subscribeToSyncProgress,
  getSyncManagerStatus,
  type SyncProgressEvent,
} from '@/services/offlineSyncManager';
import {
  queueOfflineReport,
  clearOfflineQueue,
} from '@/services/offlineQueueService';
import NetInfo from '@react-native-community/netinfo';
import type { CreateGroundReportData } from '@/types/groundReport';

describe('UC02: Offline Sync Manager & Automated Delayed Synchronization', () => {
  const sampleReportData: CreateGroundReportData = {
    observationType: 'rising_water',
    description: 'River water level rising near canal crossing.',
    photoUri: 'file:///local/cache/photo-sync.jpg',
    location: {
      latitude: 6.9271,
      longitude: 79.8612,
    },
    locationName: 'Colombo 07',
    district: 'Colombo',
    isManualLocation: false,
    captureTime: '2026-10-09T08:00:00.000Z',
  };

  const citizenSubmitter = {
    id: 'user-sync-01',
    fullName: 'Test Submitter',
    role: 'citizen' as const,
  };

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    await clearOfflineQueue();
    stopAutoSync();
    // Reset NetInfo to online by default
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    stopAutoSync();
    jest.useRealTimers();
  });

  describe('Exponential Backoff Calculations (UC02 Exception Flow)', () => {
    it('calculates 2000ms delay for the initial attempt', () => {
      expect(offlineSyncManager.calculateBackoffDelay(1)).toBe(2000);
      expect(offlineSyncManager.calculateBackoffDelay(0)).toBe(2000);
    });

    it('calculates exponentially doubling delay for subsequent attempts', () => {
      expect(offlineSyncManager.calculateBackoffDelay(2)).toBe(4000);
      expect(offlineSyncManager.calculateBackoffDelay(3)).toBe(8000);
      expect(offlineSyncManager.calculateBackoffDelay(4)).toBe(16000);
    });

    it('caps backoff delay at 60,000ms (60 seconds) maximum', () => {
      expect(offlineSyncManager.calculateBackoffDelay(10)).toBe(60000);
      expect(offlineSyncManager.calculateBackoffDelay(50)).toBe(60000);
    });
  });

  describe('Reactive Subscriptions and Progress Broadcasts (UC02 Step 11)', () => {
    it('notifies subscribers immediately upon subscription with current snapshot', () => {
      const listener = jest.fn();
      const unsubscribe = offlineSyncManager.subscribe(listener);

      expect(listener).toHaveBeenCalledTimes(1);
      const snapshot: SyncProgressEvent = listener.mock.calls[0][0];
      expect(snapshot).toBeDefined();
      expect(snapshot.state).toBeDefined();

      unsubscribe();
    });

    it('allows subscribers to unsubscribe cleanly without lingering callbacks', () => {
      const listener = jest.fn();
      const unsubscribe = offlineSyncManager.subscribe(listener);
      unsubscribe();

      listener.mockClear();
      // Internal notification trigger
      (offlineSyncManager as unknown as { notifyListeners: () => void }).notifyListeners();
      expect(listener).not.toHaveBeenCalled();
    });

    it('provides current status snapshot via getStatus()', () => {
      const status = offlineSyncManager.getStatus();
      expect(status).toHaveProperty('state');
      expect(status).toHaveProperty('total');
      expect(status).toHaveProperty('synced');
      expect(status).toHaveProperty('failed');
    });

    it('reports whether a sync process is active via getIsSyncing()', () => {
      expect(offlineSyncManager.getIsSyncing()).toBe(false);
    });
  });

  describe('Queue Synchronization Execution (UC02 Delayed Synchronization)', () => {
    it('returns empty summary when device is offline without touching storage', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({
        isConnected: false,
        isInternetReachable: false,
      });

      const summary = await offlineSyncManager.syncQueue();
      expect(summary.total).toBe(0);
      expect(summary.syncedCount).toBe(0);
      expect(summary.failedCount).toBe(0);
    });

    it('returns empty summary and sets idle state when queue is already empty', async () => {
      const summary = await offlineSyncManager.syncQueue();
      expect(summary.total).toBe(0);
      expect(offlineSyncManager.getStatus().state).toBe('idle');
    });

    it('successfully synchronizes queued reports and marks state completed', async () => {
      await queueOfflineReport(sampleReportData, citizenSubmitter);

      const progressEvents: SyncProgressEvent[] = [];
      const unsub = offlineSyncManager.subscribe((e) => {
        progressEvents.push(e);
      });

      const summary = await offlineSyncManager.syncQueue();
      expect(summary.total).toBe(1);
      expect(summary.syncedCount).toBe(1);
      expect(summary.failedCount).toBe(0);

      expect(offlineSyncManager.getStatus().state).toBe('completed');
      unsub();
    });

    it('guards against overlapping concurrent sync invocations', async () => {
      // Artificially simulate isSyncing
      (offlineSyncManager as unknown as { isSyncing: boolean }).isSyncing = true;

      const summary = await offlineSyncManager.syncQueue();
      expect(summary.results).toEqual([]);

      // Reset
      (offlineSyncManager as unknown as { isSyncing: boolean }).isSyncing = false;
    });

    it('records error state and triggers backoff timer when a report fails upload', async () => {
      await queueOfflineReport(sampleReportData, citizenSubmitter);

      // Force failure during sync
      const origFetch = globalThis.fetch;
      globalThis.fetch = jest.fn(async () => ({
        ok: false,
        status: 500,
      })) as unknown as typeof fetch;

      // Enable autoSync to test retry timer branch
      offlineSyncManager.startAutoSync();

      const summary = await offlineSyncManager.syncQueue();
      expect(summary.failedCount).toBe(1);
      expect(offlineSyncManager.getStatus().state).toBe('error');
      expect(offlineSyncManager.getStatus().error).toContain('could not be uploaded');

      globalThis.fetch = origFetch;
      stopAutoSync();
    });
  });

  describe('Auto-Sync Lifecycle & Convenience Functions', () => {
    it('starts and stops autoSync listener cleanly', () => {
      startAutoSync();
      expect(NetInfo.addEventListener).toHaveBeenCalled();

      stopAutoSync();
      expect(offlineSyncManager.getIsSyncing()).toBe(false);
    });

    it('exposes public convenience functions', async () => {
      expect(getSyncManagerStatus()).toBeDefined();

      const listener = jest.fn();
      const unsub = subscribeToSyncProgress(listener);
      expect(listener).toHaveBeenCalled();
      unsub();

      const summary = await triggerSyncNow();
      expect(summary).toBeDefined();
    });
  });
});
