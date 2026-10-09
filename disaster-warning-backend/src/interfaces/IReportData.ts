export interface AlertTimelineMetric {
  totalAlertsIssued: number;
  escalationCount: number;
  warningsBySeverity: {
    EXTREME: number;
    SEVERE: number;
    MODERATE: number;
    MINOR: number;
  };
  timeline: Array<{
    timestamp: string;
    level: string;
    message: string;
  }>;
}

export interface CitizenReachMetric {
  totalCitizensReached: number;
  reachBySector: Record<string, number>;
  notificationDeliveryRate: number;
  acknowledgedCount: number;
}

export interface ShelterOccupancyMetric {
  totalSheltersActive: number;
  peakOccupancyPercentage: number;
  totalCapacitiesOccupied: number;
  timeSeriesOccupancy: Array<{
    date: string;
    occupancyCount: number;
  }>;
}

export interface ResourceDistributionMetric {
  totalPackagesDistributed: number;
  distributionByDistrict: Record<string, {
    foodKits: number;
    medicalKits: number;
    waterPurifiers: number;
    blankets: number;
  }>;
}

export interface PostEventReport {
  eventId: string;
  generatedAt: string;
  overallStatus: 'COMPLETE' | 'PARTIAL_SUCCESS' | 'FAILED';
  summary: {
    totalMetricsCount: number;
    successfulMetricsCount: number;
    failedMetricsCount: number;
  };
  metrics: {
    alerts: AlertTimelineMetric | string | null;
    citizenReach: CitizenReachMetric | string | null;
    shelterOccupancy: ShelterOccupancyMetric | string | null;
    resourceDistribution: ResourceDistributionMetric | string | null;
  };
  failedMetrics: string[];
  metricErrors?: Record<string, string>;
}
