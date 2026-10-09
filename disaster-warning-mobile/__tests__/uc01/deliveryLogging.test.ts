/**
 * Unit Tests for UC01 Delivery Logging (`saveDeliveryLogs` & `getDeliveryLogsForWarning`).
 */
import { saveDeliveryLogs } from '@/services/warningService';
import type { ChannelResult } from '@/types/warning';

describe('UC01 Delivery Logging Process', () => {
  const mockWarningId = 'warning-test-101';

  const mockChannelResults: ChannelResult[] = [
    {
      channel: 'push',
      recipientCount: 2481,
      deliveredCount: 2475,
      failedCount: 6,
      status: 'Partial',
      errorMessage: '6 mobile push tokens expired.',
    },
    {
      channel: 'sms',
      recipientCount: 2481,
      deliveredCount: 2470,
      failedCount: 11,
      status: 'Partial',
      errorMessage: '11 SMS messages undelivered due to coverage.',
    },
    {
      channel: 'audible',
      recipientCount: 2481,
      deliveredCount: 2481,
      failedCount: 0,
      status: 'Success',
    },
  ];

  it('should create one delivery log document for every selected channel', async () => {
    const logs = await saveDeliveryLogs(mockWarningId, mockChannelResults);

    expect(logs.length).toBe(3);
    expect(logs.map((l) => l.channel)).toEqual(['push', 'sms', 'audible']);
  });

  it('should preserve failed delivery count and error messages in log objects', async () => {
    const logs = await saveDeliveryLogs(mockWarningId, mockChannelResults);

    const pushLog = logs.find((l) => l.channel === 'push');
    expect(pushLog).toBeDefined();
    expect(pushLog?.warningId).toBe(mockWarningId);
    expect(pushLog?.recipientCount).toBe(2481);
    expect(pushLog?.deliveredCount).toBe(2475);
    expect(pushLog?.failedCount).toBe(6);
    expect(pushLog?.status).toBe('Partial');
    expect(pushLog?.errorMessage).toBe('6 mobile push tokens expired.');
  });

  it('should not create logs for channels that were not selected', async () => {
    const pushOnlyResults: ChannelResult[] = [
      {
        channel: 'push',
        recipientCount: 100,
        deliveredCount: 100,
        failedCount: 0,
        status: 'Success',
      },
    ];

    const logs = await saveDeliveryLogs(mockWarningId, pushOnlyResults);

    expect(logs.length).toBe(1);
    expect(logs[0].channel).toBe('push');
    expect(logs.find((l) => l.channel === 'sms')).toBeUndefined();
    expect(logs.find((l) => l.channel === 'audible')).toBeUndefined();
  });
});
