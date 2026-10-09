import { Request, Response } from 'express';
import { ExportDistributionService } from '../services/ExportDistributionService';

/**
 * Controller handling report export and donor distribution requests.
 */
export class ExportController {
  private readonly exportDistributionService: ExportDistributionService;

  constructor(exportDistributionService?: ExportDistributionService) {
    this.exportDistributionService = exportDistributionService || new ExportDistributionService();
  }

  /**
   * HTTP Handler for POST /api/reports/export
   * Exports report to PDF or CSV using Strategy Pattern and distributes to donor organization.
   */
  public exportAndDistribute = async (req: Request, res: Response): Promise<void> => {
    try {
      const { eventId, format, donorId, reportData } = req.body || {};

      if (!eventId || typeof eventId !== 'string') {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Missing or invalid required field: eventId',
        });
        return;
      }

      if (!format || typeof format !== 'string') {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Missing or invalid required field: format',
        });
        return;
      }

      if (!donorId || typeof donorId !== 'string') {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Missing or invalid required field: donorId',
        });
        return;
      }

      const result = await this.exportDistributionService.exportAndDistribute(
        eventId,
        format,
        donorId,
        reportData
      );

      res.status(200).json(result);
    } catch (error) {
      const errorMessage = (error as Error)?.message || 'Export failed';
      if (errorMessage.includes('Unsupported export format')) {
        res.status(400).json({
          error: 'Bad Request',
          message: errorMessage,
        });
        return;
      }

      res.status(500).json({
        error: 'Internal Server Error',
        message: errorMessage,
      });
    }
  };
}
