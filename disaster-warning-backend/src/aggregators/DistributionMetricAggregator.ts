import { IMetricAggregator } from '../interfaces/IMetricAggregator';
import { ResourceDistributionMetric } from '../interfaces/IReportData';

/**
 * Aggregator service responsible for compiling Resource Distribution by District (logistics) metrics.
 * Implements IMetricAggregator (Single Responsibility Principle & Liskov Substitution Principle).
 */
export class DistributionMetricAggregator implements IMetricAggregator {
  public readonly key = 'resourceDistribution';

  private readonly delayMs: number;

  constructor(delayMs: number = 20) {
    this.delayMs = delayMs;
  }

  /**
   * Queries Firestore (simulated) for disaster relief resource distributions across districts.
   */
  public async aggregate(eventId: string, filters?: any): Promise<ResourceDistributionMetric> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (eventId.includes('FAIL_DISTRIBUTION') || filters?.failKey === this.key) {
          return reject(new Error(`DistributionMetricAggregator: Firestore timeout while querying 'resource_distribution' collection for event ${eventId}`));
        }

        const mockDistributionData: ResourceDistributionMetric = {
          totalPackagesDistributed: 45200,
          distributionByDistrict: {
            Colombo: { foodKits: 12000, medicalKits: 3500, waterPurifiers: 2000, blankets: 5000 },
            Gampaha: { foodKits: 8500, medicalKits: 2200, waterPurifiers: 1500, blankets: 3000 },
            Kalutara: { foodKits: 5000, medicalKits: 1100, waterPurifiers: 800, blankets: 2000 },
            Ratnapura: { foodKits: 4500, medicalKits: 1000, waterPurifiers: 600, blankets: 1500 },
          },
        };

        resolve(mockDistributionData);
      }, this.delayMs);
    });
  }
}
