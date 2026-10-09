/**
 * Unit Tests for UC01 Warning Creation Service (`createWarningDocument`).
 */
import { createWarningDocument } from '@/services/warningService';
import type { CreateWarningPayload } from '@/types/warning';

describe('UC01 Warning Creation Process', () => {
  const validPayload: CreateWarningPayload = {
    eventId: 'event-monsoon-2026',
    hazardEventTitle: 'Southwest Monsoon Severe Flooding 2026',
    hazardType: 'flood',
    severity: 'evacuation',
    targetMode: 'district',
    targetAreas: ['Ratnapura', 'Kalutara'],
    resolvedDistricts: ['Ratnapura', 'Kalutara'],
    recipientCount: 50,
    headline: 'RED EVACUATION WARNING: Kalu River Basin',
    instructions: 'Evacuate immediately to designated safe shelters.',
    channels: ['push', 'sms'],
  };

  it('should throw validation error if severity is missing', async () => {
    const invalidPayload = { ...validPayload, severity: '' as unknown as CreateWarningPayload['severity'] };
    await expect(createWarningDocument(invalidPayload, 'test-officer-uid')).rejects.toThrow(
      'Emergency severity level is mandatory.',
    );
  });

  it('should throw validation error if targetAreas is empty', async () => {
    const invalidPayload = { ...validPayload, targetAreas: [] };
    await expect(createWarningDocument(invalidPayload, 'test-officer-uid')).rejects.toThrow(
      'At least one target area must be selected.',
    );
  });

  it('should throw validation error if headline is empty', async () => {
    const invalidPayload = { ...validPayload, headline: '   ' };
    await expect(createWarningDocument(invalidPayload, 'test-officer-uid')).rejects.toThrow(
      'Warning headline is mandatory.',
    );
  });

  it('should throw validation error if instructions are empty', async () => {
    const invalidPayload = { ...validPayload, instructions: '' };
    await expect(createWarningDocument(invalidPayload, 'test-officer-uid')).rejects.toThrow(
      'Emergency instruction text is mandatory.',
    );
  });

  it('should throw validation error if channels array is empty', async () => {
    const invalidPayload = { ...validPayload, channels: [] };
    await expect(createWarningDocument(invalidPayload, 'test-officer-uid')).rejects.toThrow(
      'At least one delivery channel (Push, SMS, or Audible) must be selected.',
    );
  });
});
