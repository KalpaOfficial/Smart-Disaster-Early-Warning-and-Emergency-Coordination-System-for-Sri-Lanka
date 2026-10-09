/**
 * Unit Tests for UC04 Report Metrics Selection & Filter Validation.
 *
 * Requirements from guide.md Section 5:
 * - Steps 66–67: Official selects one or more report metrics:
 *   Alert Timeline, Citizens Reached, Shelter Occupancy Over Time, Resource Distribution by District.
 * - Step 68: Official sets reporting date range and optional district filter.
 * - Step 70: System validates selected event, date range, metrics, and district filter.
 */
import { validateReportCriteria } from '@/services/postEventReportService';
import type { HazardEvent } from '@/types/resources';
import type { ReportFilterCriteria } from '@/types/postEventReport';

describe('UC04: Report Metrics & Filter Criteria Validation', () => {
  const closedEvent: HazardEvent = {
    id: 'evt-flood-closed',
    title: 'Severe Monsoon Inundation 2026',
    status: 'closed',
    hazardType: 'flood',
    affectedDistricts: ['Ratnapura', 'Kalutara'],
    startDate: '2026-09-01T00:00:00Z',
    description: 'Closed hazard event.',
  };

  describe('Metric Selection Constraints (Step 67 & Step 70)', () => {
    it('accepts single metric selection (e.g., Alert Timeline only)', () => {
      const criteria: ReportFilterCriteria = {
        selectedMetrics: ['alert_timeline'],
      };

      const result = validateReportCriteria(closedEvent, criteria);
      expect(result.valid).toBe(true);
    });

    it('accepts all 4 mandatory metrics selected together', () => {
      const criteria: ReportFilterCriteria = {
        selectedMetrics: [
          'alert_timeline',
          'citizens_reached',
          'shelter_occupancy',
          'resource_distribution',
        ],
      };

      const result = validateReportCriteria(closedEvent, criteria);
      expect(result.valid).toBe(true);
    });

    it('rejects empty metrics array', () => {
      const criteria: ReportFilterCriteria = {
        selectedMetrics: [],
      };

      const result = validateReportCriteria(closedEvent, criteria);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('At least one report metric must be selected.');
    });
  });

  describe('Date Range Constraints (Step 68 & Step 70)', () => {
    it('accepts valid date range where startDate <= endDate', () => {
      const criteria: ReportFilterCriteria = {
        selectedMetrics: ['alert_timeline'],
        startDate: '2026-09-01T00:00:00Z',
        endDate: '2026-09-10T23:59:59Z',
      };

      const result = validateReportCriteria(closedEvent, criteria);
      expect(result.valid).toBe(true);
    });

    it('accepts same-day startDate and endDate', () => {
      const criteria: ReportFilterCriteria = {
        selectedMetrics: ['alert_timeline'],
        startDate: '2026-09-05T00:00:00Z',
        endDate: '2026-09-05T23:59:59Z',
      };

      const result = validateReportCriteria(closedEvent, criteria);
      expect(result.valid).toBe(true);
    });

    it('rejects inverted date range where startDate > endDate', () => {
      const criteria: ReportFilterCriteria = {
        selectedMetrics: ['alert_timeline'],
        startDate: '2026-09-20T00:00:00Z',
        endDate: '2026-09-10T00:00:00Z', // Prior to start date
      };

      const result = validateReportCriteria(closedEvent, criteria);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Start date must be before or equal to End date');
    });

    it('rejects malformed date strings', () => {
      const criteria: ReportFilterCriteria = {
        selectedMetrics: ['alert_timeline'],
        startDate: 'invalid-not-a-date',
        endDate: '2026-09-10T00:00:00Z',
      };

      const result = validateReportCriteria(closedEvent, criteria);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid date range');
    });
  });

  describe('District Filter Constraints (Step 68 & Step 70)', () => {
    it('accepts "all" as district filter for district-wide aggregate reporting', () => {
      const criteria: ReportFilterCriteria = {
        selectedMetrics: ['resource_distribution'],
        district: 'all',
      };

      const result = validateReportCriteria(closedEvent, criteria);
      expect(result.valid).toBe(true);
    });

    it('accepts valid Sri Lankan administrative district filter', () => {
      const criteria: ReportFilterCriteria = {
        selectedMetrics: ['resource_distribution'],
        district: 'Ratnapura',
      };

      const result = validateReportCriteria(closedEvent, criteria);
      expect(result.valid).toBe(true);
    });

    it('rejects invalid or foreign district name in filter', () => {
      const criteria: ReportFilterCriteria = {
        selectedMetrics: ['resource_distribution'],
        district: 'Foreign_Region',
      };

      const result = validateReportCriteria(closedEvent, criteria);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid district filter: "Foreign_Region"');
    });
  });
});
