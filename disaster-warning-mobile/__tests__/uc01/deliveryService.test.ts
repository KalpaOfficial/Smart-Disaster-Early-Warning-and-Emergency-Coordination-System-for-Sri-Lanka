/**
 * Unit Tests for UC01 Delivery Service Abstraction (`services/deliveryService.ts`).
 */
import {
  sendPush,
  sendSMS,
  sendAudible,
  dispatchMultiChannelWarning,
} from '@/services/deliveryService';
import type { RecipientUser } from '@/services/recipientService';

describe('UC01 Delivery Service Abstraction', () => {
  const mockWarning = {
    id: 'warning-123',
    headline: 'RED FLOOD WARNING',
    instructions: 'Evacuate to higher ground.',
    recipientCount: 50,
  };

  const mockRecipients: RecipientUser[] = [
    { id: 'usr-1', fullName: 'Citizen 1', email: 'c1@test.com', district: 'Ratnapura', role: 'citizen' },
    { id: 'usr-2', fullName: 'Citizen 2', email: 'c2@test.com', district: 'Kalutara', role: 'citizen' },
  ];

  describe('sendPush()', () => {
    it('should return Success result on normal dispatch', async () => {
      const res = await sendPush(mockWarning, mockRecipients);
      expect(res.channel).toBe('push');
      expect(res.status).toBe('Success');
      expect(res.deliveredCount).toBe(2);
      expect(res.failedCount).toBe(0);
    });

    it('should return Failed status when mock failure is triggered', async () => {
      const res = await sendPush(mockWarning, mockRecipients, { mockFailure: true });
      expect(res.channel).toBe('push');
      expect(res.status).toBe('Failed');
      expect(res.deliveredCount).toBe(0);
      expect(res.failedCount).toBe(2);
      expect(res.errorMessage).toBeDefined();
    });
  });

  describe('sendSMS()', () => {
    it('should return Success result on normal SMS dispatch', async () => {
      const res = await sendSMS(mockWarning, mockRecipients);
      expect(res.channel).toBe('sms');
      expect(res.status).toBe('Success');
      expect(res.deliveredCount).toBe(2);
    });

    it('should return Failed status when mock failure is triggered', async () => {
      const res = await sendSMS(mockWarning, mockRecipients, { mockFailure: true });
      expect(res.channel).toBe('sms');
      expect(res.status).toBe('Failed');
      expect(res.failedCount).toBe(2);
    });
  });

  describe('sendAudible()', () => {
    it('should return Success result on audible siren dispatch', async () => {
      const res = await sendAudible(mockWarning, mockRecipients);
      expect(res.channel).toBe('audible');
      expect(res.status).toBe('Success');
      expect(res.deliveredCount).toBe(2);
    });

    it('should return Failed status when siren tower fails', async () => {
      const res = await sendAudible(mockWarning, mockRecipients, { mockFailure: true });
      expect(res.channel).toBe('audible');
      expect(res.status).toBe('Failed');
    });
  });

  describe('dispatchMultiChannelWarning()', () => {
    it('should execute all channels in parallel and aggregate summary', async () => {
      const summary = await dispatchMultiChannelWarning(
        mockWarning,
        mockRecipients,
        ['push', 'sms', 'audible'],
      );

      expect(summary.channelResults.length).toBe(3);
      expect(summary.overallStatus).toBe('Success');
      expect(summary.totalDelivered).toBe(6); // 2 per channel * 3 channels
      expect(summary.totalFailed).toBe(0);
    });

    it('should allow one channel to fail without stopping other selected channels (Fault Isolation)', async () => {
      const summary = await dispatchMultiChannelWarning(
        mockWarning,
        mockRecipients,
        ['push', 'sms', 'audible'],
        {
          sms: { mockFailure: true }, // SMS fails, Push & Audible succeed
        },
      );

      expect(summary.channelResults.length).toBe(3);
      const pushRes = summary.channelResults.find((r) => r.channel === 'push');
      const smsRes = summary.channelResults.find((r) => r.channel === 'sms');
      const audibleRes = summary.channelResults.find((r) => r.channel === 'audible');

      expect(pushRes?.status).toBe('Success');
      expect(smsRes?.status).toBe('Failed');
      expect(audibleRes?.status).toBe('Success');
      expect(summary.overallStatus).toBe('Partial');
    });
  });
});
