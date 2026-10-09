import { IExportStrategy } from '../interfaces/IExportStrategy';

/**
 * Strategy implementation for PDF export generation.
 * Follows the Strategy Pattern and Open/Closed Principle.
 */
export class PdfExportStrategy implements IExportStrategy {
  public readonly format = 'pdf';

  /**
   * Generates a PDF report document (simulated URL/file path).
   * @param reportData - The aggregated post-event response report data.
   */
  public async generateFile(reportData: any): Promise<string> {
    const eventId = reportData?.eventId || 'EVT_UNKNOWN';
    const timestamp = Date.now();
    // Simulate formatting document to PDF format
    const mockStorageUrl = `https://storage.disaster-warning.lk/reports/pdf/POST_EVENT_REPORT_${eventId}_${timestamp}.pdf`;
    return mockStorageUrl;
  }
}
