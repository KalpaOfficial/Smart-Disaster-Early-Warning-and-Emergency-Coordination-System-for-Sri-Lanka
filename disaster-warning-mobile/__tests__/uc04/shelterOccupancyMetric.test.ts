import { generatePostEventReport } from '@/services/postEventReportService';
import { event, setupReporting } from './fixtures';
beforeEach(() => setupReporting());
it('uses recorded headcounts and actual capacities', async () => {
  const report = await generatePostEventReport(
    event,
    { selectedMetrics: ['shelter_occupancy'] },
    'dmc'
  );
  expect(report.metrics.shelterOccupancy).toEqual({
    totalSheltersActive: 1,
    peakOccupancyPercentage: 50,
    totalCapacitiesOccupied: 50,
    timeSeriesOccupancy: [
      { date: '2026-10-01', occupancyCount: 20 },
      { date: '2026-10-02', occupancyCount: 50 },
    ],
  });
});
it('retains event-tagged history after reassignment', async () => {
  const records = setupReporting();
  records.set('shelters/s1', {
    ...records.get('shelters/s1'),
    hazardEventId: 'new-event',
    district: 'Colombo',
  });
  const report = await generatePostEventReport(
    event,
    { selectedMetrics: ['shelter_occupancy'], district: 'Ratnapura', endDate: '2026-10-01' },
    'dmc'
  );
  expect(report.metrics.shelterOccupancy).toMatchObject({ totalCapacitiesOccupied: 20 });
});
