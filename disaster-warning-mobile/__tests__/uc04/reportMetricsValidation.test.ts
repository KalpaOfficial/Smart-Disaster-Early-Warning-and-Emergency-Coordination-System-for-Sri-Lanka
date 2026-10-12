import { validateReportCriteria, generatePostEventReport } from '@/services/postEventReportService';
import type { ReportFilterCriteria } from '@/types/postEventReport';
import { event, setupReporting } from './fixtures';
it.each([
  { selectedMetrics: [] },
  { selectedMetrics: ['unknown'] },
  { selectedMetrics: ['alert_timeline'], startDate: 'invalid' },
  { selectedMetrics: ['alert_timeline'], endDate: '2026-02-30' },
  { selectedMetrics: ['alert_timeline'], startDate: '2026-10-03', endDate: '2026-10-01' },
  { selectedMetrics: ['alert_timeline'], district: 'Unknown' },
  { selectedMetrics: ['alert_timeline'], district: 'Colombo' },
])('rejects invalid criteria: %j', criteria => {
  expect(validateReportCriteria(event, criteria as ReportFilterCriteria).valid).toBe(false);
});
it('rejects missing and active events', () => {
  expect(validateReportCriteria(null, { selectedMetrics: ['alert_timeline'] }).valid).toBe(false);
  expect(
    validateReportCriteria({ ...event, status: 'active' }, { selectedMetrics: ['alert_timeline'] })
      .valid
  ).toBe(false);
});
it('deduplicates metrics at the persistence boundary', async () => {
  setupReporting();
  const report = await generatePostEventReport(
    event,
    { selectedMetrics: ['alert_timeline', 'alert_timeline'] },
    'dmc'
  );
  expect(report.summary.totalMetricsCount).toBe(1);
});
