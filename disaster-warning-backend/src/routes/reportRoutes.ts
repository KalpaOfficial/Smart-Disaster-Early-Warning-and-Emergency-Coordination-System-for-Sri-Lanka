import { Router } from 'express';
import { ReportController } from '../controllers/ReportController';
import { ExportController } from '../controllers/ExportController';

/**
 * Express router mapping UC04 endpoints for report generation and donor distribution.
 * 
 * Routes:
 * - POST /api/reports/generate -> Concurrently aggregates metrics for a disaster event.
 * - POST /api/reports/export   -> Exports generated report to PDF/CSV and distributes to donor.
 */
export function createReportRouter(
  reportController: ReportController = new ReportController(),
  exportController: ExportController = new ExportController()
): Router {
  const router = Router();

  // POST /api/reports/generate
  router.post('/generate', reportController.generateReport);

  // POST /api/reports/export
  router.post('/export', exportController.exportAndDistribute);

  return router;
}

export default createReportRouter();
