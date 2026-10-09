import { IMetricAggregator } from '../interfaces/IMetricAggregator';
import { CitizenReachMetric } from '../interfaces/IReportData';

/**
 * Aggregator service responsible for compiling Citizen Reach metrics.
 * Implements IMetricAggregator (Single Responsibility Principle & Liskov Substitution Principle).
 */
export class CitizenReachAggregator implements IMetricAggregator {
  public readonly key = 'citizenReach';

  private readonly delayMs: number;

  constructor(delayMs: number = 20) {
    this.delayMs = delayMs;
  }

  /**
   * Queries Firestore (simulated) for citizen notification reach across sectors.
   */
  public async aggregate(eventId: string, filters?: any): Promise<CitizenReachMetric> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (eventId.includes('FAIL_CITIZEN') || filters?.failKey === this.key) {
          return reject(new Error(`CitizenReachAggregator: Firestore timeout while querying 'citizen_reach' collection for event ${eventId}`));
        }

        const mockCitizenData: CitizenReachMetric = {
          totalCitizensReached: 128500,
          reachBySector: {
            Colombo: 45000,
            Gampaha: 38000,
            Kalutara: 25500,
            Ratnapura: 20000,
          },
          notificationDeliveryRate: 97.4,
          acknowledgedCount: 94200,
        };

        resolve(mockCitizenData);
      }, this.delayMs);
    });
  }
}
