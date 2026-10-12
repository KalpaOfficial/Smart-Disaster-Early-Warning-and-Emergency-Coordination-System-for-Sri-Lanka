import {
  registerDonor,
  getRegisteredDonors,
  generatePostEventReport,
  exportReport,
  distributeReportToDonor,
} from '@/services/postEventReportService';
import { event, allCriteria, setupReporting } from './fixtures';
beforeEach(() => setupReporting());
it('registers normalized organisation details', async () => {
  const donor = await registerDonor(' Relief Group ', 'TEAM@EXAMPLE.ORG ');
  expect(donor).toMatchObject({ name: 'Relief Group', email: 'team@example.org' });
  expect(await getRegisteredDonors()).toContainEqual(donor);
});
it.each([
  ['', 'a@example.org'],
  ['Org', 'invalid'],
])('rejects invalid donor details', async (name, email) => {
  await expect(registerDonor(name, email)).rejects.toThrow('valid email');
});
it('requires a registered donor and matching exported report', async () => {
  const report = await generatePostEventReport(event, allCriteria, 'dmc');
  const result = await exportReport(report.id, 'csv');
  await expect(
    distributeReportToDonor(report.id, event.id, '', '', 'csv', result.exportUrl, 'dmc')
  ).rejects.toThrow('Select a registered');
  await expect(
    distributeReportToDonor(report.id, event.id, 'unknown', '', 'csv', result.exportUrl, 'dmc')
  ).rejects.toThrow('no longer exists');
  await expect(
    distributeReportToDonor(report.id, 'wrong-event', 'donor', '', 'csv', result.exportUrl, 'dmc')
  ).rejects.toThrow('does not match');
});
