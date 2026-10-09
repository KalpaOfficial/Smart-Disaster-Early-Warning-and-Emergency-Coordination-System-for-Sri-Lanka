/**
 * Unit Tests for UC04 Exception Flow: Aggregation Timeout & Partial Fault Tolerance.
 *
 * Requirements from guide.md Section 5:
 * - Exception Flow: Aggregation Timeout:
 *   Processing for one of the selected metrics exceeds the allowed processing time.
 *   The system identifies the affected metric, marks it as Incomplete/Timeout,
 *   and sets overallStatus to PARTIAL_SUCCESS while preserving successful metrics.
 * - Total Failure:
 *   If all selected metrics fail, overallStatus becomes FAILED.
 */
import { generatePostEventReport } from '@/services/postEventReportService';
import { addDoc } from 'firebase/firestore';
import type { HazardEvent } from '@/types/resources';

describe('UC04: Aggregation Timeout & Partial Fault Tolerance', () => {
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
    (addDoc as jest.Mock).mockResolvedValue({ id: 'report-timeout-01' });
  });

  it('marks timed-out metric as "Incomplete/Timeout" and assigns status "PARTIAL_SUCCESS" when one aggregator fails', async () => {
    // Request all 4 metrics, with shelter_occupancy timing out
    const report = await generatePostEventReport(
      closedEvent,
      {
        selectedMetrics: [
          'alert_timeline',
          'citizens_reached',
          'shelter_occupancy',
          'resource_distribution',
        ],
      },
      'officer-dmc-01',
      {
        mockTimeoutMetrics: ['shelter_occupancy'],
      },
    );

    expect(report.overallStatus).toBe('PARTIAL_SUCCESS');
    expect(report.failedMetrics).toContain('shelter_occupancy');
    expect(report.metrics.shelterOccupancy).toBe('Incomplete/Timeout');
    expect(report.metricErrors?.shelter_occupancy).toBeDefined();

    // Verify the remaining 3 metrics resolved successfully (Fault Isolation)
    expect(report.metrics.alerts).not.toBe('Incomplete/Timeout');
    expect(report.metrics.citizenReach).not.toBe('Incomplete/Timeout');
    expect(report.metrics.resourceDistribution).not.toBe('Incomplete/Timeout');

    expect(report.summary.totalMetricsCount).toBe(4);
    expect(report.summary.successfulMetricsCount).toBe(3);
    expect(report.summary.failedMetricsCount).toBe(1);
  });

  it('assigns status "FAILED" when all selected metrics fail or time out', async () => {
    const report = await generatePostEventReport(
      closedEvent,
      {
        selectedMetrics: ['alert_timeline', 'citizens_reached'],
      },
      'officer-dmc-01',
      {
        mockTimeoutMetrics: ['alert_timeline', 'citizens_reached'],
      },
    );

    expect(report.overallStatus).toBe('FAILED');
    expect(report.failedMetrics).toHaveLength(2);
    expect(report.summary.successfulMetricsCount).toBe(0);
    expect(report.summary.failedMetricsCount).toBe(2);
    expect(report.metrics.alerts).toBe('Incomplete/Timeout');
    expect(report.metrics.citizenReach).toBe('Incomplete/Timeout');
  });
});
