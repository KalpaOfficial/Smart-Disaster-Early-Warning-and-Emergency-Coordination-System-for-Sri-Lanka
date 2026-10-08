/**
 * React Hook for UC02 Submitter Feedback & In-App Notifications.
 * Periodically checks and provides active unacknowledged notifications
 * for report status changes (verified, rejected, info_requested).
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  getUnreadReportNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '@/services/reportNotificationService';
import type { ReportNotification } from '@/types/groundReport';

export function useReportNotifications() {
  const { state } = useAuth();
  const user = state.user;
  const isSubmitter = user?.role === 'citizen' || user?.role === 'volunteer';

  const [notifications, setNotifications] = useState<ReportNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id || !isSubmitter) return;
    try {
      setLoading(true);
      const items = await getUnreadReportNotifications(user.id);
      setNotifications(items);
    } catch (err) {
      console.warn('Failed to fetch report notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, isSubmitter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const dismissNotification = useCallback(async (notif: ReportNotification) => {
    await markNotificationAsRead(notif.reportId, notif.status);
    setNotifications((prev) => prev.filter((item) => item.id !== notif.id));
  }, []);

  const dismissAll = useCallback(async () => {
    await markAllNotificationsAsRead(notifications);
    setNotifications([]);
  }, [notifications]);

  return {
    notifications,
    activeNotification: notifications[0] || null,
    dismissNotification,
    dismissAll,
    refreshNotifications: fetchNotifications,
    loading,
  };
}
