/**
 * Unit Tests for UC01 Recipient Resolution Service (`services/recipientService.ts`).
 */
import {
  resolveDistrictsFromTargetAreas,
  resolveRecipients,
} from '@/services/recipientService';

describe('UC01 Recipient Resolution Service', () => {
  describe('resolveDistrictsFromTargetAreas', () => {
    it('should return empty array when targetAreas is empty', () => {
      const districts = resolveDistrictsFromTargetAreas('district', []);
      expect(districts).toEqual([]);
    });

    it('should return deduplicated districts in District target mode', () => {
      const districts = resolveDistrictsFromTargetAreas('district', [
        'Ratnapura',
        'Kalutara',
        'Ratnapura',
      ]);
      expect(districts).toEqual(['Ratnapura', 'Kalutara']);
    });

    it('should map river basins to contributing districts and deduplicate in River Basin mode', () => {
      const districts = resolveDistrictsFromTargetAreas('river_basin', [
        'Kalu River Basin',
        'Nilwala River Basin',
      ]);
      // Kalu River Basin -> Ratnapura, Kalutara
      // Nilwala River Basin -> Matara, Galle
      expect(districts).toContain('Ratnapura');
      expect(districts).toContain('Kalutara');
      expect(districts).toContain('Matara');
      expect(districts).toContain('Galle');
      expect(districts.length).toBe(4);
    });

    it('should handle overlapping districts across multiple river basins', () => {
      const districts = resolveDistrictsFromTargetAreas('river_basin', [
        'Nilwala River Basin', // Matara, Galle
        'Gin River Basin',     // Galle, Matara
      ]);
      // Should deduplicate Matara and Galle
      expect(districts.sort()).toEqual(['Galle', 'Matara']);
    });
  });

  describe('resolveRecipients', () => {
    it('should handle empty target areas gracefully', async () => {
      const result = await resolveRecipients('district', []);
      expect(result.recipients).toEqual([]);
      expect(result.recipientCount).toBe(0);
      expect(result.contributingDistricts).toEqual([]);
    });
  });
});
