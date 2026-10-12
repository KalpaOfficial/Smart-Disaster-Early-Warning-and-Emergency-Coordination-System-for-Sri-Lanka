import {
  getClosedHazardEvents,
  getPostEventReports,
  getRegisteredDonors,
  registerDonor,
  generatePostEventReport,
  exportReport,
  getReportExport,
  distributeReportToDonor,
  getDonorDistributionHistory,
  validateReportCriteria,
} from '@/services/postEventReportService';
import { aggregatePostEventMetric, withinReportRange } from '@/utils/postEventMetrics';
import { getDoc, writeBatch } from 'firebase/firestore';
import type { ExportFormat } from '@/types/postEventReport';
import { allCriteria, event, setupReporting } from './fixtures';

beforeEach(() => setupReporting());
it.each(['citizen', 'volunteer', 'district_officer'])(
  'protects every reporting operation from %s',
  async role => {
    const records = setupReporting();
    records.set('users/dmc', { role });
    const operations = [
      () => getClosedHazardEvents(),
      () => getPostEventReports(),
      () => getRegisteredDonors(),
      () => registerDonor('Donor', 'donor@example.org'),
      () => generatePostEventReport(event, allCriteria, 'dmc'),
      () => exportReport('report', 'pdf'),
      () => getReportExport('report', 'csv'),
      () => distributeReportToDonor('report', event.id, 'donor', '', 'csv', '', 'dmc'),
      () => getDonorDistributionHistory('report'),
    ];
    for (const operation of operations) await expect(operation()).rejects.toThrow('Only DMC');
    expect(writeBatch).not.toHaveBeenCalled();
  }
);
it('includes the whole Sri Lankan calendar day and excludes both adjacent days', () => {
  const criteria = { selectedMetrics: [], startDate: '2026-10-02', endDate: '2026-10-02' };
  expect(withinReportRange('2026-10-01T18:29:59.999Z', criteria)).toBe(false);
  expect(withinReportRange('2026-10-01T18:30:00.000Z', criteria)).toBe(true);
  expect(withinReportRange('2026-10-02T18:29:59.999Z', criteria)).toBe(true);
  expect(withinReportRange('2026-10-02T18:30:00.000Z', criteria)).toBe(false);
  expect(
    validateReportCriteria(event, { ...criteria, selectedMetrics: ['alert_timeline'] })
  ).toEqual({ valid: true });
  expect(
    validateReportCriteria(event, {
      ...criteria,
      startDate: '2026-10-03',
      selectedMetrics: ['alert_timeline'],
    }).valid
  ).toBe(false);
});
it('groups shelter observations by the Sri Lankan day when timestamps cross midnight', () => {
  const result = aggregatePostEventMetric(
    'shelter_occupancy',
    [
      {
        id: 's1',
        hazardEventId: event.id,
        occupancyHistory: [
          { timestamp: '2026-10-01T18:29:00Z', occupancy: 10, capacity: 100 },
          { timestamp: '2026-10-01T18:31:00Z', occupancy: 20, capacity: 100 },
        ],
      },
    ],
    { selectedMetrics: ['shelter_occupancy'] },
    event.id
  );
  expect(result.metrics.shelterOccupancy).toMatchObject({
    timeSeriesOccupancy: [
      { date: '2026-10-01', occupancyCount: 10 },
      { date: '2026-10-02', occupancyCount: 20 },
    ],
  });
});
it('rejects an event that changes state while sources are being aggregated without saving', async () => {
  const records = setupReporting();
  const read = (getDoc as jest.Mock).getMockImplementation()!;
  let eventReads = 0;
  (getDoc as jest.Mock).mockImplementation(async ref => {
    if (ref.path === 'hazardEvents/closed' && ++eventReads === 2)
      return { exists: () => true, data: () => ({ ...event, status: 'active' }) };
    return read(ref);
  });
  await expect(generatePostEventReport(event, allCriteria, 'dmc')).rejects.toThrow(
    'no longer available'
  );
  expect([...records.keys()].some(path => path.startsWith('postEventReports/'))).toBe(false);
});
it('rejects unsupported formats, missing reports and exports before creating an artifact', async () => {
  await expect(exportReport('missing', 'pdf')).rejects.toThrow('not found');
  await expect(getReportExport('missing', 'csv')).rejects.toThrow('not found');
  for (const operation of [exportReport, getReportExport])
    await expect(operation('report', 'html' as ExportFormat)).rejects.toThrow('Unsupported');
  expect(writeBatch).not.toHaveBeenCalled();
});
it('rejects oversized artifacts without persisting any export', async () => {
  const records = setupReporting();
  const report = await generatePostEventReport(event, allCriteria, 'dmc');
  records.set(`postEventReports/${report.id}`, {
    ...report,
    eventTitle: 'Large event '.repeat(100000),
  });
  await expect(exportReport(report.id, 'csv')).rejects.toThrow('too large');
  expect(writeBatch).not.toHaveBeenCalled();
});
it('keeps the previous download available when replacing an export fails', async () => {
  const records = setupReporting();
  const report = await generatePostEventReport(event, allCriteria, 'dmc');
  await exportReport(report.id, 'csv');
  const saved = records.get(`postEventReports/${report.id}/exports/csv`);
  (writeBatch as jest.Mock).mockReturnValueOnce({
    set: jest.fn(),
    update: jest.fn(),
    commit: jest.fn().mockRejectedValue(new Error('Offline')),
  });
  await expect(exportReport(report.id, 'csv')).rejects.toThrow('Offline');
  expect(records.get(`postEventReports/${report.id}/exports/csv`)).toEqual(saved);
});
it('refuses donor distribution of a partial report even when it already has an export', async () => {
  const records = setupReporting();
  const report = await generatePostEventReport(event, allCriteria, 'dmc');
  const exported = await exportReport(report.id, 'csv');
  records.set(`postEventReports/${report.id}`, {
    ...report,
    overallStatus: 'PARTIAL_SUCCESS',
    failedMetrics: ['shelter_occupancy'],
  });
  await expect(
    distributeReportToDonor(report.id, event.id, 'donor', '', 'csv', exported.exportUrl, 'dmc')
  ).rejects.toThrow('Incomplete reports');
  expect([...records.keys()].some(path => path.startsWith('donorDistributions/'))).toBe(false);
});
it('includes the recorded closure time in the completed-event selector data', async () => {
  const records = setupReporting();
  records.set('hazardEvents/closed', {
    ...event,
    closedAt: { toDate: () => new Date('2026-10-03T12:00:00Z') },
  });
  // Firestore Timestamp instances are tested through the snapshot API, rather than structuredClone.
  const read = (await import('firebase/firestore')).getDocs as jest.Mock;
  read.mockResolvedValueOnce({
    docs: [
      {
        id: event.id,
        data: () => ({ ...event, closedAt: { toDate: () => new Date('2026-10-03T12:00:00Z') } }),
      },
    ],
  });
  expect((await getClosedHazardEvents())[0].closedAt).toBe('2026-10-03T12:00:00.000Z');
});
