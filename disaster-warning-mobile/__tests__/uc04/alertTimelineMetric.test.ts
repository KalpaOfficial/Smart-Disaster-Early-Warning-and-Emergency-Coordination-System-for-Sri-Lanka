import { generatePostEventReport } from '@/services/postEventReportService';
import { event, setupReporting } from './fixtures';
beforeEach(() => setupReporting());
it('builds this event timeline and counts follow-up warnings', async () => {
  const report = await generatePostEventReport(
    event,
    { selectedMetrics: ['alert_timeline'] },
    'dmc'
  );
  expect(report.metrics.alerts).toMatchObject({
    totalAlertsIssued: 2,
    escalationCount: 1,
    warningsBySeverity: { advisory: 1, evacuation: 1 },
  });
  expect(
    typeof report.metrics.alerts !== 'string' &&
      report.metrics.alerts?.timeline.map(row => row.message)
  ).toEqual(['Rain alert', 'Evacuate safely']);
});
it('applies district and inclusive end date', async () => {
  const report = await generatePostEventReport(
    event,
    {
      selectedMetrics: ['alert_timeline'],
      district: 'Kalutara',
      startDate: '2026-10-02',
      endDate: '2026-10-02',
    },
    'dmc'
  );
  expect(report.metrics.alerts).toMatchObject({ totalAlertsIssued: 1 });
});
