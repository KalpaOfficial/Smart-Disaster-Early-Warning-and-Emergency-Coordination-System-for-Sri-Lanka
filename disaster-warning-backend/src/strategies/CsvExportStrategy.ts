import { IExportStrategy } from '../interfaces/IExportStrategy';

/**
 * Strategy implementation for CSV export generation.
 * Follows the Strategy Pattern and Open/Closed Principle.
 */
export class CsvExportStrategy implements IExportStrategy {
  public readonly format = 'csv';

  /**
   * Generates a CSV tabular dataset export (simulated URL/file path).
   * @param reportData - The aggregated post-event response report data.
   */
  public async generateFile(reportData: any): Promise<string> {
    const eventId = reportData?.eventId || 'EVT_UNKNOWN';
    const timestamp = Date.now();
    // Simulate formatting document to CSV format
    const mockStorageUrl = `https://storage.disaster-warning.lk/reports/csv/POST_EVENT_REPORT_${eventId}_${timestamp}.csv`;
    return mockStorageUrl;
  }
}
