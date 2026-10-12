import { generatePostEventReport } from '@/services/postEventReportService';
import { event, setupReporting } from './fixtures';
beforeEach(() => setupReporting());
it('groups recorded distribution quantities by district, item and unit', async () => {
  const report = await generatePostEventReport(
    event,
    { selectedMetrics: ['resource_distribution'] },
    'dmc'
  );
  expect(report.metrics.resourceDistribution).toMatchObject({
    distributionByDistrict: {
      Ratnapura: { items: [{ name: 'Food rations', quantity: 12, unit: 'packs' }] },
      Kalutara: { items: [{ name: 'Drinking water', quantity: 20, unit: 'litres' }] },
    },
  });
});
it('filters distribution by district and dates', async () => {
  const report = await generatePostEventReport(
    event,
    { selectedMetrics: ['resource_distribution'], district: 'Ratnapura', startDate: '2026-10-02' },
    'dmc'
  );
  expect(report.metrics.resourceDistribution).toMatchObject({ totalPackagesDistributed: 12 });
});
