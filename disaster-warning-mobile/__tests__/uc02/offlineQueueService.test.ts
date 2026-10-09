import {
  queueOfflineReport,
  getQueuedReports,
  getOfflineQueueCount,
  removeQueuedReport,
  clearOfflineQueue,
  recordSyncAttemptFailure,
} from '@/services/offlineQueueService';
import type { CreateGroundReportData } from '@/types/groundReport';

describe('UC02: Offline Queue Service', () => {
  const sampleReportData: CreateGroundReportData = {
    observationType: 'rising_water',
    description: 'Kelani river overflow breached the lower road embankment in Kelaniya.',
    photoUri: 'file:///local/cache/photo-123.jpg',
    location: {
      latitude: 6.9553,
      longitude: 79.9189,
    },
    locationName: 'Kelaniya Raja Maha Vihara Access Rd',
    district: 'Gampaha',
    isManualLocation: false,
    captureTime: '2026-10-09T08:00:00.000Z',
  };

  const citizenSubmitter = {
    id: 'user-citizen-001',
    fullName: 'Kamal Perera',
    role: 'citizen' as const,
  };

  beforeEach(async () => {
    await clearOfflineQueue();
  });

  it('stores an offline report in local queue with metadata', async () => {
    const queueItem = await queueOfflineReport(sampleReportData, citizenSubmitter);

    expect(queueItem).toBeDefined();
    expect(queueItem.queueId).toMatch(/^offline-\d+-\d+$/);
    expect(queueItem.syncAttempts).toBe(0);
    expect(queueItem.lastSyncError).toBeNull();
    expect(queueItem.submitterId).toBe(citizenSubmitter.id);
    expect(queueItem.reportData.observationType).toBe('rising_water');
    expect(queueItem.localPhotoUri).toBe(sampleReportData.photoUri);
  });

  it('updates the queue count when reports are added', async () => {
    expect(await getOfflineQueueCount()).toBe(0);

    await queueOfflineReport(sampleReportData, citizenSubmitter);
    expect(await getOfflineQueueCount()).toBe(1);

    await queueOfflineReport(
      { ...sampleReportData, description: 'Second road blockage observation' },
      citizenSubmitter,
    );
    expect(await getOfflineQueueCount()).toBe(2);
  });

  it('retrieves all queued reports in order', async () => {
    await queueOfflineReport(sampleReportData, citizenSubmitter);
    await queueOfflineReport(
      { ...sampleReportData, observationType: 'blocked_road' },
      citizenSubmitter,
    );

    const queued = await getQueuedReports();
    expect(queued).toHaveLength(2);
    expect(queued[0].reportData.observationType).toBe('rising_water');
    expect(queued[1].reportData.observationType).toBe('blocked_road');
  });

  it('removes a report from queue after successful synchronization', async () => {
    const item1 = await queueOfflineReport(sampleReportData, citizenSubmitter);
    const item2 = await queueOfflineReport(
      { ...sampleReportData, observationType: 'landslide_crack' },
      citizenSubmitter,
    );

    expect(await getOfflineQueueCount()).toBe(2);

    await removeQueuedReport(item1.queueId);

    const remaining = await getQueuedReports();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].queueId).toBe(item2.queueId);
  });

  it('updates sync attempt counter and preserves error messages on failure', async () => {
    const item = await queueOfflineReport(sampleReportData, citizenSubmitter);

    await recordSyncAttemptFailure(item.queueId, 'Network timeout connecting to Cloud Firestore');

    const updatedQueue = await getQueuedReports();
    const updatedItem = updatedQueue.find((i) => i.queueId === item.queueId);

    expect(updatedItem).toBeDefined();
    expect(updatedItem?.syncAttempts).toBe(1);
    expect(updatedItem?.lastSyncError).toContain('Network timeout');
  });

  it('rejects officer roles from queuing ground reports', async () => {
    const officerSubmitter = {
      id: 'officer-dmc-001',
      fullName: 'Major Silva',
      role: 'dmc_officer' as const,
    };

    await expect(
      queueOfflineReport(sampleReportData, officerSubmitter),
    ).rejects.toThrow(/Unauthorized/);
  });
});
