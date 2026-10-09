/**
 * Unit Tests for UC03 Resource Validation & Location Integrity Constraints.
 *
 * Implements UC03:
 * - Precondition validation: Shelter, rescue team, and relief supply inputs
 * - Exception Flow: Invalid Resource Location (district & spatial coordinates)
 * - Positive numerical constraints (capacity > 0, crew size > 0, inventory > 0, dispatch > 0)
 * - Mandatory administrative fields checks
 */
import { SRI_LANKAN_DISTRICTS, FACILITY_TYPES, ORGANISATION_TYPES, SUPPLY_TYPES } from '@/constants/districts';

describe('UC03: Resource Input Validation & Location Integrity', () => {
  describe('Sri Lankan Administrative Districts Integrity', () => {
    it('contains all 25 official administrative districts of Sri Lanka', () => {
      expect(SRI_LANKAN_DISTRICTS).toHaveLength(25);
      expect(SRI_LANKAN_DISTRICTS).toContain('Ratnapura');
      expect(SRI_LANKAN_DISTRICTS).toContain('Kalutara');
      expect(SRI_LANKAN_DISTRICTS).toContain('Colombo');
      expect(SRI_LANKAN_DISTRICTS).toContain('Gampaha');
      expect(SRI_LANKAN_DISTRICTS).toContain('Kegalle');
      expect(SRI_LANKAN_DISTRICTS).toContain('Galle');
      expect(SRI_LANKAN_DISTRICTS).toContain('Matara');
      expect(SRI_LANKAN_DISTRICTS).toContain('Kandy');
      expect(SRI_LANKAN_DISTRICTS).toContain('Batticaloa');
      expect(SRI_LANKAN_DISTRICTS).toContain('Jaffna');
    });

    it('rejects invalid or misspelled district names (Exception Flow: Invalid Resource Location)', () => {
      const isValidDistrict = (district: string): boolean => {
        return (SRI_LANKAN_DISTRICTS as readonly string[]).includes(district);
      };

      expect(isValidDistrict('Ratnapura')).toBe(true);
      expect(isValidDistrict('Kalutara')).toBe(true);
      expect(isValidDistrict('London')).toBe(false);
      expect(isValidDistrict('Colombo_North_Invalid')).toBe(false);
      expect(isValidDistrict('')).toBe(false);
    });

    it('validates spatial coordinates within Sri Lankan national bounding box', () => {
      // Sri Lanka bounding box roughly: Lat 5.8° to 9.9° N, Lon 79.5° to 82.0° E
      const isLocationInSriLanka = (lat: number, lon: number): boolean => {
        return lat >= 5.8 && lat <= 9.9 && lon >= 79.5 && lon <= 82.0;
      };

      // Valid coordinates: Ratnapura (6.68, 80.40), Colombo (6.92, 79.86), Jaffna (9.66, 80.01)
      expect(isLocationInSriLanka(6.6828, 80.4035)).toBe(true);
      expect(isLocationInSriLanka(6.9271, 79.8612)).toBe(true);
      expect(isLocationInSriLanka(9.6615, 80.0255)).toBe(true);

      // Invalid / Off-island coordinates
      expect(isLocationInSriLanka(0.0, 0.0)).toBe(false);
      expect(isLocationInSriLanka(51.5074, -0.1278)).toBe(false); // London
      expect(isLocationInSriLanka(13.0827, 80.2707)).toBe(false); // Chennai
    });
  });

  describe('Shelter Input Constraints Validation', () => {
    const validateShelterForm = (form: {
      name: string;
      facilityType: string;
      address: string;
      district: string;
      capacity: string | number;
      managerName: string;
      managerContact: string;
      organisationType: string;
      organisationName: string;
    }): { valid: boolean; error?: string } => {
      if (
        !form.name?.trim() ||
        !form.facilityType ||
        !form.address?.trim() ||
        !form.district ||
        !form.managerName?.trim() ||
        !form.managerContact?.trim() ||
        !form.organisationType ||
        !form.organisationName?.trim()
      ) {
        return { valid: false, error: 'Please complete all required fields.' };
      }

      const cap = typeof form.capacity === 'number' ? form.capacity : parseInt(form.capacity, 10);
      if (isNaN(cap) || cap <= 0) {
        return { valid: false, error: 'Capacity must be a positive integer.' };
      }

      if (!(SRI_LANKAN_DISTRICTS as readonly string[]).includes(form.district)) {
        return { valid: false, error: 'Invalid district specified.' };
      }

      return { valid: true };
    };

    it('accepts valid shelter submission data', () => {
      const res = validateShelterForm({
        name: 'Ratnapura Central College Safe Haven',
        facilityType: 'school',
        address: '100 Main St',
        district: 'Ratnapura',
        capacity: '250',
        managerName: 'K. Bandara',
        managerContact: '0771234567',
        organisationType: 'government',
        organisationName: 'District Secretariat',
      });
      expect(res.valid).toBe(true);
    });

    it('rejects empty or missing shelter name', () => {
      const res = validateShelterForm({
        name: '   ',
        facilityType: 'school',
        address: '100 Main St',
        district: 'Ratnapura',
        capacity: '250',
        managerName: 'K. Bandara',
        managerContact: '0771234567',
        organisationType: 'government',
        organisationName: 'District Secretariat',
      });
      expect(res.valid).toBe(false);
      expect(res.error).toBe('Please complete all required fields.');
    });

    it('rejects non-positive shelter capacity (0 or negative)', () => {
      expect(
        validateShelterForm({
          name: 'Camp A',
          facilityType: 'community_hall',
          address: 'Main St',
          district: 'Ratnapura',
          capacity: '0',
          managerName: 'Officer',
          managerContact: '0771111111',
          organisationType: 'government',
          organisationName: 'DMC',
        }).error,
      ).toBe('Capacity must be a positive integer.');

      expect(
        validateShelterForm({
          name: 'Camp B',
          facilityType: 'community_hall',
          address: 'Main St',
          district: 'Ratnapura',
          capacity: '-50',
          managerName: 'Officer',
          managerContact: '0771111111',
          organisationType: 'government',
          organisationName: 'DMC',
        }).error,
      ).toBe('Capacity must be a positive integer.');
    });
  });

  describe('Rescue Team Input Constraints Validation', () => {
    const validateRescueTeamForm = (form: {
      name: string;
      organisationName: string;
      memberCount: string | number;
      specialisation: string;
      district: string;
    }): { valid: boolean; error?: string } => {
      if (!form.name?.trim() || !form.organisationName?.trim() || !form.specialisation || !form.district) {
        return { valid: false, error: 'Please complete all mandatory unit credentials.' };
      }

      const count = typeof form.memberCount === 'number' ? form.memberCount : parseInt(String(form.memberCount), 10);
      if (isNaN(count) || count <= 0) {
        return { valid: false, error: 'Crew personnel count must be a positive number.' };
      }

      return { valid: true };
    };

    it('accepts valid rescue team form', () => {
      expect(
        validateRescueTeamForm({
          name: 'Navy RABS Unit 01',
          organisationName: 'Sri Lanka Navy',
          memberCount: '12',
          specialisation: 'Water Rescue',
          district: 'Ratnapura',
        }).valid,
      ).toBe(true);
    });

    it('rejects zero or negative crew personnel count', () => {
      expect(
        validateRescueTeamForm({
          name: 'Unit A',
          organisationName: 'Army',
          memberCount: '0',
          specialisation: 'Landslide SAR',
          district: 'Ratnapura',
        }).error,
      ).toBe('Crew personnel count must be a positive number.');
    });
  });

  describe('Relief Supply Distribution Constraints Validation', () => {
    const validateDistributionForm = (form: {
      quantity: string | number;
      destinationLocation: string;
      destinationDistrict: string;
    }): { valid: boolean; error?: string } => {
      const qty = typeof form.quantity === 'number' ? form.quantity : parseInt(String(form.quantity), 10);
      if (isNaN(qty) || qty <= 0) {
        return { valid: false, error: 'Please specify a valid positive dispatch quantity.' };
      }

      if (!form.destinationLocation?.trim()) {
        return { valid: false, error: 'Target distribution camp or facility is required.' };
      }

      if (!form.destinationDistrict || !(SRI_LANKAN_DISTRICTS as readonly string[]).includes(form.destinationDistrict)) {
        return { valid: false, error: 'Target destination district must be valid.' };
      }

      return { valid: true };
    };

    it('accepts valid distribution parameters', () => {
      expect(
        validateDistributionForm({
          quantity: 200,
          destinationLocation: 'Ratnapura Safe Haven',
          destinationDistrict: 'Ratnapura',
        }).valid,
      ).toBe(true);
    });

    it('rejects non-positive distribution quantities', () => {
      expect(
        validateDistributionForm({
          quantity: 0,
          destinationLocation: 'Ratnapura Safe Haven',
          destinationDistrict: 'Ratnapura',
        }).error,
      ).toBe('Please specify a valid positive dispatch quantity.');
    });

    it('rejects empty destination location', () => {
      expect(
        validateDistributionForm({
          quantity: 100,
          destinationLocation: '   ',
          destinationDistrict: 'Ratnapura',
        }).error,
      ).toBe('Target distribution camp or facility is required.');
    });
  });
});
