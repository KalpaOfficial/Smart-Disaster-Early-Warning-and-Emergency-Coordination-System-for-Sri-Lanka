import { getClosedHazardEvents, generatePostEventReport } from '@/services/postEventReportService';
import { auth } from '@/services/firebase';
import { event, setupReporting } from './fixtures';
beforeEach(() => setupReporting());
it('lists closed events with original ISO dates', async () => {
  const records = setupReporting();
  records.set('hazardEvents/active', { ...event, status: 'active' });
  expect(await getClosedHazardEvents()).toEqual([event]);
});
it('checks persisted event state instead of trusting the screen', async () => {
  const records = setupReporting();
  records.set('hazardEvents/closed', { ...event, status: 'active' });
  await expect(
    generatePostEventReport(event, { selectedMetrics: ['alert_timeline'] }, 'dmc')
  ).rejects.toThrow('Event Not Closed');
});
it.each(['citizen', 'volunteer', 'district_officer'])('refuses access to %s', async role => {
  const records = setupReporting();
  records.set('users/dmc', { role });
  await expect(getClosedHazardEvents()).rejects.toThrow('Only DMC');
});
it('refuses unsigned and mismatched officer requests', async () => {
  Object.assign(auth, { currentUser: null });
  await expect(getClosedHazardEvents()).rejects.toThrow('Unauthorized');
  Object.assign(auth, { currentUser: { uid: 'other' } });
  await expect(
    generatePostEventReport(event, { selectedMetrics: ['alert_timeline'] }, 'dmc')
  ).rejects.toThrow('Unauthorized');
});
