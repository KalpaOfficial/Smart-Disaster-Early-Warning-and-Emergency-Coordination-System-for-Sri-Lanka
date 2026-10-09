/**
 * Interface defining a metric aggregator for post-event disaster analysis.
 * Follows the Single Responsibility Principle (SRP) by ensuring each implementation
 * only handles aggregation logic for a single domain metric collection.
 */
export interface MetricResult<T = any> {
  metricName: string;
  success: boolean;
  data: T | null;
  error?: string;
  executionTimeMs?: number;
}

export interface IMetricAggregator {
  /**
   * Unique name/key of the metric (e.g., 'alerts', 'citizenReach', 'shelterOccupancy', 'resourceDistribution').
   */
  readonly key: string;

  /**
   * Aggregates metric data for a specific hazard event.
   * @param eventId - The unique ID of the closed disaster event.
   * @param filters - Optional query/filtering parameters.
   * @returns Promise resolving to metric result data or structured result object.
   */
  aggregate(eventId: string, filters?: any): Promise<any>;
}
