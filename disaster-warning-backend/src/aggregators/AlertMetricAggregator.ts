import { IMetricAggregator } from '../interfaces/IMetricAggregator';
import { AlertTimelineMetric } from '../interfaces/IReportData';

/**
 * Aggregator service responsible for compiling Alert Timeline metrics.
 * Implements IMetricAggregator (Single Responsibility Principle & Liskov Substitution Principle).
 */
export class AlertMetricAggregator implements IMetricAggregator {
  public readonly key = 'alerts';

  private readonly delayMs: number;

  constructor(delayMs: number = 20) {
    this.delayMs = delayMs;
  }

  /**
   * Queries Firestore (simulated) for alert timeline, warning levels, and escalations.
   */
  public async aggregate(eventId: string, filters?: any): Promise<AlertTimelineMetric> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (eventId.includes('FAIL_ALERT') || filters?.failKey === this.key) {
          return reject(new Error(`AlertMetricAggregator: Firestore timeout while querying 'alerts' collection for event ${eventId}`));
        }

        const mockAlertData: AlertTimelineMetric = {
          totalAlertsIssued: 14,
          escalationCount: 3,
          warningsBySeverity: {
            EXTREME: 4,
            SEVERE: 6,
            MODERATE: 3,
            MINOR: 1,
          },
          timeline: [
            {
              timestamp: '2026-10-01T08:00:00Z',
              level: 'MODERATE',
              message: 'Heavy rainfall warning issued for Western Province',
            },
            {
              timestamp: '2026-10-01T12:30:00Z',
              level: 'SEVERE',
              message: 'Kelani river water level reaching threshold. Level 2 alert.',
            },
            {
              timestamp: '2026-10-01T16:00:00Z',
              level: 'EXTREME',
              message: 'Immediate evacuation alert for low-lying areas in Kolonnawa.',
            },
          ],
        };

        resolve(mockAlertData);
      }, this.delayMs);
    });
  }
}
