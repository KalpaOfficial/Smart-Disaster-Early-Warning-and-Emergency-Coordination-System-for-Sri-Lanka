import {
  generatePostEventReport,
  exportReport,
  getClosedHazardEvents,
  getPostEventReports,
  distributeReportToDonor,
  getDonorDistributionHistory,
} from '@/services/postEventReportService';
import { allCriteria, event, setupReporting } from './fixtures';
beforeEach(() => setupReporting());
it('runs closed-event selection, actual aggregation, persistence, file export and donor sharing audit', async () => {
  expect((await getClosedHazardEvents())[0].id).toBe(event.id);
  const report = await generatePostEventReport(event, allCriteria, 'dmc');
  expect(report.overallStatus).toBe('COMPLETE');
  expect(report.summary.successfulMetricsCount).toBe(4);
  expect((await getPostEventReports())[0].id).toBe(report.id);
  const exported = await exportReport(report.id, 'pdf');
  expect(atob(exported.artifact.base64).startsWith('%PDF-')).toBe(true);
  const audit = await distributeReportToDonor(
    report.id,
    event.id,
    'donor',
    'Untrusted name',
    'pdf',
    exported.exportUrl,
    'dmc'
  );
  expect(audit).toMatchObject({
    status: 'SHARED',
    donorName: 'Relief Partner',
    donorEmail: 'relief@example.org',
  });
  expect((await getDonorDistributionHistory(report.id))[0].id).toBe(audit.id);
});
