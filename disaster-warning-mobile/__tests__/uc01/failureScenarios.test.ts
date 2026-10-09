/**
 * Unit Tests for UC01 Delivery Failure Scenarios (Scenario A & Scenario B).
 *
 * Requirements Tested:
 * Scenario A (Partial Failure):
   - Push succeeds, SMS fails, Audible succeeds.
   - Push logged as successful.
   - SMS logged as failed.
   - Audible still attempted and succeeds.
   - Warning status becomes 'partially_failed' (does not report complete failure).
   - Delivery summary reflects partial delivery.

 * Scenario B (Complete Failure):
   - Push fails, SMS fails, Audible fails.
   - All three channel failures recorded.
   - Warning status becomes 'failed'.
   - Warning document stored in Firestore for audit purposes.
 */
import { executeWarningDispatchPipeline } from '@/services/warningService';
import type { CreateWarningPayload, DeliveryChannel } from '@/types/warning';
import type { ChannelExecutionOptions } from '@/services/deliveryService';

// Mock recipientService so backend recipient resolution succeeds in Jest environment
jest.mock('@/services/recipientService', () => {
  const actual = jest.requireActual('@/services/recipientService');
  return {
    ...actual,
    resolveRecipients: jest.fn().mockImplementation(async (mode, areas) => {
      if (!areas || areas.length === 0) {
        return { recipients: [], recipientCount: 0, contributingDistricts: [] };
      }
      return {
        recipients: [
          { id: 'u-1', fullName: 'User 1', district: 'Ratnapura', role: 'citizen', email: 'u1@test.com' },
          { id: 'u-2', fullName: 'User 2', district: 'Kalutara', role: 'citizen', email: 'u2@test.com' },
        ],
        recipientCount: 2,
        contributingDistricts: ['Ratnapura', 'Kalutara'],
      };
    }),
  };
});

describe('UC01 Delivery Failure Scenarios (Development / Test Layer)', () => {
  const basePayload: CreateWarningPayload = {
    eventId: 'event-test-monsoon-2026',
    hazardEventTitle: 'Southwest Monsoon Flooding 2026',
    hazardType: 'flood',
    severity: 'evacuation',
    targetMode: 'district',
    targetAreas: ['Ratnapura', 'Kalutara'],
    resolvedDistricts: ['Ratnapura', 'Kalutara'],
    recipientCount: 50,
    headline: 'RED FLOOD WARNING: Kalu River Basin',
    instructions: 'Evacuate immediately to designated high ground shelters.',
    channels: ['push', 'sms', 'audible'],
  };

  describe('Scenario A: Partial Delivery Failure', () => {
    it('should log Push as success, SMS as failed, Audible as success, and calculate finalStatus as partially_failed', async () => {
      const scenarioAOptions: Partial<Record<DeliveryChannel, ChannelExecutionOptions>> = {
        sms: {
          mockFailure: true,
          customErrorMessage: 'Cellular SMS Gateway Error: Network carrier timeout.',
        },
      };

      const result = await executeWarningDispatchPipeline(
        basePayload,
        'officer-001',
        'DMC Duty Officer',
        scenarioAOptions,
      );

      expect(result.warningId).toBeDefined();
      expect(result.finalStatus).toBe('partially_failed');

      // Verify Push Channel Result
      const pushRes = result.channelResults.find((r) => r.channel === 'push');
      expect(pushRes?.status).toBe('Success');
      expect(pushRes?.deliveredCount).toBe(result.recipientCount);
      expect(pushRes?.failedCount).toBe(0);

      // Verify SMS Channel Result (Failed)
      const smsRes = result.channelResults.find((r) => r.channel === 'sms');
      expect(smsRes?.status).toBe('Failed');
      expect(smsRes?.deliveredCount).toBe(0);
      expect(smsRes?.failedCount).toBe(result.recipientCount);
      expect(smsRes?.errorMessage).toContain('Cellular SMS Gateway Error');

      // Verify Audible Channel Result (Attempted & Succeeded)
      const audibleRes = result.channelResults.find((r) => r.channel === 'audible');
      expect(audibleRes?.status).toBe('Success');
      expect(audibleRes?.deliveredCount).toBe(result.recipientCount);
      expect(audibleRes?.failedCount).toBe(0);

      // Verify 3 logs saved for audit
      expect(result.deliveryLogs.length).toBe(3);
    });
  });

  describe('Scenario B: Complete Delivery Failure', () => {
    it('should record failures for all three channels, mark finalStatus as failed, and preserve warning document for audit', async () => {
      const scenarioBOptions: Partial<Record<DeliveryChannel, ChannelExecutionOptions>> = {
        push: {
          mockFailure: true,
          customErrorMessage: 'Push Gateway Unreachable.',
        },
        sms: {
          mockFailure: true,
          customErrorMessage: 'Cellular SMS Gateway Quota Exceeded.',
        },
        audible: {
          mockFailure: true,
          customErrorMessage: 'Audible Siren Control Sector Power Outage.',
        },
      };

      const result = await executeWarningDispatchPipeline(
        basePayload,
        'officer-001',
        'DMC Duty Officer',
        scenarioBOptions,
      );

      expect(result.warningId).toBeDefined();
      expect(result.finalStatus).toBe('failed');

      // Verify all 3 channels recorded as failed
      expect(result.channelResults.length).toBe(3);
      result.channelResults.forEach((chRes) => {
        expect(chRes.status).toBe('Failed');
        expect(chRes.deliveredCount).toBe(0);
        expect(chRes.failedCount).toBe(result.recipientCount);
        expect(chRes.errorMessage).toBeDefined();
      });

      // Verify delivery logs preserved for audit
      expect(result.deliveryLogs.length).toBe(3);
      result.deliveryLogs.forEach((log) => {
        expect(log.status).toBe('Failed');
        expect(log.warningId).toBe(result.warningId);
      });
    });
  });
});
