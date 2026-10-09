import { Request, Response } from 'express';
import { ReportService } from '../services/ReportService';

/**
 * Controller handling post-event report generation requests.
 * Express adapter connecting HTTP layer with core domain services.
 */
export class ReportController {
  private readonly reportService: ReportService;

  constructor(reportService?: ReportService) {
    this.reportService = reportService || new ReportService();
  }

  /**
   * HTTP Handler for POST /api/reports/generate
   * Generates post-event response report concurrently querying Firestore aggregators.
   */
  public generateReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const eventId = req.body?.eventId || req.params?.eventId || req.query?.eventId;
      const filters = req.body?.filters || req.query;

      if (!eventId || typeof eventId !== 'string' || eventId.trim() === '') {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Missing or invalid required parameter: eventId',
        });
        return;
      }

      const report = await this.reportService.generatePostEventReport(eventId, filters);

      // Return 200 OK with report containing successful metrics and any marked "Incomplete/Timeout" metrics
      res.status(200).json(report);
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: (error as Error)?.message || 'An unexpected error occurred during report generation',
      });
    }
  };
}
