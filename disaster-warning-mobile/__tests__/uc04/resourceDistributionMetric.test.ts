/**
 * Unit Tests for UC04 Metric 4: Resource Distribution by District Dataset.
 *
 * Requirements from guide.md Section 5:
 * - Metric 4: Resource Distribution by District — Explicit Case Study reporting metric.
 * - Consumes the operational distribution records produced by broadened UC03 (guide.md Table 5.1).
 * - Tracks total packages distributed and district-by-district breakdown across essential commodities
 *   (food kits, medical kits, water purifiers, blankets).
 */
import { generatePostEventReport } from '@/services/postEventReportService';
import { addDoc } from 'firebase/firestore';
import type { HazardEvent } from '@/types/resources';
import type { ResourceDistributionMetric } from '@/types/postEventReport';

describe('UC04: Resource Distribution by District Metric Generation', () => {
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
    (addDoc as jest.Mock).mockResolvedValue({ id: 'report-doc-resource-01' });
  });

  it('compiles Resource Distribution by District metric consuming UC03 distribution logs', async () => {
    const report = await generatePostEventReport(
      closedEvent,
      {
        selectedMetrics: ['resource_distribution'],
        district: 'all',
      },
      'officer-dmc-01',
    );

    expect(report.overallStatus).toBe('COMPLETE');
    expect(report.metrics.resourceDistribution).not.toBeNull();
    expect(report.metrics.resourceDistribution).not.toBe('Incomplete/Timeout');

    const distMetric = report.metrics.resourceDistribution as ResourceDistributionMetric;
    expect(distMetric.totalPackagesDistributed).toBe(45200);

    // Verify district-level distribution breakdown
    expect(distMetric.distributionByDistrict).toBeDefined();
    expect(distMetric.distributionByDistrict.Ratnapura).toBeDefined();
    expect(distMetric.distributionByDistrict.Kalutara).toBeDefined();

    // Verify Ratnapura commodities
    const ratnapura = distMetric.distributionByDistrict.Ratnapura;
    expect(ratnapura.foodKits).toBe(14000);
    expect(ratnapura.medicalKits).toBe(2200);
    expect(ratnapura.waterPurifiers).toBe(6500);
    expect(ratnapura.blankets).toBe(3500);

    // Verify Kalutara commodities
    const kalutara = distMetric.distributionByDistrict.Kalutara;
    expect(kalutara.foodKits).toBe(10500);
    expect(kalutara.medicalKits).toBe(1800);
    expect(kalutara.waterPurifiers).toBe(4800);
    expect(kalutara.blankets).toBe(1900);

    const grandTotalCommodities =
      ratnapura.foodKits + ratnapura.medicalKits + ratnapura.waterPurifiers + ratnapura.blankets +
      kalutara.foodKits + kalutara.medicalKits + kalutara.waterPurifiers + kalutara.blankets;
    expect(grandTotalCommodities).toBe(45200);
  });

  it('omits Resource Distribution metric when not requested in selectedMetrics', async () => {
    const report = await generatePostEventReport(
      closedEvent,
      {
        selectedMetrics: ['alert_timeline'],
      },
      'officer-dmc-01',
    );

    expect(report.metrics.resourceDistribution).toBeNull();
  });
});
