import { OBSERVATION_TYPES } from '@/constants/observationTypes';
import { getReportPermissions } from '@/constants/reportPermissions';
import type { ObservationType } from '@/types/groundReport';

describe('UC02: Ground Report Form Validation Rules', () => {
  describe('Observation Type Validation', () => {
    it('accepts all valid Sri Lankan hazard observation types', () => {
      const validTypes: ObservationType[] = [
        'rising_water',
        'blocked_road',
        'landslide_crack',
        'other',
      ];
      const configuredValues = OBSERVATION_TYPES.map((t) => t.value);
      validTypes.forEach((type) => {
        expect(configuredValues).toContain(type);
      });
    });

    it('rejects unconfigured observation type values', () => {
      const configuredValues = OBSERVATION_TYPES.map((t) => t.value);
      expect(configuredValues).not.toContain('alien_invasion');
      expect(configuredValues).not.toContain('');
    });
  });

  describe('Description Field Validation', () => {
    const validateDescription = (desc: string): { valid: boolean; error?: string } => {
      const trimmed = desc.trim();
      if (!trimmed) {
        return { valid: false, error: 'Description is required.' };
      }
      if (trimmed.length < 10) {
        return { valid: false, error: 'Description must be at least 10 characters.' };
      }
      if (trimmed.length > 2000) {
        return { valid: false, error: 'Description cannot exceed 2000 characters.' };
      }
      return { valid: true };
    };

    it('rejects empty or whitespace-only descriptions', () => {
      expect(validateDescription('').valid).toBe(false);
      expect(validateDescription('   ').valid).toBe(false);
    });

    it('rejects descriptions shorter than 10 characters', () => {
      expect(validateDescription('water').valid).toBe(false);
      expect(validateDescription('flood').error).toContain('at least 10 characters');
    });

    it('accepts descriptions with 10 or more characters', () => {
      expect(
        validateDescription('Floodwaters reached 2 feet near Kelani bridge').valid,
      ).toBe(true);
    });
  });

  describe('Geographic Coordinate Validation', () => {
    const isValidSriLankaCoordinate = (lat: number, lng: number): boolean => {
      // Sri Lanka bounding box approx: Lat 5.9°N to 9.9°N, Long 79.5°E to 81.9°E
      const validLat = lat >= 5.5 && lat <= 10.0;
      const validLng = lng >= 79.0 && lng <= 82.5;
      return validLat && validLng;
    };

    it('accepts coordinates within Sri Lankan territorial boundaries', () => {
      // Colombo
      expect(isValidSriLankaCoordinate(6.9271, 79.8612)).toBe(true);
      // Kandy
      expect(isValidSriLankaCoordinate(7.2906, 80.6337)).toBe(true);
      // Jaffna
      expect(isValidSriLankaCoordinate(9.6615, 80.0255)).toBe(true);
    });

    it('flags coordinates outside Sri Lanka', () => {
      // London
      expect(isValidSriLankaCoordinate(51.5074, -0.1278)).toBe(false);
      // Zero coordinates (Null Island)
      expect(isValidSriLankaCoordinate(0, 0)).toBe(false);
    });
  });

  describe('Role-Based Access Validation', () => {
    it('authorizes citizens and volunteers to submit reports', () => {
      expect(getReportPermissions('citizen').canSubmit).toBe(true);
      expect(getReportPermissions('volunteer').canSubmit).toBe(true);
    });

    it('forbids officers from submitting ground observation reports', () => {
      expect(getReportPermissions('dmc_officer').canSubmit).toBe(false);
      expect(getReportPermissions('district_officer').canSubmit).toBe(false);
    });

    it('restricts report verification exclusively to DMC Duty Officers', () => {
      expect(getReportPermissions('dmc_officer').canVerify).toBe(true);
      expect(getReportPermissions('citizen').canVerify).toBe(false);
      expect(getReportPermissions('volunteer').canVerify).toBe(false);
      expect(getReportPermissions('district_officer').canVerify).toBe(false);
    });

    it('returns safe default fallback permissions for null, undefined, or unknown roles', () => {
      expect(getReportPermissions(null)).toEqual({
        canSubmit: false,
        canVerify: false,
        canSeeQueue: false,
        canSeeOwnReports: false,
        canViewVerifiedReports: true,
      });

      expect(getReportPermissions(undefined)).toEqual({
        canSubmit: false,
        canVerify: false,
        canSeeQueue: false,
        canSeeOwnReports: false,
        canViewVerifiedReports: true,
      });

      expect(
        getReportPermissions(
          'random_invalid_role' as unknown as Parameters<typeof getReportPermissions>[0],
        ),
      ).toEqual({
        canSubmit: false,
        canVerify: false,
        canSeeQueue: false,
        canSeeOwnReports: false,
        canViewVerifiedReports: true,
      });
    });
  });
});
