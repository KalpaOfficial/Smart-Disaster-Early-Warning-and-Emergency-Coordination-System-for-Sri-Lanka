import { generatePostEventReport } from '@/services/postEventReportService';
import { event, setupReporting } from './fixtures';
beforeEach(() => setupReporting());
it('does not double-count channels as unique citizens and explains repeated recipients', async () => {
  const report = await generatePostEventReport(
    event,
    { selectedMetrics: ['citizens_reached'] },
    'dmc'
  );
  expect(report.metrics.citizenReach).toMatchObject({
    totalCitizensReached: 3,
    notificationDeliveryRate: 83.3,
    acknowledgedCount: 0,
    measurementNote: expect.stringContaining('Unique recipients'),
  });
});
it('counts legacy successful totals without inventing acknowledgements', async () => {
  const records = setupReporting();
  records.set('warnings/w1', {
    ...records.get('warnings/w1'),
    channelResults: [{ status: 'Success', recipientCount: 3 }],
  });
  const report = await generatePostEventReport(
    event,
    { selectedMetrics: ['citizens_reached'], district: 'Ratnapura' },
    'dmc'
  );
  expect(report.metrics.citizenReach).toMatchObject({
    totalCitizensReached: 3,
    notificationDeliveryRate: 100,
  });
});
