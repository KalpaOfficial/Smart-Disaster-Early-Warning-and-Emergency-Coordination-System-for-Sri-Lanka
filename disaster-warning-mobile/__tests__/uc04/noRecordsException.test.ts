import { generatePostEventReport } from '@/services/postEventReportService';
import { addDoc } from 'firebase/firestore';
import { event, setupReporting } from './fixtures';
it('does not save a report when no records match', async () => {
  setupReporting();
  await expect(
    generatePostEventReport(
      event,
      { selectedMetrics: ['alert_timeline'], startDate: '2030-01-01' },
      'dmc'
    )
  ).rejects.toThrow('No records');
  expect(addDoc).not.toHaveBeenCalled();
});
it('shows zero for an empty metric when another selected metric has evidence', async () => {
  const records = setupReporting();
  records.delete('shelters/s1');
  const report = await generatePostEventReport(
    event,
    { selectedMetrics: ['alert_timeline', 'shelter_occupancy'] },
    'dmc'
  );
  expect(report.metrics.shelterOccupancy).toMatchObject({ totalSheltersActive: 0 });
});
