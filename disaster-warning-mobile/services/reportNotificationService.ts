/**
 * Report Notification Service — Submitter Feedback & Outcome Tracking.
 * UC02 Phase 6: Submitter Feedback and In-App Notifications.
 * 
 * Tracks lifecycle status changes on submitted ground reports:
 * - Detects when a DMC Duty Officer verifies, rejects, or requests additional information.
 * - Stores read/acknowledged status states locally in AsyncStorage.
 * - Generates structured in-app notification toasts for citizens and volunteers.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMyReports } from './groundReportService';
import type { GroundReport, ReportNotification } from '@/types/groundReport';

const SEEN_STATUS_PREFIX = '@report_status_seen_v1_';

/**
 * Checks for recent status updates on reports submitted by the given user.
 * Returns notifications for status changes that have not yet been acknowledged by the user.
 */
export async function getUnreadReportNotifications(
  userId: string,
): Promise<ReportNotification[]> {
  if (!userId) return [];

  try {
    const myReports: GroundReport[] = await getMyReports(userId);
    const notifications: ReportNotification[] = [];

    for (const report of myReports) {
      // We only notify when an officer has acted on the report (not pending)
      if (report.status === 'pending_verification') continue;

      const key = `${SEEN_STATUS_PREFIX}${report.id}`;
      const lastSeenStatus = await AsyncStorage.getItem(key);

      // If user hasn't seen this current status yet
      if (lastSeenStatus !== report.status) {
        let title = '';
        let message = '';

        if (report.status === 'verified') {
          title = `Observation Verified (${report.referenceNumber})`;
          message = report.hazardEventTitle
            ? `Your observation was verified by ${report.verifiedByName || 'DMC Officer'} and attached to "${report.hazardEventTitle}".`
            : `Your hazard report has been officially verified by ${report.verifiedByName || 'DMC Officer'}.`;
        } else if (report.status === 'rejected') {
          title = `Report Reviewed (${report.referenceNumber})`;
          message = report.verificationDecision
            ? `Reason: ${report.verificationDecision}`
            : 'Your hazard report was reviewed and marked as not verified.';
        } else if (report.status === 'info_requested') {
          title = `Clarification Requested (${report.referenceNumber})`;
          message = report.infoRequestedMessage
            ? `DMC Duty Officer: "${report.infoRequestedMessage}"`
            : 'The duty officer requested additional details for your observation.';
        }

        notifications.push({
          id: `notif-${report.id}-${report.status}`,
          reportId: report.id,
          referenceNumber: report.referenceNumber,
          status: report.status,
          title,
          message,
          timestamp: report.verificationTimestamp || report.updatedAt || new Date().toISOString(),
          officerName: report.verifiedByName,
          hazardEventTitle: report.hazardEventTitle,
        });
      }
    }

    // Sort newest first
    return notifications.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  } catch (err) {
    console.warn('Failed to check report status notifications:', err);
    return [];
  }
}

/**
 * Mark a specific report's status notification as read/acknowledged.
 */
export async function markNotificationAsRead(
  reportId: string,
  status: string,
): Promise<void> {
  try {
    const key = `${SEEN_STATUS_PREFIX}${reportId}`;
    await AsyncStorage.setItem(key, status);
  } catch (err) {
    console.warn('Failed to mark notification as read:', err);
  }
}

/**
 * Mark all given report notifications as read/acknowledged.
 */
export async function markAllNotificationsAsRead(
  notifications: ReportNotification[],
): Promise<void> {
  try {
    await Promise.all(
      notifications.map((n) => markNotificationAsRead(n.reportId, n.status)),
    );
  } catch (err) {
    console.warn('Failed to mark all notifications as read:', err);
  }
}

/**
 * Reset seen status for testing / debug purposes.
 */
export async function clearAllNotificationSeenKeys(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const seenKeys = keys.filter((k) => k.startsWith(SEEN_STATUS_PREFIX));
    if (seenKeys.length > 0) {
      await Promise.all(seenKeys.map((k) => AsyncStorage.removeItem(k)));
    }
  } catch (err) {
    console.warn('Failed to clear seen notification keys:', err);
  }
}
