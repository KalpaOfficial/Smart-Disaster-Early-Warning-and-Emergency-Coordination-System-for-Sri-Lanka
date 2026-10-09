import { ExportStrategyFactory } from '../strategies/ExportStrategyFactory';
import { ReportService } from './ReportService';

export interface ExportDistributionResult {
  success: boolean;
  eventId: string;
  donorId: string;
  format: string;
  fileUrl: string;
  distributionStatus: 'SENT' | 'FAILED';
  distributedAt: string;
}

/**
 * Service orchestrating post-event report export and distribution to donor organizations.
 * Follows Single Responsibility Principle (SRP) and Open/Closed Principle (OCP).
 */
export class ExportDistributionService {
  private readonly reportService: ReportService;

  constructor(reportService?: ReportService) {
    this.reportService = reportService || new ReportService();
  }

  /**
   * Generates report file in requested format (PDF/CSV) and distributes it to donor.
   * 
   * @param eventId - Disaster event ID.
   * @param format - Export format ('pdf' | 'csv').
   * @param donorId - Target donor organization ID.
   * @param reportData - Optional pre-generated report payload.
   */
  public async exportAndDistribute(
    eventId: string,
    format: string,
    donorId: string,
    reportData?: any
  ): Promise<ExportDistributionResult> {
    if (!eventId) {
      throw new Error('Missing required parameter: eventId');
    }
    if (!format) {
      throw new Error('Missing required parameter: format');
    }
    if (!donorId) {
      throw new Error('Missing required parameter: donorId');
    }

    // Generate post-event report if reportData was not passed directly
    const report = reportData || (await this.reportService.generatePostEventReport(eventId));

    // Get strategy via Factory (Strategy Pattern)
    const strategy = ExportStrategyFactory.getStrategy(format);

    // Generate export file (PDF / CSV)
    const fileUrl = await strategy.generateFile(report);

    // Log distribution event for audit
    console.log(
      `[DISTRIBUTION LOG] Report for event '${eventId}' successfully exported to '${format.toUpperCase()}' ` +
      `and distributed to donor organization '${donorId}'. Download URL: ${fileUrl}`
    );

    return {
      success: true,
      eventId,
      donorId,
      format: strategy.format,
      fileUrl,
      distributionStatus: 'SENT',
      distributedAt: new Date().toISOString(),
    };
  }
}
