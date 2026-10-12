import {
  generatePostEventReport,
  exportReport,
  getReportExport,
} from '@/services/postEventReportService';
import { reportCsv } from '@/utils/postEventExport';
import { writeBatch } from 'firebase/firestore';
import { event, allCriteria, setupReporting } from './fixtures';
beforeEach(() => setupReporting());
it.each(['pdf', 'csv'] as const)('generates and retrieves a real %s artifact', async format => {
  const report = await generatePostEventReport(event, allCriteria, 'dmc');
  const result = await exportReport(report.id, format);
  expect(atob(result.artifact.base64)).toContain(format === 'pdf' ? '%PDF-' : 'Estimated reach');
  expect(await getReportExport(report.id, format)).toMatchObject(result.artifact);
  expect((writeBatch as jest.Mock).mock.results.at(-1)!.value.update).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ exportFormat: format })
  );
});
it('preserves the report and existing export if the atomic export commit fails', async () => {
  const records = setupReporting();
  const report = await generatePostEventReport(event, allCriteria, 'dmc');
  (writeBatch as jest.Mock).mockReturnValueOnce({
    set: jest.fn(),
    update: jest.fn(),
    commit: jest.fn().mockRejectedValue(new Error('Cannot link file')),
  });
  await expect(exportReport(report.id, 'csv')).rejects.toThrow('Cannot link file');
  expect(records.get('postEventReports/' + report.id)?.metrics).toEqual(report.metrics);
  expect(records.has(`postEventReports/${report.id}/exports/csv`)).toBe(false);
  expect(records.get('postEventReports/' + report.id)?.exportUrl).toBeUndefined();
});
it('neutralizes spreadsheet formula injection', async () => {
  const report = await generatePostEventReport(event, allCriteria, 'dmc');
  report.eventTitle = '=SUM(1,2)';
  expect(reportCsv(report)).toContain('"\'=SUM(1,2)"');
});
it('exports readable local dates and keeps numeric values and their units in separate columns', async () => {
  const report = await generatePostEventReport(event, allCriteria, 'dmc');
  report.generatedAt = '2026-10-12T04:19:25.603Z';
  const csv = reportCsv(report);
  expect(csv).toContain('Date (Sri Lanka time)');
  expect(csv).toContain('12 Oct 2026, 09:49');
  expect(csv).toContain('All affected districts');
  expect(csv).toMatch(/"Total warnings","\d+","warnings"/);
  expect(csv.split('\r\n').every(row => row.startsWith('"') || row.startsWith('\uFEFF"'))).toBe(
    true
  );
});
