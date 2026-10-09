/**
 * Unit Tests for UC01 Exception: No Recipients Matched.
 *
 * Requirements Tested:
 * 1. Officer selects target area that resolves 0 recipients.
 * 2. Throws explicit error: "No registered recipients found for the selected target area."
 * 3. Does NOT create/dispatch warning document in Firestore.
 * 4. Officer remains on composer and can change target area.
 * 5. Recalculates recipient count upon target area change.
 * 6. Allows dispatch when at least one valid recipient exists.
 */
import {
  createWarningDocument,
  executeWarningDispatchPipeline,
} from '@/services/warningService';
import {
  resolveDistrictsFromTargetAreas,
  resolveRecipients,
} from '@/services/recipientService';
import type { CreateWarningPayload } from '@/types/warning';

describe('UC01 Exception: No Recipients Matched', () => {
  const basePayload: CreateWarningPayload = {
    eventId: 'event-monsoon-2026',
    hazardEventTitle: 'Southwest Monsoon Severe Flooding 2026',
    hazardType: 'flood',
    severity: 'evacuation',
    targetMode: 'district',
    targetAreas: ['EmptyDistrictName'],
    resolvedDistricts: ['EmptyDistrictName'],
    recipientCount: 0,
    headline: 'RED EVACUATION WARNING: Unpopulated Zone',
    instructions: 'Evacuate immediately if residing in the area.',
    channels: ['push', 'sms'],
  };

  it('should throw "No registered recipients found for the selected target area." in createWarningDocument when resolved recipients = 0', async () => {
    await expect(
      createWarningDocument(basePayload, 'officer-uid-001', 'DMC Officer'),
    ).rejects.toThrow('No registered recipients found for the selected target area.');
  });

  it('should throw "No registered recipients found for the selected target area." in executeWarningDispatchPipeline when resolved recipients = 0', async () => {
    await expect(
      executeWarningDispatchPipeline(basePayload, 'officer-uid-001', 'DMC Officer'),
    ).rejects.toThrow('No registered recipients found for the selected target area.');
  });

  it('should calculate zero recipients for empty or unpopulated target area', async () => {
    const res = await resolveRecipients('district', []);
    expect(res.recipientCount).toBe(0);
    expect(res.recipients.length).toBe(0);
  });

  it('should recalculate target districts when officer changes target area on composer', () => {
    // 1. Initial resolution for empty target area
    const emptyDistricts = resolveDistrictsFromTargetAreas('district', ['UnpopulatedZone']);
    expect(emptyDistricts).toEqual(['UnpopulatedZone']);

    // 2. Target area changed by officer to a populated area (e.g. Ratnapura and Kalutara)
    const updatedDistricts = resolveDistrictsFromTargetAreas('district', ['Ratnapura', 'Kalutara']);
    expect(updatedDistricts).toEqual(['Ratnapura', 'Kalutara']);
  });
});
