import {
  OBSERVATION_TYPES,
  REPORT_STATUSES,
  getObservationTypeDefinition,
  getObservationTypeLabel,
  getReportStatusDefinition,
  getReportStatusLabel,
} from '@/constants/observationTypes';
import type { ObservationType, ReportStatus } from '@/types/groundReport';

describe('UC02: Observation Types & Report Status Constants & Helper Functions', () => {
  describe('Observation Types Registry', () => {
    it('contains all 4 required observation types from Case Study 02 / UC02 Step 3', () => {
      const values = OBSERVATION_TYPES.map((o) => o.value);
      expect(values).toContain('rising_water');
      expect(values).toContain('blocked_road');
      expect(values).toContain('landslide_crack');
      expect(values).toContain('other');
    });

    it('returns the correct definition for known observation types', () => {
      const risingWater = getObservationTypeDefinition('rising_water');
      expect(risingWater.value).toBe('rising_water');
      expect(risingWater.label).toBe('Rising Water Level');
      expect(risingWater.shortLabel).toBe('Rising Water');
      expect(risingWater.icon).toBe('water-outline');

      const blockedRoad = getObservationTypeDefinition('blocked_road');
      expect(blockedRoad.value).toBe('blocked_road');
      expect(blockedRoad.shortLabel).toBe('Blocked Road');

      const landslideCrack = getObservationTypeDefinition('landslide_crack');
      expect(landslideCrack.value).toBe('landslide_crack');
      expect(landslideCrack.shortLabel).toBe('Landslide Crack');
    });

    it('returns "other" fallback definition for an unrecognized observation type', () => {
      const fallback = getObservationTypeDefinition('unknown_type' as unknown as ObservationType);
      expect(fallback.value).toBe('other');
      expect(fallback.label).toBe('Other Hazard Observation');
    });

    it('returns the correct human-readable display label', () => {
      expect(getObservationTypeLabel('rising_water')).toBe('Rising Water Level');
      expect(getObservationTypeLabel('blocked_road')).toBe('Blocked Road / Access Cut');
      expect(getObservationTypeLabel('landslide_crack')).toBe('Landslide Crack / Slope Failure');
      expect(getObservationTypeLabel('other')).toBe('Other Hazard Observation');
    });
  });

  describe('Report Statuses Registry', () => {
    it('contains all 4 lifecycle states for UC02 ground reports', () => {
      const values = REPORT_STATUSES.map((s) => s.value);
      expect(values).toContain('pending_verification');
      expect(values).toContain('verified');
      expect(values).toContain('info_requested');
      expect(values).toContain('rejected');
    });

    it('returns the correct definition for known report statuses', () => {
      const pending = getReportStatusDefinition('pending_verification');
      expect(pending.value).toBe('pending_verification');
      expect(pending.label).toBe('Pending Verification');

      const verified = getReportStatusDefinition('verified');
      expect(verified.value).toBe('verified');
      expect(verified.label).toBe('Verified');

      const rejected = getReportStatusDefinition('rejected');
      expect(rejected.value).toBe('rejected');
      expect(rejected.label).toBe('Rejected');

      const infoReq = getReportStatusDefinition('info_requested');
      expect(infoReq.value).toBe('info_requested');
      expect(infoReq.label).toBe('Information Requested');
    });

    it('returns "pending_verification" fallback definition for an unrecognized status', () => {
      const fallback = getReportStatusDefinition('unknown_status' as unknown as ReportStatus);
      expect(fallback.value).toBe('pending_verification');
      expect(fallback.label).toBe('Pending Verification');
    });

    it('returns the correct display label for statuses', () => {
      expect(getReportStatusLabel('pending_verification')).toBe('Pending Verification');
      expect(getReportStatusLabel('verified')).toBe('Verified');
      expect(getReportStatusLabel('info_requested')).toBe('Information Requested');
      expect(getReportStatusLabel('rejected')).toBe('Rejected');
    });
  });
});
