/**
 * Unit Tests for End-to-End UC01 Warning Dispatch Pipeline (`executeWarningDispatchPipeline`).
 */
import { executeWarningDispatchPipeline } from '@/services/warningService';
import type { CreateWarningPayload } from '@/types/warning';

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
        recipientCount: 50,
        contributingDistricts: ['Ratnapura', 'Kalutara'],
      };
    }),
  };
});

describe('UC01 Warning Dispatch Pipeline', () => {
  const validPayload: CreateWarningPayload = {
    eventId: 'event-monsoon-2026',
    hazardEventTitle: 'Southwest Monsoon Severe Flooding 2026',
    hazardType: 'flood',
    severity: 'evacuation',
    targetMode: 'district',
    targetAreas: ['Ratnapura', 'Kalutara'],
    resolvedDistricts: ['Ratnapura', 'Kalutara'],
    recipientCount: 50,
    headline: 'URGENT FLOOD EVACUATION ALERT',
    instructions: 'Evacuate immediately to safe shelters.',
    channels: ['push', 'sms', 'audible'],
  };

  it('should validate form and reject if headline is empty', async () => {
    const invalidPayload = { ...validPayload, headline: '' };
    await expect(
      executeWarningDispatchPipeline(invalidPayload, 'officer-uid', 'Officer Perera'),
    ).rejects.toThrow('Warning headline is mandatory.');
  });

  it('should execute pipeline, calculate delivered status when all channels succeed', async () => {
    const result = await executeWarningDispatchPipeline(
      validPayload,
      'officer-uid',
      'Officer Perera',
    );

    expect(result.warningId).toBeDefined();
    expect(result.finalStatus).toBe('delivered');
    expect(result.channelResults.length).toBe(3);
    expect(result.channelResults.every((r) => r.status === 'Success')).toBe(true);
  });

  it('should calculate partially_failed status when one channel fails and others succeed', async () => {
    const result = await executeWarningDispatchPipeline(
      validPayload,
      'officer-uid',
      'Officer Perera',
      {
        sms: { mockFailure: true }, // SMS channel fails
      },
    );

    expect(result.warningId).toBeDefined();
    expect(result.finalStatus).toBe('partially_failed');
    expect(result.channelResults.length).toBe(3);

    const smsRes = result.channelResults.find((r) => r.channel === 'sms');
    const pushRes = result.channelResults.find((r) => r.channel === 'push');

    expect(smsRes?.status).toBe('Failed');
    expect(pushRes?.status).toBe('Success');
  });

  it('should calculate failed status when ALL channels fail', async () => {
    const result = await executeWarningDispatchPipeline(
      validPayload,
      'officer-uid',
      'Officer Perera',
      {
        push: { mockFailure: true },
        sms: { mockFailure: true },
        audible: { mockFailure: true },
      },
    );

    expect(result.warningId).toBeDefined();
    expect(result.finalStatus).toBe('failed');
    expect(result.channelResults.every((r) => r.status === 'Failed')).toBe(true);
  });
});
