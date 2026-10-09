/**
 * Post-Event Response Report types for UC04:
 * Generate Post-Event Response Report.
 *
 * Implements the 4 required statistical metrics from Case Study 02 & guide.md:
 * 1. Alert Timeline
 * 2. Citizens Reached
 * 3. Shelter Occupancy Over Time
 * 4. Resource Distribution by District
 */

export type ReportMetricType =
  | 'alert_timeline'
  | 'citizens_reached'
  | 'shelter_occupancy'
  | 'resource_distribution';

export type ExportFormat = 'pdf' | 'csv';

export type ReportStatus = 'COMPLETE' | 'PARTIAL_SUCCESS' | 'FAILED';

export interface AlertTimelineEntry {
  timestamp: string;
  level: string;
  message: string;
  warningId?: string;
  severity?: string;
}

export interface AlertTimelineMetric {
  totalAlertsIssued: number;
  escalationCount: number;
  warningsBySeverity: {
    EXTREME: number;
    SEVERE: number;
    MODERATE: number;
    MINOR: number;
  };
  timeline: AlertTimelineEntry[];
}

export interface CitizenReachMetric {
  totalCitizensReached: number;
  reachBySector: Record<string, number>;
  notificationDeliveryRate: number;
  acknowledgedCount: number;
}

export interface OccupancyTimePoint {
  date: string;
  occupancyCount: number;
}

export interface ShelterOccupancyMetric {
  totalSheltersActive: number;
  peakOccupancyPercentage: number;
  totalCapacitiesOccupied: number;
  timeSeriesOccupancy: OccupancyTimePoint[];
}

export interface DistrictDistributionSummary {
  foodKits: number;
  medicalKits: number;
  waterPurifiers: number;
  blankets: number;
}

export interface ResourceDistributionMetric {
  totalPackagesDistributed: number;
  distributionByDistrict: Record<string, DistrictDistributionSummary>;
}

export interface ReportFilterCriteria {
  startDate?: string;
  endDate?: string;
  district?: string;
  selectedMetrics: ReportMetricType[];
}

export interface PostEventReport {
  id: string;
  eventId: string;
  eventTitle: string;
  generatedBy: string;
  generatedAt: string;
  filterCriteria: ReportFilterCriteria;
  overallStatus: ReportStatus;
  summary: {
    totalMetricsCount: number;
    successfulMetricsCount: number;
    failedMetricsCount: number;
  };
  metrics: {
    alerts: AlertTimelineMetric | 'Incomplete/Timeout' | null;
    citizenReach: CitizenReachMetric | 'Incomplete/Timeout' | null;
    shelterOccupancy: ShelterOccupancyMetric | 'Incomplete/Timeout' | null;
    resourceDistribution: ResourceDistributionMetric | 'Incomplete/Timeout' | null;
  };
  failedMetrics: string[];
  metricErrors?: Record<string, string>;
  exportUrl?: string;
  exportFormat?: ExportFormat;
}

export interface CreateReportRequest {
  eventId: string;
  filterCriteria: ReportFilterCriteria;
}

export interface DonorDistributionRecord {
  id: string;
  reportId: string;
  eventId: string;
  donorId: string;
  donorName: string;
  format: ExportFormat;
  fileUrl: string;
  distributedBy: string;
  distributedAt: string;
  status: 'SENT' | 'FAILED';
}
