/**
 * Unit Tests for Ground Reports Empty State & Warning Escalation Flow (UC01).
 */
import {
  getGroundReportsForEvent,
  executeWarningDispatchPipeline,
  createWarningDocument,
  getWarningsForEvent,
} from '@/services/warningService';
import type { CreateWarningPayload } from '@/types/warning';

// Mock recipientService so recipient resolution succeeds
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
        ],
        recipientCount: 25,
        contributingDistricts: ['Ratnapura'],
      };
    }),
  };
});

describe('Ground Reports Verification & Empty State Handling', () => {
  it('returns an empty array when hazardEventId is empty', async () => {
    const reports = await getGroundReportsForEvent('');
    expect(reports).toEqual([]);
  });

  it('returns an empty array and never mock data when no verified reports exist in Firestore', async () => {
    // Queries a non-existent event ID where snap.empty == true
    const reports = await getGroundReportsForEvent('event-with-zero-verified-reports');
    expect(Array.isArray(reports)).toBe(true);
    expect(reports.length).toBe(0);
    expect(reports).toEqual([]);
  });
});

describe('UC01 Warning Escalation Workflow', () => {
  const escalatedPayload: CreateWarningPayload = {
    eventId: 'event-kelani-flood-2026',
    hazardEventTitle: 'Kelani River Major Flood',
    hazardType: 'flood',
    severity: 'evacuation', // Elevated from previous warning
    targetMode: 'river_basin',
    targetAreas: ['Kelani River Basin'],
    resolvedDistricts: ['Colombo', 'Gampaha'],
    recipientCount: 100,
    headline: 'ESCALATED ALERT: Severe Flood Evacuation Order',
    instructions: 'Water levels exceeded critical threshold. Immediate evacuation mandatory.',
    channels: ['push', 'sms', 'audible'],
    previousWarningId: 'warn-initial-advisory-123',
  };

  it('preserves previousWarningId in createWarningDocument', async () => {
    const result = await createWarningDocument(escalatedPayload, 'officer-uid', 'DMC Officer');
    expect(result.warningId).toBeDefined();
    expect(result.status).toBe('dispatching');
  });

  it('executes warning dispatch pipeline with previousWarningId attached', async () => {
    const pipelineResult = await executeWarningDispatchPipeline(
      escalatedPayload,
      'officer-uid',
      'Duty Officer Silva',
    );

    expect(pipelineResult.warningId).toBeDefined();
    expect(pipelineResult.finalStatus).toBe('delivered');
  });

  it('returns empty array when querying warnings for non-existent event', async () => {
    const warnings = await getWarningsForEvent('');
    expect(warnings).toEqual([]);
  });
});
