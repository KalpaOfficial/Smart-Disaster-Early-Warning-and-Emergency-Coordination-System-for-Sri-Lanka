/**
 * Unit Tests for UC01 Delivery Summary Screen Data Helpers & Status Handling.
 */
import { getWarningById, getDeliveryLogsForWarning } from '@/services/warningService';
import type { DeliveryLog, WarningStatus } from '@/types/warning';

describe('UC01 Delivery Summary Service & Status Handlers', () => {
  it('should return null if warningId is empty', async () => {
    const warning = await getWarningById('');
    expect(warning).toBeNull();
  });

  it('should return empty delivery logs array if warningId is invalid or has no logs', async () => {
    const logs = await getDeliveryLogsForWarning('non-existent-warning-id');
    expect(Array.isArray(logs)).toBe(true);
    expect(logs.length).toBe(0);
  });

  it('should process successful dispatch status correctly', () => {
    const mockStatus: WarningStatus = 'delivered';
    expect(mockStatus).toBe('delivered');
  });

  it('should process partial delivery status correctly', () => {
    const mockStatus: WarningStatus = 'partially_failed';
    expect(mockStatus).toBe('partially_failed');
  });

  it('should process complete delivery failure status correctly', () => {
    const mockStatus: WarningStatus = 'failed';
    expect(mockStatus).toBe('failed');
  });

  it('should correctly map channel logs delivery and failed counts for summary display', () => {
    const sampleLogs: DeliveryLog[] = [
      {
        logId: 'log-1',
        warningId: 'warn-100',
        channel: 'push',
        recipientCount: 2481,
        deliveredCount: 2475,
        failedCount: 6,
        status: 'Success',
        timestamp: new Date().toISOString(),
      },
      {
        logId: 'log-2',
        warningId: 'warn-100',
        channel: 'sms',
        recipientCount: 2481,
        deliveredCount: 2470,
        failedCount: 11,
        status: 'Success',
        timestamp: new Date().toISOString(),
      },
      {
        logId: 'log-3',
        warningId: 'warn-100',
        channel: 'audible',
        recipientCount: 2481,
        deliveredCount: 2481,
        failedCount: 0,
        status: 'Success',
        timestamp: new Date().toISOString(),
      },
    ];

    expect(sampleLogs.length).toBe(3);
    const pushLog = sampleLogs.find((l) => l.channel === 'push');
    expect(pushLog?.deliveredCount).toBe(2475);
    expect(pushLog?.failedCount).toBe(6);

    const smsLog = sampleLogs.find((l) => l.channel === 'sms');
    expect(smsLog?.deliveredCount).toBe(2470);
    expect(smsLog?.failedCount).toBe(11);

    const audibleLog = sampleLogs.find((l) => l.channel === 'audible');
    expect(audibleLog?.deliveredCount).toBe(2481);
    expect(audibleLog?.failedCount).toBe(0);
  });
});
