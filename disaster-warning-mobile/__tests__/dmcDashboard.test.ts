import { dmcReportSummary } from '@/utils/dmcDashboard';
import { getMobileNavItems, isMobileNavActive } from '@/constants/navigation';
import { subscribeToGroundReports } from '@/services/groundReportService';
import { onSnapshot } from 'firebase/firestore';
import type { GroundReport } from '@/types/groundReport';

it('keeps DMC navigation focused on hazard events, warnings and report verification', () => {
  expect(getMobileNavItems('dmc_officer').map(item => item.label)).toEqual([
    'Home',
    'Events',
    'Warnings',
    'Reports',
  ]);
  expect(getMobileNavItems('district_officer').map(item => item.label)).toEqual([
    'Home',
    'Shelters',
    'Rescue',
    'Supplies',
  ]);
});
it.each(['/warnings/events', '/(app)/warnings/events', '/warnings/events/edit'])(
  'selects only the Events tab for %s',
  pathname => {
    expect(
      getMobileNavItems('dmc_officer')
        .filter(item => isMobileNavActive(pathname, item.route))
        .map(item => item.label)
    ).toEqual(['Events']);
  }
);
it.each(['/warnings', '/warnings/flood', '/warnings/compose', '/warnings/summary'])(
  'keeps the Warnings tab selected for %s',
  pathname => {
    expect(
      getMobileNavItems('dmc_officer')
        .filter(item => isMobileNavActive(pathname, item.route))
        .map(item => item.label)
    ).toEqual(['Warnings']);
  }
);
it.each(['citizen', 'volunteer', 'district_officer'] as const)(
  'does not expose event management in %s navigation',
  role => {
    expect(getMobileNavItems(role).some(item => item.key === 'events')).toBe(false);
  }
);
it.each(['/post-event-reports', '/(app)/post-event-reports'])(
  'keeps Home selected for the post-event dashboard action at %s',
  pathname => {
    expect(
      getMobileNavItems('dmc_officer')
        .filter(item => isMobileNavActive(pathname, item.route))
        .map(item => item.label)
    ).toEqual(['Home']);
  }
);
it('counts report states and previews the three newest pending reports without mutating records', () => {
  const reports = [
    'pending_verification',
    'verified',
    'rejected',
    'info_requested',
    'pending_verification',
    'pending_verification',
    'pending_verification',
  ].map(
    (status, i) => ({ id: String(i), status, createdAt: `2026-10-12T0${i}:00:00Z` }) as GroundReport
  );
  const original = reports.map(r => r.id);
  const summary = dmcReportSummary(reports);
  expect(summary).toMatchObject({ pending: 4, verified: 1, rejected: 1, infoRequested: 1 });
  expect(summary.pendingReports.map(r => r.id)).toEqual(['6', '5', '4']);
  expect(reports.map(r => r.id)).toEqual(original);
  expect(dmcReportSummary([])).toMatchObject({
    pending: 0,
    verified: 0,
    rejected: 0,
    infoRequested: 0,
    pendingReports: [],
  });
});
it('updates dashboard reports from Firestore and returns listener cleanup', () => {
  const stop = jest.fn();
  (onSnapshot as jest.Mock).mockReturnValueOnce(stop);
  const receive = jest.fn();
  const fail = jest.fn();
  const cleanup = subscribeToGroundReports(receive, fail);
  const calls = (onSnapshot as jest.Mock).mock.calls;
  const [, update, error] = calls[calls.length - 1];
  update({
    docs: [
      {
        id: 'report-1',
        data: () => ({
          status: 'pending_verification',
          description: 'Rising water',
          createdAt: '2026-10-12T09:00:00Z',
        }),
      },
    ],
  });
  expect(receive).toHaveBeenCalledWith([
    expect.objectContaining({ id: 'report-1', status: 'pending_verification' }),
  ]);
  error(new Error('offline'));
  expect(fail).toHaveBeenCalledWith(expect.any(Error));
  cleanup();
  expect(stop).toHaveBeenCalledTimes(1);
});
