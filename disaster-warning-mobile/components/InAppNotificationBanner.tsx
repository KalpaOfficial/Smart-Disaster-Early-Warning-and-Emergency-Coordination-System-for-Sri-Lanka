/**
 * In-App Notification Banner Component for UC02 Submitter Feedback.
 * Displays prominent feedback toast/banner when an officer verifies, rejects,
 * or requests additional clarification on a user's submitted ground report.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Spacing, FontSize } from '@/constants/colors';
import type { ReportNotification } from '@/types/groundReport';

interface InAppNotificationBannerProps {
  notification: ReportNotification;
  onPress: () => void;
  onDismiss: () => void;
}

export function InAppNotificationBanner({
  notification,
  onPress,
  onDismiss,
}: InAppNotificationBannerProps) {
  const isVerified = notification.status === 'verified';
  const isRejected = notification.status === 'rejected';

  const iconName: keyof typeof Ionicons.glyphMap = isVerified
    ? 'checkmark-circle'
    : isRejected
    ? 'alert-circle'
    : 'help-circle';

  const accentColor = isVerified
    ? Colors.report.verified
    : isRejected
    ? Colors.report.rejected
    : Colors.report.infoRequested;

  const formattedTime = new Date(notification.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={[styles.container, { borderColor: accentColor }]}>
      <TouchableOpacity
        style={styles.contentWrap}
        activeOpacity={0.85}
        onPress={onPress}
      >
        <View style={[styles.iconBox, { backgroundColor: `${accentColor}25` }]}>
          <Ionicons name={iconName} size={22} color={accentColor} />
        </View>

        <View style={styles.textGroup}>
          <View style={styles.headerRow}>
            <View style={[styles.badge, { backgroundColor: `${accentColor}20` }]}>
              <Text style={[styles.badgeText, { color: accentColor }]}>
                {notification.status.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
            <Text style={styles.timeText}>{formattedTime}</Text>
          </View>

          <Text style={styles.title} numberOfLines={1}>
            {notification.title}
          </Text>
          <Text style={styles.message} numberOfLines={2}>
            {notification.message}
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.closeBtn}
        onPress={onDismiss}
        accessibilityLabel="Dismiss notification"
        activeOpacity={0.7}
      >
        <Ionicons name="close" size={18} color={Colors.text.tertiary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
    overflow: 'hidden',
  },
  contentWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
    gap: Spacing.md,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textGroup: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  badgeText: {
    fontSize: FontSize.micro,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  timeText: {
    fontSize: FontSize.micro,
    color: Colors.text.tertiary,
    marginRight: Spacing.xs,
  },
  title: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 2,
  },
  message: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    lineHeight: 16,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.xs,
  },
});
