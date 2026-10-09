import { IMetricAggregator } from '../interfaces/IMetricAggregator';
import { PostEventReport } from '../interfaces/IReportData';
import { AlertMetricAggregator } from '../aggregators/AlertMetricAggregator';
import { CitizenReachAggregator } from '../aggregators/CitizenReachAggregator';
import { OccupancyMetricAggregator } from '../aggregators/OccupancyMetricAggregator';
import { DistributionMetricAggregator } from '../aggregators/DistributionMetricAggregator';

/**
 * Orchestrator service for post-event report generation.
 * Follows the Dependency Inversion Principle (DIP) by accepting aggregators through constructor injection.
 * Uses Promise.allSettled() to concurrently query Firestore collections with fault tolerance.
 */
export class ReportService {
  private readonly aggregators: IMetricAggregator[];

  constructor(aggregators?: IMetricAggregator[]) {
    this.aggregators = aggregators || [
      new AlertMetricAggregator(),
      new CitizenReachAggregator(),
      new OccupancyMetricAggregator(),
      new DistributionMetricAggregator(),
    ];
  }

  /**
   * Concurrently aggregates metrics across all registered aggregators using Promise.allSettled().
   * Handles individual aggregator timeouts/failures gracefully.
   * 
   * @param eventId - The closed hazard event identifier.
   * @param filters - Optional query parameters.
   * @returns PostEventReport containing aggregated metrics and status.
   */
  public async generatePostEventReport(eventId: string, filters?: any): Promise<PostEventReport> {
    const startTime = Date.now();

    // Concurrently trigger all aggregator queries
    const settlementResults = await Promise.allSettled(
      this.aggregators.map(async (aggregator) => {
        try {
          const result = await aggregator.aggregate(eventId, filters);
          return { key: aggregator.key, data: result };
        } catch (error) {
          throw { key: aggregator.key, error: (error as Error)?.message || 'Aggregator query failed' };
        }
      })
    );

    const metricsResult: Record<string, any> = {
      alerts: null,
      citizenReach: null,
      shelterOccupancy: null,
      resourceDistribution: null,
    };

    const failedMetrics: string[] = [];
    const metricErrors: Record<string, string> = {};
    let successCount = 0;

    settlementResults.forEach((result, index) => {
      const aggregatorKey = this.aggregators[index].key || 
        (['alerts', 'citizenReach', 'shelterOccupancy', 'resourceDistribution'][index]);

      if (result.status === 'fulfilled') {
        metricsResult[aggregatorKey] = result.value.data;
        successCount++;
      } else {
        // Handle failed or timed out aggregator
        const errorReason = result.reason?.error || result.reason?.message || 'Aggregator timeout or failure';
        metricsResult[aggregatorKey] = 'Incomplete/Timeout';
        failedMetrics.push(aggregatorKey);
        metricErrors[aggregatorKey] = errorReason;
      }
    });

    let overallStatus: 'COMPLETE' | 'PARTIAL_SUCCESS' | 'FAILED' = 'COMPLETE';
    if (failedMetrics.length === this.aggregators.length) {
      overallStatus = 'FAILED';
    } else if (failedMetrics.length > 0) {
      overallStatus = 'PARTIAL_SUCCESS';
    }

    const report: PostEventReport = {
      eventId,
      generatedAt: new Date().toISOString(),
      overallStatus,
      summary: {
        totalMetricsCount: this.aggregators.length,
        successfulMetricsCount: successCount,
        failedMetricsCount: failedMetrics.length,
      },
      metrics: {
        alerts: metricsResult.alerts,
        citizenReach: metricsResult.citizenReach,
        shelterOccupancy: metricsResult.shelterOccupancy,
        resourceDistribution: metricsResult.resourceDistribution,
      },
      failedMetrics,
      ...(failedMetrics.length > 0 ? { metricErrors } : {}),
    };

    return report;
  }
}
