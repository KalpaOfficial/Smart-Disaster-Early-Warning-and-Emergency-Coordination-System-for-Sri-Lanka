import { ReportService } from '../src/services/ReportService';
import { ExportDistributionService } from '../src/services/ExportDistributionService';
import { AlertMetricAggregator } from '../src/aggregators/AlertMetricAggregator';
import { CitizenReachAggregator } from '../src/aggregators/CitizenReachAggregator';
import { OccupancyMetricAggregator } from '../src/aggregators/OccupancyMetricAggregator';
import { DistributionMetricAggregator } from '../src/aggregators/DistributionMetricAggregator';
import { IMetricAggregator } from '../src/interfaces/IMetricAggregator';

describe('Services Unit Tests', () => {
  describe('ReportService', () => {
    it('should aggregate all 4 metrics successfully when all aggregators succeed', async () => {
      const reportService = new ReportService([
        new AlertMetricAggregator(5),
        new CitizenReachAggregator(5),
        new OccupancyMetricAggregator(5),
        new DistributionMetricAggregator(5),
      ]);

      const report = await reportService.generatePostEventReport('EVT_FLOOD_2026');

      expect(report.eventId).toBe('EVT_FLOOD_2026');
      expect(report.overallStatus).toBe('COMPLETE');
      expect(report.failedMetrics).toHaveLength(0);
      expect(report.summary.successfulMetricsCount).toBe(4);
      expect(report.metrics.alerts).not.toBeNull();
      expect(report.metrics.citizenReach).not.toBeNull();
      expect(report.metrics.shelterOccupancy).not.toBeNull();
      expect(report.metrics.resourceDistribution).not.toBeNull();
    });

    it('should mark failed metric as Incomplete/Timeout and set status PARTIAL_SUCCESS if one aggregator fails', async () => {
      const mockFailingAggregator: IMetricAggregator = {
        key: 'shelterOccupancy',
        aggregate: jest.fn().mockRejectedValue(new Error('Occupancy DB Timeout')),
      };

      const reportService = new ReportService([
        new AlertMetricAggregator(5),
        new CitizenReachAggregator(5),
        mockFailingAggregator,
        new DistributionMetricAggregator(5),
      ]);

      const report = await reportService.generatePostEventReport('EVT_FLOOD_PARTIAL');

      expect(report.overallStatus).toBe('PARTIAL_SUCCESS');
      expect(report.failedMetrics).toContain('shelterOccupancy');
      expect(report.metrics.shelterOccupancy).toBe('Incomplete/Timeout');
      expect(report.metrics.alerts).not.toBeNull();
      expect(report.metrics.citizenReach).not.toBeNull();
      expect(report.metrics.resourceDistribution).not.toBeNull();
      expect(report.metricErrors?.shelterOccupancy).toBe('Occupancy DB Timeout');
    });

    it('should mark status as FAILED if all aggregators fail', async () => {
      const createFailingAggregator = (key: string): IMetricAggregator => ({
        key,
        aggregate: jest.fn().mockRejectedValue(new Error(`${key} collection offline`)),
      });

      const reportService = new ReportService([
        createFailingAggregator('alerts'),
        createFailingAggregator('citizenReach'),
        createFailingAggregator('shelterOccupancy'),
        createFailingAggregator('resourceDistribution'),
      ]);

      const report = await reportService.generatePostEventReport('EVT_TOTAL_FAIL');

      expect(report.overallStatus).toBe('FAILED');
      expect(report.failedMetrics).toHaveLength(4);
      expect(report.summary.successfulMetricsCount).toBe(0);
    });
  });

  describe('ExportDistributionService', () => {
    it('should export report and return distribution result', async () => {
      const reportService = new ReportService([
        new AlertMetricAggregator(5),
        new CitizenReachAggregator(5),
        new OccupancyMetricAggregator(5),
        new DistributionMetricAggregator(5),
      ]);

      const exportService = new ExportDistributionService(reportService);

      const result = await exportService.exportAndDistribute(
        'EVT_FLOOD_2026',
        'pdf',
        'DONOR_RED_CROSS'
      );

      expect(result.success).toBe(true);
      expect(result.eventId).toBe('EVT_FLOOD_2026');
      expect(result.donorId).toBe('DONOR_RED_CROSS');
      expect(result.format).toBe('pdf');
      expect(result.fileUrl).toContain('.pdf');
      expect(result.distributionStatus).toBe('SENT');
    });

    it('should throw error if parameters are missing', async () => {
      const exportService = new ExportDistributionService();

      await expect(exportService.exportAndDistribute('', 'pdf', 'DONOR_1')).rejects.toThrow(
        'Missing required parameter: eventId'
      );
      await expect(exportService.exportAndDistribute('EVT_1', '', 'DONOR_1')).rejects.toThrow(
        'Missing required parameter: format'
      );
      await expect(exportService.exportAndDistribute('EVT_1', 'pdf', '')).rejects.toThrow(
        'Missing required parameter: donorId'
      );
    });
  });
});
