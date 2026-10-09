/**
 * Unit Tests for UC04 Metric 3: Shelter Occupancy Over Time Statistical Dataset.
 *
 * Requirements from guide.md Section 5:
 * - Metric 3: Shelter Occupancy Over Time — Explicit Case Study reporting metric.
 * - Tracks peak occupancy percentage, total active shelters utilized,
 *   and chronological time-series headcount trends.
 */
import { generatePostEventReport } from '@/services/postEventReportService';
import { addDoc } from 'firebase/firestore';
import type { HazardEvent } from '@/types/resources';
import type { ShelterOccupancyMetric } from '@/types/postEventReport';

describe('UC04: Shelter Occupancy Over Time Metric Generation', () => {
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
    (addDoc as jest.Mock).mockResolvedValue({ id: 'report-doc-shelter-01' });
  });

  it('compiles Shelter Occupancy Over Time metric with time-series progression', async () => {
    const report = await generatePostEventReport(
      closedEvent,
      {
        selectedMetrics: ['shelter_occupancy'],
      },
      'officer-dmc-01',
    );

    expect(report.overallStatus).toBe('COMPLETE');
    expect(report.metrics.shelterOccupancy).not.toBeNull();
    expect(report.metrics.shelterOccupancy).not.toBe('Incomplete/Timeout');

    const occupancyMetric = report.metrics.shelterOccupancy as ShelterOccupancyMetric;
    expect(occupancyMetric.totalSheltersActive).toBe(18);
    expect(occupancyMetric.peakOccupancyPercentage).toBe(88.5);
    expect(occupancyMetric.totalCapacitiesOccupied).toBe(4250);

    // Verify chronological time-series points
    expect(Array.isArray(occupancyMetric.timeSeriesOccupancy)).toBe(true);
    expect(occupancyMetric.timeSeriesOccupancy).toHaveLength(5);

    // Day 1 to Day 3 surge
    expect(occupancyMetric.timeSeriesOccupancy[0].date).toBe('2026-10-01');
    expect(occupancyMetric.timeSeriesOccupancy[0].occupancyCount).toBe(1200);

    // Day 3 peak: 4250 evacuees
    expect(occupancyMetric.timeSeriesOccupancy[2].date).toBe('2026-10-03');
    expect(occupancyMetric.timeSeriesOccupancy[2].occupancyCount).toBe(4250);

    // Day 5 phasing out: 650 evacuees
    expect(occupancyMetric.timeSeriesOccupancy[4].date).toBe('2026-10-05');
    expect(occupancyMetric.timeSeriesOccupancy[4].occupancyCount).toBe(650);
  });

  it('omits Shelter Occupancy metric when not selected', async () => {
    const report = await generatePostEventReport(
      closedEvent,
      {
        selectedMetrics: ['alert_timeline'],
      },
      'officer-dmc-01',
    );

    expect(report.metrics.shelterOccupancy).toBeNull();
  });
});
