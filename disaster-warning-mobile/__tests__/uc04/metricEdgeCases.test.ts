import { aggregatePostEventMetric, reportDate, withinReportRange } from '@/utils/postEventMetrics';
import { generatePostEventReport, exportReport } from '@/services/postEventReportService';
import { reportCsv, buildReportExport } from '@/utils/postEventExport';
import { event, setupReporting } from './fixtures';
it('supports Firestore timestamps and rejects undated records', () => {
  expect(reportDate({ toDate: () => new Date('2026-10-01') })).toBe('2026-10-01T00:00:00.000Z');
  expect(reportDate(null)).toBe('');
  expect(withinReportRange(undefined, { selectedMetrics: [] })).toBe(false);
});
it('handles missing or failed channel receipts without inventing delivery counts', () => {
  const result = aggregatePostEventMetric(
    'citizens_reached',
    [
      {
        id: '1',
        status: 'failed',
        createdAt: '2026-10-01',
        channelResults: [{ status: 'Failed', recipientCount: 2 }],
      },
      { id: '2', status: 'active', createdAt: '2026-10-01' },
    ],
    { selectedMetrics: ['citizens_reached'] },
    'closed'
  );
  expect(result.metrics.citizenReach).toMatchObject({
    totalCitizensReached: 0,
    notificationDeliveryRate: 0,
  });
});
it('skips other-event, other-district and undated occupancy entries, including reassigned history', () => {
  const result = aggregatePostEventMetric(
    'shelter_occupancy',
    [
      {
        id: '1',
        hazardEventId: 'closed',
        district: 'Ratnapura',
        occupancyHistory: [
          { timestamp: '2026-10-01', occupancy: 10, capacity: 0 },
          { timestamp: '2026-10-01', hazardEventId: 'other', occupancy: 200 },
          { timestamp: '2026-10-01', district: 'Colombo', occupancy: 200 },
          { timestamp: 'invalid', occupancy: 200 },
        ],
      },
      { id: 'empty' },
    ],
    { selectedMetrics: ['shelter_occupancy'], district: 'Ratnapura' },
    'closed'
  );
  expect(result.recordCount).toBe(1);
  expect(result.metrics.shelterOccupancy).toMatchObject({
    totalCapacitiesOccupied: 10,
    peakOccupancyPercentage: 0,
  });
});
it('merges identical items while preserving different units and other supply categories', () => {
  const rows = ['food', 'medicine', 'water', 'blankets', 'tents', 'unknown'].map((type, i) => ({
    id: String(i),
    destinationDistrict: 'Ratnapura',
    supplyName: type,
    supplyType: type,
    quantity: 2,
    unit: 'packs',
    distributedAt: '2026-10-01',
  }));
  rows.push({ ...rows[0], id: 'more' });
  const result = aggregatePostEventMetric(
    'resource_distribution',
    rows,
    { selectedMetrics: ['resource_distribution'] },
    'closed'
  );
  const distribution = result.metrics.resourceDistribution;
  if (!distribution || typeof distribution === 'string') throw Error('Missing distribution');
  expect(distribution.distributionByDistrict.Ratnapura.items).toContainEqual({
    name: 'food',
    quantity: 4,
    unit: 'packs',
  });
  expect(distribution.distributionByDistrict.Ratnapura).toMatchObject({
    tents: 2,
    blankets: 2,
    medicalKits: 2,
  });
});
it('exports only selected metrics and includes source failures in the file', async () => {
  setupReporting();
  const report = await generatePostEventReport(
    event,
    { selectedMetrics: ['alert_timeline'] },
    'dmc'
  );
  report.metricErrors = { shelter_occupancy: 'Network unavailable' };
  expect(reportCsv(report)).toContain('Network unavailable');
  expect(reportCsv(report)).not.toContain('Estimated reach');
  report.eventTitle = 'A "quoted", title';
  expect(reportCsv(report)).toContain('A ""quoted"", title');
  expect((await exportReport(report.id, 'csv')).success).toBe(true);
});
it('paginates long PDF reports instead of clipping the final records', async () => {
  setupReporting();
  const report = await generatePostEventReport(
    event,
    { selectedMetrics: ['alert_timeline'] },
    'dmc'
  );
  if (!report.metrics.alerts || typeof report.metrics.alerts === 'string')
    throw Error('Missing alert metric');
  report.metrics.alerts.timeline = Array.from({ length: 100 }, (_, i) => ({
    timestamp: '2026-10-01',
    level: 'warning',
    message: `Long warning ${i}: ` + 'Safety instructions '.repeat(20),
  }));
  const output = atob(buildReportExport(report, 'pdf').base64);
  expect(output.match(/\/Type \/Page\b/g)!.length).toBeGreaterThan(1);
  expect(output).toContain('Long warning 99');
});
