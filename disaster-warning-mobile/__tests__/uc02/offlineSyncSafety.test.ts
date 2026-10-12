import NetInfo from '@react-native-community/netinfo';
import { offlineSyncManager } from '@/services/offlineSyncManager';
import { getQueuedReports, syncSingleQueuedReport } from '@/services/offlineQueueService';
jest.mock('@/services/offlineQueueService', () => ({
  getQueuedReports: jest.fn(),
  syncSingleQueuedReport: jest.fn(),
}));
beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
  offlineSyncManager.stopAutoSync();
  (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true, isInternetReachable: true });
  (getQueuedReports as jest.Mock).mockResolvedValue([{ queueId: 'queued', syncAttempts: 0 }]);
  (syncSingleQueuedReport as jest.Mock).mockResolvedValue({ queueId: 'queued', success: true });
});
afterEach(() => {
  offlineSyncManager.stopAutoSync();
  jest.useRealTimers();
  jest.restoreAllMocks();
});
it('locks before asynchronous network and queue checks so concurrent syncs upload only once', async () => {
  await Promise.all([offlineSyncManager.syncQueue(), offlineSyncManager.syncQueue()]);
  expect(syncSingleQueuedReport).toHaveBeenCalledTimes(1);
  expect(offlineSyncManager.getIsSyncing()).toBe(false);
});
it('releases its lock after an unexpected upload exception so a later retry works', async () => {
  (syncSingleQueuedReport as jest.Mock).mockRejectedValueOnce(
    new Error('Unexpected upload exception')
  );
  await expect(offlineSyncManager.syncQueue()).rejects.toThrow('Unexpected upload exception');
  expect(offlineSyncManager.getIsSyncing()).toBe(false);
  expect(offlineSyncManager.getStatus().state).toBe('error');
  expect((await offlineSyncManager.syncQueue()).syncedCount).toBe(1);
});
it('releases its lock when connectivity or local queue loading fails', async () => {
  (NetInfo.fetch as jest.Mock).mockRejectedValueOnce(new Error('Connectivity unavailable'));
  await expect(offlineSyncManager.syncQueue()).rejects.toThrow('Connectivity unavailable');
  (getQueuedReports as jest.Mock).mockRejectedValueOnce(new Error('Queue unavailable'));
  await expect(offlineSyncManager.syncQueue()).rejects.toThrow('Queue unavailable');
  expect((await offlineSyncManager.syncQueue()).syncedCount).toBe(1);
});

it('synchronizes when an initially offline device reconnects and does not register duplicate listeners', async () => {
  (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({ isConnected: false });
  offlineSyncManager.startAutoSync();
  offlineSyncManager.startAutoSync();
  await jest.advanceTimersByTimeAsync(0);
  expect(NetInfo.addEventListener).toHaveBeenCalledTimes(1);
  expect(syncSingleQueuedReport).not.toHaveBeenCalled();
  const onNetworkChange = (NetInfo.addEventListener as jest.Mock).mock.calls[0][0];
  onNetworkChange({ isConnected: true, isInternetReachable: null });
  await jest.advanceTimersByTimeAsync(0);
  expect(syncSingleQueuedReport).toHaveBeenCalledTimes(1);
  expect(offlineSyncManager.getStatus().state).toBe('completed');
  onNetworkChange({ isConnected: true, isInternetReachable: true });
  await jest.advanceTimersByTimeAsync(0);
  expect(syncSingleQueuedReport).toHaveBeenCalledTimes(1);
});

it('does not upload on an unreachable network and resumes after connectivity returns', async () => {
  (getQueuedReports as jest.Mock).mockResolvedValue([]);
  offlineSyncManager.startAutoSync();
  await jest.advanceTimersByTimeAsync(0);
  const onNetworkChange = (NetInfo.addEventListener as jest.Mock).mock.calls[0][0];
  onNetworkChange({ isConnected: true, isInternetReachable: false });
  expect(syncSingleQueuedReport).not.toHaveBeenCalled();
  (getQueuedReports as jest.Mock).mockResolvedValue([{ queueId: 'queued' }]);
  onNetworkChange({ isConnected: true, isInternetReachable: true });
  await jest.advanceTimersByTimeAsync(0);
  expect(syncSingleQueuedReport).toHaveBeenCalledTimes(1);
});

it('handles an initial network lookup failure and still accepts a later manual retry', async () => {
  (NetInfo.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network lookup failed'));
  offlineSyncManager.startAutoSync();
  await jest.advanceTimersByTimeAsync(0);
  expect(syncSingleQueuedReport).not.toHaveBeenCalled();
  expect((await offlineSyncManager.syncQueue()).syncedCount).toBe(1);
});

it('retries failed reports after the backoff delay and recovers to completed', async () => {
  (getQueuedReports as jest.Mock).mockResolvedValue([{ queueId: 'queued', syncAttempts: 2 }]);
  (syncSingleQueuedReport as jest.Mock).mockResolvedValueOnce({
    queueId: 'queued',
    success: false,
  });
  offlineSyncManager.startAutoSync();
  await jest.advanceTimersByTimeAsync(0);
  expect(offlineSyncManager.getStatus().state).toBe('error');
  await jest.advanceTimersByTimeAsync(7999);
  expect(syncSingleQueuedReport).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(1);
  expect(syncSingleQueuedReport).toHaveBeenCalledTimes(2);
  expect(offlineSyncManager.getStatus().state).toBe('completed');
});

it('cancels scheduled retries and unsubscribes when auto-sync is stopped', async () => {
  const unsubscribe = jest.fn();
  (NetInfo.addEventListener as jest.Mock).mockReturnValueOnce(unsubscribe);
  (syncSingleQueuedReport as jest.Mock).mockResolvedValue({ queueId: 'queued', success: false });
  offlineSyncManager.startAutoSync();
  await jest.advanceTimersByTimeAsync(0);
  offlineSyncManager.stopAutoSync();
  await jest.advanceTimersByTimeAsync(60000);
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  expect(syncSingleQueuedReport).toHaveBeenCalledTimes(1);
});

it('stops remaining uploads when connectivity is lost mid-batch', async () => {
  (getQueuedReports as jest.Mock).mockResolvedValue([{ queueId: 'first' }, { queueId: 'second' }]);
  (NetInfo.fetch as jest.Mock)
    .mockResolvedValueOnce({ isConnected: true })
    .mockResolvedValueOnce({ isConnected: true })
    .mockResolvedValueOnce({ isConnected: false });
  const result = await offlineSyncManager.syncQueue();
  expect(result).toMatchObject({ total: 2, syncedCount: 1, failedCount: 1 });
  expect(syncSingleQueuedReport).toHaveBeenCalledTimes(1);
  expect(offlineSyncManager.getStatus().state).toBe('error');
});

it('isolates a failing progress listener so other listeners and upload still complete', async () => {
  const failingListener = jest
    .fn()
    .mockImplementationOnce(() => {})
    .mockImplementation(() => {
      throw new Error('UI listener failed');
    });
  const healthyListener = jest.fn();
  const removeFailing = offlineSyncManager.subscribe(failingListener);
  const removeHealthy = offlineSyncManager.subscribe(healthyListener);
  try {
    expect((await offlineSyncManager.syncQueue()).syncedCount).toBe(1);
    expect(healthyListener).toHaveBeenLastCalledWith(
      expect.objectContaining({ state: 'completed' })
    );
    expect(console.warn).toHaveBeenCalledWith('Sync listener invocation error:', expect.any(Error));
  } finally {
    removeFailing();
    removeHealthy();
  }
});
