import { IMetricAggregator } from '../interfaces/IMetricAggregator';
import { ShelterOccupancyMetric } from '../interfaces/IReportData';

/**
 * Aggregator service responsible for compiling Shelter Occupancy Over Time metrics.
 * Implements IMetricAggregator (Single Responsibility Principle & Liskov Substitution Principle).
 */
export class OccupancyMetricAggregator implements IMetricAggregator {
  public readonly key = 'shelterOccupancy';

  private readonly delayMs: number;

  constructor(delayMs: number = 20) {
    this.delayMs = delayMs;
  }

  /**
   * Queries Firestore (simulated) for active emergency shelters and occupancy trends over time.
   */
  public async aggregate(eventId: string, filters?: any): Promise<ShelterOccupancyMetric> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (eventId.includes('FAIL_OCCUPANCY') || filters?.failKey === this.key) {
          return reject(new Error(`OccupancyMetricAggregator: Firestore timeout while querying 'shelter_occupancy' collection for event ${eventId}`));
        }

        const mockOccupancyData: ShelterOccupancyMetric = {
          totalSheltersActive: 18,
          peakOccupancyPercentage: 84.5,
          totalCapacitiesOccupied: 12400,
          timeSeriesOccupancy: [
            { date: '2026-10-01', occupancyCount: 3200 },
            { date: '2026-10-02', occupancyCount: 8900 },
            { date: '2026-10-03', occupancyCount: 12400 },
            { date: '2026-10-04', occupancyCount: 9100 },
            { date: '2026-10-05', occupancyCount: 4500 },
          ],
        };

        resolve(mockOccupancyData);
      }, this.delayMs);
    });
  }
}
