/**
 * Offline Indicator & Sync Banner Component for UC02.
 * Displays offline network alert and badge showing queued reports waiting to sync.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Spacing, FontSize } from '@/constants/colors';

interface OfflineIndicatorProps {
  isOffline?: boolean;
  queueCount: number;
  onPressSync?: () => void;
  onPressQueue?: () => void;
}

export function OfflineIndicator({
  isOffline = false,
  queueCount,
  onPressSync,
  onPressQueue,
}: OfflineIndicatorProps) {
  // If online and no queued reports, don't show
  if (!isOffline && queueCount === 0) {
    return null;
  }

  return (
    <View
      style={[
        styles.banner,
        isOffline ? styles.bannerOffline : styles.bannerPendingSync,
      ]}
    >
      <View style={styles.leftRow}>
        <View
          style={[
            styles.iconWrapper,
            isOffline ? styles.iconWrapperOffline : styles.iconWrapperSync,
          ]}
        >
          <Ionicons
            name={isOffline ? 'cloud-offline-outline' : 'cloud-upload-outline'}
            size={18}
            color={isOffline ? Colors.warning : Colors.accent.primary}
          />
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title}>
            {isOffline ? 'Offline Mode Active' : 'Offline Queue Ready'}
          </Text>
          <Text style={styles.subtitle}>
            {queueCount > 0
              ? `${queueCount} ${queueCount === 1 ? 'report' : 'reports'} stored locally awaiting sync.`
              : 'Reports will be stored locally and synced when online.'}
          </Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        {queueCount > 0 && onPressQueue && (
          <TouchableOpacity
            style={styles.actionBtnQueue}
            onPress={onPressQueue}
            activeOpacity={0.7}
          >
            <Text style={styles.actionBtnQueueText}>View</Text>
          </TouchableOpacity>
        )}

        {!isOffline && queueCount > 0 && onPressSync && (
          <TouchableOpacity
            style={styles.actionBtnSync}
            onPress={onPressSync}
            activeOpacity={0.7}
          >
            <Ionicons name="sync" size={12} color="#080C14" />
            <Text style={styles.actionBtnSyncText}>Sync Now</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  bannerOffline: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  bannerPendingSync: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapperOffline: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  iconWrapperSync: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  subtitle: {
    fontSize: FontSize.micro,
    color: Colors.text.secondary,
    marginTop: 1,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  actionBtnQueue: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: BorderRadius.sm,
  },
  actionBtnQueueText: {
    fontSize: FontSize.micro,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  actionBtnSync: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accent.primary,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: BorderRadius.sm,
  },
  actionBtnSyncText: {
    fontSize: FontSize.micro,
    fontWeight: '800',
    color: '#080C14',
  },
});
