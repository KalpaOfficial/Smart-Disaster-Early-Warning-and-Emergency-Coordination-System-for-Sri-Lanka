/**
 * Unit Tests for UC04 Metric 2: Citizens Reached Statistical Dataset.
 *
 * Requirements from guide.md Section 5:
 * - Metric 2: Citizens Reached — Explicit Case Study reporting metric.
 * - Tracks total citizens notified across targeted hazard sectors,
 *   delivery rates, and recipient acknowledgment statistics.
 */
import { generatePostEventReport } from '@/services/postEventReportService';
import { addDoc } from 'firebase/firestore';
import type { HazardEvent } from '@/types/resources';
import type { CitizenReachMetric } from '@/types/postEventReport';

describe('UC04: Citizens Reached Metric Generation & District Delivery Rate', () => {
  const closedEvent: HazardEvent = {
    id: 'evt-kalu-flood-2026',
    title: 'Kalu Ganga Basin Inundation Disaster',
    status: 'closed',
    hazardType: 'flood',
    affectedDistricts: ['Ratnapura', 'Kalutara', 'Kegalle'],
    startDate: '2026-09-01T00:00:00Z',
    description: 'Closed flood event',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (addDoc as jest.Mock).mockResolvedValue({ id: 'report-doc-citizen-01' });
  });

  it('compiles Citizens Reached metric accurately when selected', async () => {
    const report = await generatePostEventReport(
      closedEvent,
      {
        selectedMetrics: ['citizens_reached'],
        district: 'all',
      },
      'officer-dmc-01',
    );

    expect(report.overallStatus).toBe('COMPLETE');
    expect(report.metrics.citizenReach).not.toBeNull();
    expect(report.metrics.citizenReach).not.toBe('Incomplete/Timeout');

    const reachMetric = report.metrics.citizenReach as CitizenReachMetric;
    expect(reachMetric.totalCitizensReached).toBe(128500);
    expect(reachMetric.notificationDeliveryRate).toBe(98.4);
    expect(reachMetric.acknowledgedCount).toBe(94200);

    // Verify district/sector coverage breakdown
    expect(reachMetric.reachBySector).toBeDefined();
    expect(reachMetric.reachBySector.Ratnapura).toBe(58000);
    expect(reachMetric.reachBySector.Kalutara).toBe(46500);
    expect(reachMetric.reachBySector.Kegalle).toBe(24000);

    const totalFromSectors =
      reachMetric.reachBySector.Ratnapura +
      reachMetric.reachBySector.Kalutara +
      reachMetric.reachBySector.Kegalle;
    expect(totalFromSectors).toBe(128500);
  });

  it('omits Citizens Reached when not requested in selectedMetrics', async () => {
    const report = await generatePostEventReport(
      closedEvent,
      {
        selectedMetrics: ['alert_timeline'],
      },
      'officer-dmc-01',
    );

    expect(report.metrics.citizenReach).toBeNull();
    expect(report.metrics.alerts).not.toBeNull();
  });
});
