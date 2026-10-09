import {
  offlineSyncManager,
  triggerSyncNow,
  subscribeToSyncProgress,
  getSyncManagerStatus,
} from '@/services/offlineSyncManager';
import {
  queueOfflineReport,
  clearOfflineQueue,
  getOfflineQueueCount,
} from '@/services/offlineQueueService';
import type { CreateGroundReportData } from '@/types/groundReport';

describe('UC02: Offline Sync Manager & Auto-Reconnection', () => {
  const sampleReportData: CreateGroundReportData = {
    observationType: 'blocked_road',
    description: 'Fallen Mara tree completely blocking baseline road near Dematagoda flyover.',
    photoUri: 'file:///local/cache/tree-blocked.jpg',
    location: {
      latitude: 6.9321,
      longitude: 79.8791,
    },
    locationName: 'Baseline Road - Dematagoda',
    district: 'Colombo',
    isManualLocation: false,
    captureTime: '2026-10-09T08:00:00.000Z',
  };

  const citizenActor = {
    id: 'user-cit-882',
    fullName: 'Anura Kumara',
    role: 'citizen' as const,
  };

  beforeEach(async () => {
    await clearOfflineQueue();
  });

  describe('Exponential Backoff Calculations', () => {
    it('calculates exponential backoff delay correctly with cap at 60s', () => {
      // attempt 1 -> 2s
      expect(offlineSyncManager.calculateBackoffDelay(1)).toBe(2000);
      // attempt 2 -> 4s
      expect(offlineSyncManager.calculateBackoffDelay(2)).toBe(4000);
      // attempt 3 -> 8s
      expect(offlineSyncManager.calculateBackoffDelay(3)).toBe(8000);
      // attempt 6 -> capped at 60s
      expect(offlineSyncManager.calculateBackoffDelay(6)).toBe(60000);
      // attempt 10 -> capped at 60s
      expect(offlineSyncManager.calculateBackoffDelay(10)).toBe(60000);
    });
  });

  describe('Sync Progress Subscriptions (Reactive Pub/Sub)', () => {
    it('notifies listeners of progress updates during queue synchronization', async () => {
      await queueOfflineReport(sampleReportData, citizenActor);

      const events: string[] = [];
      const unsubscribe = subscribeToSyncProgress((event) => {
        events.push(event.state);
      });

      // Trigger sync
      await triggerSyncNow();

      expect(events).toContain('syncing');
      expect(events).toContain('completed');

      unsubscribe();
    });

    it('returns idle state when queue is empty', async () => {
      const summary = await triggerSyncNow();
      expect(summary.total).toBe(0);
      expect(summary.syncedCount).toBe(0);

      const current = getSyncManagerStatus();
      expect(current.state).toBe('idle');
    });
  });

  describe('Batch Drain Verification', () => {
    it('successfully uploads queued reports and drains local queue', async () => {
      await queueOfflineReport(sampleReportData, citizenActor);
      await queueOfflineReport(
        { ...sampleReportData, observationType: 'rising_water' },
        citizenActor,
      );

      expect(await getOfflineQueueCount()).toBe(2);

      const summary = await triggerSyncNow();

      expect(summary.total).toBe(2);
      expect(summary.syncedCount).toBe(2);
      expect(summary.failedCount).toBe(0);

      // Queue is now empty
      expect(await getOfflineQueueCount()).toBe(0);
    });
  });
});
