import {
  dispatchMultiChannelWarning,
  sendPush,
  sendSMS,
  sendAudible,
} from '@/services/deliveryService';
import type { DeliveryChannel } from '@/types/warning';
import type { RecipientUser } from '@/services/recipientService';

const recipients: RecipientUser[] = Array.from({ length: 20 }, (_, i) => ({
  id: `user-${i}`,
  fullName: `User ${i}`,
  email: `user${i}@example.com`,
  district: 'Colombo',
  role: 'citizen',
}));
const warning = { headline: 'Flood warning', recipientCount: 999 };
const selections: DeliveryChannel[][] = [
  ['push'],
  ['sms'],
  ['audible'],
  ['push', 'sms'],
  ['push', 'audible'],
  ['sms', 'audible'],
  ['push', 'sms', 'audible'],
];

describe('Warning delivery channel checks (simulation)', () => {
  it.each(selections.map(channels => [channels.join('+'), channels] as const))(
    'dispatches only the selected channels: %s',
    async (_, channels) => {
      const result = await dispatchMultiChannelWarning(warning, recipients, [...channels]);
      expect(result.channelResults.map(item => item.channel)).toEqual(channels);
      expect(result.overallStatus).toBe('Success');
      expect(result.totalDelivered).toBe(recipients.length * channels.length);
      for (const item of result.channelResults) {
        expect(item.recipientCount).toBe(recipients.length);
        expect(item.deliveredCount + item.failedCount).toBe(item.recipientCount);
      }
    }
  );

  it.each(['push', 'sms', 'audible'] as const)(
    'preserves the partial counts for %s without stopping other channels',
    async channel => {
      const result = await dispatchMultiChannelWarning(
        warning,
        recipients,
        ['push', 'sms', 'audible'],
        { [channel]: { mockPartialFailure: true } }
      );
      expect(result.overallStatus).toBe('Partial');
      for (const item of result.channelResults) {
        expect(item.status).toBe(item.channel === channel ? 'Partial' : 'Success');
        expect(item.deliveredCount + item.failedCount).toBe(recipients.length);
      }
      expect(result.totalDelivered + result.totalFailed).toBe(recipients.length * 3);
    }
  );

  it.each([
    ['push', sendPush],
    ['sms', sendSMS],
    ['audible', sendAudible],
  ] as const)(
    '%s does not report delivery to a stale preview count when recipients are empty',
    async (_, send) => {
      const result = await send(warning, []);
      expect(result.recipientCount).toBe(0);
      expect(result.deliveredCount).toBe(0);
      expect(result.failedCount).toBe(0);
      expect(result.status).toBe('Failed');
      expect(result.errorMessage).toContain('No registered recipients');
    }
  );
});
