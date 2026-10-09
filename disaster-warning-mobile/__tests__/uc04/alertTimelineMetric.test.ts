/**
 * Unit Tests for UC04 Metric 1: Alert Timeline Statistical Dataset.
 *
 * Requirements from guide.md Section 5:
 * - Metric 1: Alert Timeline — Explicit Case Study reporting metric.
 * - Tracks total hazard warnings issued, warning severity levels, warning escalation count,
 *   and chronological event timeline entries for post-event audit.
 */
import { generatePostEventReport } from '@/services/postEventReportService';
import { addDoc } from 'firebase/firestore';
import type { HazardEvent } from '@/types/resources';
import type { AlertTimelineMetric } from '@/types/postEventReport';

describe('UC04: Alert Timeline Metric Generation & Escalation Analysis', () => {
  const closedEvent: HazardEvent = {
    id: 'evt-kalu-flood-2026',
    title: 'Kalu Ganga Basin Inundation Disaster',
    status: 'closed',
    hazardType: 'flood',
    affectedDistricts: ['Ratnapura', 'Kalutara'],
    startDate: '2026-09-01T00:00:00Z',
    description: 'Closed flood event',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (addDoc as jest.Mock).mockResolvedValue({ id: 'report-doc-alert-01' });
  });

  it('compiles Alert Timeline metrics accurately when selected', async () => {
    const report = await generatePostEventReport(
      closedEvent,
      {
        selectedMetrics: ['alert_timeline'],
        startDate: '2026-09-01T00:00:00Z',
        endDate: '2026-09-10T23:59:59Z',
      },
      'officer-dmc-01',
    );

    expect(report.overallStatus).toBe('COMPLETE');
    expect(report.metrics.alerts).not.toBeNull();
    expect(report.metrics.alerts).not.toBe('Incomplete/Timeout');

    const alertMetric = report.metrics.alerts as AlertTimelineMetric;
    expect(alertMetric.totalAlertsIssued).toBe(14);
    expect(alertMetric.escalationCount).toBe(3);

    // Verify severity level distribution
    expect(alertMetric.warningsBySeverity.EXTREME).toBe(4);
    expect(alertMetric.warningsBySeverity.SEVERE).toBe(6);
    expect(alertMetric.warningsBySeverity.MODERATE).toBe(3);
    expect(alertMetric.warningsBySeverity.MINOR).toBe(1);

    // Verify chronological timeline sequence
    expect(Array.isArray(alertMetric.timeline)).toBe(true);
    expect(alertMetric.timeline.length).toBeGreaterThan(0);
    expect(alertMetric.timeline[0].level).toBe('MODERATE');
    expect(alertMetric.timeline[alertMetric.timeline.length - 1].level).toBe('EXTREME');
  });

  it('omits Alert Timeline when not included in selectedMetrics criteria', async () => {
    const report = await generatePostEventReport(
      closedEvent,
      {
        selectedMetrics: ['citizens_reached'], // Alert timeline omitted
      },
      'officer-dmc-01',
    );

    expect(report.metrics.alerts).toBeNull();
    expect(report.metrics.citizenReach).not.toBeNull();
  });
});
