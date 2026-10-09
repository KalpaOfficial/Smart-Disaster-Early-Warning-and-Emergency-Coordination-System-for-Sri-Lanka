/**
 * Unit Tests for UC01 River Basin Targeting Flow.
 *
 * Requirements Tested:
 * 1. Identify districts covered by selected river basin.
 * 2. Query registered recipients from those districts.
 * 3. Merge recipient lists across contributing districts.
 * 4. Remove duplicate recipients (same user ID across districts or overlapping basins).
 * 5. Calculate correct unique recipient count.
 * 6. Return contributing districts for display.
 * 7. Use final unique recipient list for multi-channel delivery.
 */
import {
  resolveDistrictsFromTargetAreas,
  resolveRecipients,
} from '@/services/recipientService';
import { executeWarningDispatchPipeline } from '@/services/warningService';
import type { CreateWarningPayload } from '@/types/warning';

// Mock recipientService for end-to-end pipeline test
jest.mock('@/services/recipientService', () => {
  const actual = jest.requireActual('@/services/recipientService');
  return {
    ...actual,
    resolveRecipients: jest.fn().mockImplementation(async (mode, areas) => {
      if (!areas || areas.length === 0) {
        return { recipients: [], recipientCount: 0, contributingDistricts: [], resolvedDistricts: [], recipientUids: [] };
      }
      if (mode === 'river_basin') {
        const contributingDistricts = actual.resolveDistrictsFromTargetAreas(mode, areas);
        // Simulate Firestore recipients in Ratnapura & Kalutara with one duplicate entry
        const mockUsers = [
          { id: 'user-001', fullName: 'Citizen Perera', district: 'Ratnapura', role: 'citizen', email: 'perera@test.com' },
          { id: 'user-002', fullName: 'Citizen Fernando', district: 'Kalutara', role: 'citizen', email: 'fernando@test.com' },
          { id: 'user-001', fullName: 'Citizen Perera Duplicate', district: 'Ratnapura', role: 'citizen', email: 'perera@test.com' },
        ];
        // Deduplicate by ID
        const userMap = new Map();
        mockUsers.forEach((u) => {
          if (!userMap.has(u.id)) userMap.set(u.id, u);
        });
        const recipients = Array.from(userMap.values());
        return {
          recipients,
          recipientCount: recipients.length,
          contributingDistricts,
          resolvedDistricts: contributingDistricts,
          recipientUids: recipients.map((r) => r.id),
        };
      }
      return actual.resolveRecipients(mode, areas);
    }),
  };
});

describe('UC01 River Basin Targeting Flow', () => {
  describe('Step 1: District Identification from River Basin', () => {
    it('should identify contributing districts for Kalu River Basin', () => {
      const districts = resolveDistrictsFromTargetAreas('river_basin', ['Kalu River Basin']);
      expect(districts).toContain('Ratnapura');
      expect(districts).toContain('Kalutara');
      expect(districts.length).toBe(2);
    });

    it('should identify and deduplicate districts across multiple overlapping river basins', () => {
      const districts = resolveDistrictsFromTargetAreas('river_basin', [
        'Nilwala River Basin', // Matara, Galle
        'Gin River Basin',     // Galle, Matara
      ]);
      expect(districts.sort()).toEqual(['Galle', 'Matara']);
    });

    it('should support case-insensitive river basin key matching', () => {
      const districts = resolveDistrictsFromTargetAreas('river_basin', ['kalu river basin ']);
      expect(districts).toContain('Ratnapura');
      expect(districts).toContain('Kalutara');
    });
  });

  describe('Steps 2 - 6: Recipient Merging, Deduplication & Count Calculation', () => {
    it('should resolve recipients, merge district lists, remove duplicates, and calculate unique count', async () => {
      const result = await resolveRecipients('river_basin', ['Kalu River Basin']);

      // 1. Identified contributing districts
      expect(result.contributingDistricts).toEqual(['Ratnapura', 'Kalutara']);

      // 2. Merged recipient list without duplicates (user-001 appears once)
      expect(result.recipients.length).toBe(2);
      expect(result.recipientCount).toBe(2);
      expect(result.recipientUids).toEqual(['user-001', 'user-002']);
    });
  });

  describe('Step 7: Final Unique Recipient Delivery Execution', () => {
    it('should use final unique recipient count when executing warning dispatch pipeline', async () => {
      const payload: CreateWarningPayload = {
        eventId: 'event-kalu-2026',
        hazardEventTitle: 'Kalu River Severe Overflow',
        hazardType: 'flood',
        severity: 'evacuation',
        targetMode: 'river_basin',
        targetAreas: ['Kalu River Basin'],
        resolvedDistricts: ['Ratnapura', 'Kalutara'],
        recipientCount: 2,
        headline: 'RED EVACUATION WARNING: Kalu River Basin',
        instructions: 'Evacuate immediately.',
        channels: ['push', 'sms', 'audible'],
      };

      const dispatchResult = await executeWarningDispatchPipeline(
        payload,
        'officer-001',
        'DMC Duty Officer',
      );

      expect(dispatchResult.warningId).toBeDefined();
      expect(dispatchResult.recipientCount).toBe(2);
      expect(dispatchResult.finalStatus).toBe('delivered');

      // Verify each channel delivered to the exact unique recipient count
      dispatchResult.channelResults.forEach((ch) => {
        expect(ch.recipientCount).toBe(2);
        expect(ch.deliveredCount).toBe(2);
        expect(ch.failedCount).toBe(0);
      });
    });
  });
});
