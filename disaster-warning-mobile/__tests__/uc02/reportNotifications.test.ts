import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMyReports } from '@/services/groundReportService';
import {
  getUnreadReportNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  clearAllNotificationSeenKeys,
} from '@/services/reportNotificationService';
import type { GroundReport } from '@/types/groundReport';
jest.mock('@/services/groundReportService', () => ({ getMyReports: jest.fn() }));
const report = (status: GroundReport['status'], timestamp = '2026-10-12T01:00:00Z') =>
  ({
    id: 'report',
    referenceNumber: 'GR-TEST',
    status,
    updatedAt: timestamp,
    verificationTimestamp: timestamp,
    verifiedByName: 'Officer',
    hazardEventTitle: 'Flood',
    verificationDecision: 'Insufficient evidence',
    infoRequestedMessage: 'Please confirm depth.',
  }) as GroundReport;
it.each(['verified', 'rejected', 'info_requested'] as const)(
  'notifies the submitter of %s and marks only that decision as read',
  async status => {
    (getMyReports as jest.Mock).mockResolvedValue([report(status)]);
    const notifications = await getUnreadReportNotifications('citizen');
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ status, officerName: 'Officer' });
    expect(notifications[0].message.length).toBeGreaterThan(0);
    await markNotificationAsRead('report', status, notifications[0].timestamp);
    expect(await getUnreadReportNotifications('citizen')).toEqual([]);
  }
);
it('notifies again when the officer issues a second information request after a reply', async () => {
  (getMyReports as jest.Mock).mockResolvedValue([report('info_requested')]);
  const first = await getUnreadReportNotifications('citizen');
  await markAllNotificationsAsRead(first);
  (getMyReports as jest.Mock).mockResolvedValue([report('info_requested', '2026-10-12T02:00:00Z')]);
  const next = await getUnreadReportNotifications('citizen');
  expect(next).toHaveLength(1);
  expect(next[0].id).not.toBe(first[0].id);
});
it('does not notify pending reports or query without a user, and clears only notification keys', async () => {
  expect(await getUnreadReportNotifications('')).toEqual([]);
  expect(getMyReports).not.toHaveBeenCalled();
  (getMyReports as jest.Mock).mockResolvedValue([report('pending_verification')]);
  expect(await getUnreadReportNotifications('citizen')).toEqual([]);
  await AsyncStorage.setItem('unrelated', 'preserve');
  await markNotificationAsRead('report', 'verified', '2026-10-12T01:00:00Z');
  await clearAllNotificationSeenKeys();
  expect(await AsyncStorage.getItem('unrelated')).toBe('preserve');
  expect(await AsyncStorage.getItem('@report_status_seen_v1_report')).toBeNull();
});
