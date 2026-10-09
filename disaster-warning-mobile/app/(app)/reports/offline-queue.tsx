/**
 * Offline Queue Screen — Local Storage Sync Manager.
 * UC02 Alternate Flow: Offline Capture and Delayed Synchronisation.
 * UC02 Exception Flow: Synchronisation Failure.
 * Allows citizens and volunteers to view locally queued ground hazard reports,
 * monitor network connectivity status, trigger single or batch synchronisation,
 * and review any upload errors while preserving captured incident data.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { ScreenContainer } from '@/components/ScreenContainer';
import { ObservationTypeBadge } from '@/components/ObservationTypeBadge';
import { EmptyState } from '@/components/EmptyState';
import { Colors, BorderRadius, Spacing, FontSize } from '@/constants/colors';
import {
  getQueuedReports,
  syncSingleQueuedReport,
  syncAllQueuedReports,
  removeQueuedReport,
  clearOfflineQueue,
} from '@/services/offlineQueueService';
import type { OfflineReportQueueItem } from '@/types/groundReport';

export default function OfflineQueueScreen() {
  const router = useRouter();

  const [queue, setQueue] = useState<OfflineReportQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingItemId, setSyncingItemId] = useState<string | null>(null);

  // Monitor network connectivity in real-time via hook
  const { isOnline } = useNetworkStatus();

  const loadQueue = useCallback(async () => {
    try {
      const items = await getQueuedReports();
      setQueue(items);
    } catch (err) {
      console.warn('Failed to load offline queue:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const onRefresh = () => {
    setRefreshing(true);
    loadQueue();
  };

  // Sync entire offline queue
  const handleSyncAll = async () => {
    if (queue.length === 0) return;
    if (!isOnline) {
      Alert.alert(
        'No Internet Connection',
        'Device is currently offline. Reconnect to Wi-Fi or cellular network to upload queued reports.',
      );
      return;
    }

    try {
      setSyncingAll(true);
      const summary = await syncAllQueuedReports();
      await loadQueue();

      if (summary.failedCount === 0) {
        Alert.alert(
          'Synchronization Complete',
          `Successfully uploaded and synchronized ${summary.syncedCount} report${summary.syncedCount !== 1 ? 's' : ''}.`,
          [
            {
              text: 'View Reports',
              onPress: () => router.replace('/(app)/reports' as never),
            },
            { text: 'OK' },
          ],
        );
      } else {
        Alert.alert(
          'Partial Synchronization',
          `${summary.syncedCount} succeeded, ${summary.failedCount} failed to upload. Unsynced reports remain safely stored in the queue for retry.`,
        );
      }
    } catch (err) {
      Alert.alert('Sync Error', (err as Error)?.message || 'Failed to sync queued reports.');
    } finally {
      setSyncingAll(false);
    }
  };

  // Sync a single queued item
  const handleSyncSingle = async (item: OfflineReportQueueItem) => {
    if (!isOnline) {
      Alert.alert('Device Offline', 'Please connect to the internet before retrying this report upload.');
      return;
    }

    try {
      setSyncingItemId(item.queueId);
      const res = await syncSingleQueuedReport(item);
      await loadQueue();

      if (res.success) {
        Alert.alert(
          'Report Synced',
          `Reference ID ${res.referenceNumber || 'Generated'} was assigned and sent to verification.`,
        );
      } else {
        Alert.alert(
          'Sync Failed',
          res.error || 'Failed to upload report. The report has been preserved in the queue.',
        );
      }
    } catch (err) {
      Alert.alert('Sync Error', (err as Error)?.message || 'Could not sync report.');
    } finally {
      setSyncingItemId(null);
    }
  };

  // Remove single item with confirmation
  const handleRemoveItem = (queueId: string) => {
    Alert.alert(
      'Discard Report?',
      'Are you sure you want to delete this unsent report? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            await removeQueuedReport(queueId);
            await loadQueue();
          },
        },
      ],
    );
  };

  // Clear all items with confirmation
  const handleClearAll = () => {
    Alert.alert(
      'Clear Offline Queue',
      'Discard all pending offline reports? Any unsent hazard observations will be permanently removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await clearOfflineQueue();
            await loadQueue();
          },
        },
      ],
    );
  };

  const renderQueueItem = ({ item }: { item: OfflineReportQueueItem }) => {
    const isThisItemSyncing = syncingItemId === item.queueId;
    const queuedDate = new Date(item.queuedAt).toLocaleString('en-US', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
    const captureDate = new Date(item.reportData.captureTime).toLocaleString('en-US', {
      dateStyle: 'short',
      timeStyle: 'short',
    });

    return (
      <View style={styles.card}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <ObservationTypeBadge type={item.reportData.observationType} size="sm" />
          <View style={styles.headerRightWrap}>
            {item.syncAttempts > 0 ? (
              <View style={styles.attemptBadge}>
                <Ionicons name="warning-outline" size={12} color={Colors.report.pending} />
                <Text style={styles.attemptBadgeText}>{item.syncAttempts} attempt(s)</Text>
              </View>
            ) : (
              <View style={styles.queuedBadge}>
                <Ionicons name="cloud-offline-outline" size={12} color={Colors.text.muted} />
                <Text style={styles.queuedBadgeText}>Queued</Text>
              </View>
            )}
          </View>
        </View>

        {/* Content Body */}
        <View style={styles.cardBody}>
          {item.localPhotoUri ? (
            <Image
              source={{ uri: item.localPhotoUri }}
              style={styles.thumbnail}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={[styles.thumbnail, styles.noThumbWrap]}>
              <Ionicons name="image-outline" size={24} color={Colors.text.muted} />
            </View>
          )}

          <View style={styles.cardInfo}>
            <View style={styles.locationRow}>
              <Ionicons name="location-sharp" size={14} color={Colors.accent.primary} />
              <Text style={styles.locationText} numberOfLines={1}>
                {item.reportData.locationName}
              </Text>
            </View>
            <Text style={styles.districtText}>
              {item.reportData.district} District • {item.reportData.isManualLocation ? 'Manual' : 'GPS'}
            </Text>
            <Text style={styles.descriptionSnippet} numberOfLines={2}>
              {item.reportData.description}
            </Text>
          </View>
        </View>

        {/* Sync Failure Error Message (if any) */}
        {item.lastSyncError ? (
          <View style={styles.errorAlertBox}>
            <Ionicons name="alert-circle" size={14} color={Colors.status.danger} />
            <Text style={styles.errorAlertText} numberOfLines={2}>
              Last Error: {item.lastSyncError}
            </Text>
          </View>
        ) : null}

        {/* Card Footer Timestamps & Actions */}
        <View style={styles.cardFooter}>
          <View style={styles.timestampWrap}>
            <Text style={styles.timeLabel}>Captured: {captureDate}</Text>
            <Text style={styles.timeLabel}>Queued: {queuedDate}</Text>
          </View>

          <View style={styles.cardActionButtons}>
            <TouchableOpacity
              style={styles.discardButton}
              onPress={() => handleRemoveItem(item.queueId)}
              accessibilityLabel="Discard report"
            >
              <Ionicons name="trash-outline" size={16} color={Colors.status.danger} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.syncItemButton, (!isOnline || isThisItemSyncing) && styles.btnDisabled]}
              onPress={() => handleSyncSingle(item)}
              disabled={!isOnline || isThisItemSyncing}
            >
              {isThisItemSyncing ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={14} color="#FFF" />
                  <Text style={styles.syncItemButtonText}>Sync</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer>
      {/* Top Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerBarTitle}>Offline Queue</Text>
          <Text style={styles.headerBarSubtitle}>
            {queue.length} pending report{queue.length !== 1 ? 's' : ''} stored locally
          </Text>
        </View>
        {queue.length > 0 ? (
          <TouchableOpacity
            style={styles.clearAllBtn}
            onPress={handleClearAll}
            accessibilityLabel="Clear all offline queue"
          >
            <Ionicons name="trash-bin-outline" size={20} color={Colors.text.muted} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Network Connectivity Status Banner */}
      <View
        style={[
          styles.networkBanner,
          isOnline ? styles.networkBannerOnline : styles.networkBannerOffline,
        ]}
      >
        <Ionicons
          name={isOnline ? 'wifi' : 'cloud-offline'}
          size={16}
          color={isOnline ? Colors.status.success : Colors.report.pending}
        />
        <Text
          style={[
            styles.networkBannerText,
            { color: isOnline ? Colors.status.success : Colors.report.pending },
          ]}
        >
          {isOnline
            ? 'Connected to network — Ready to synchronize'
            : 'Device is offline — Observations stored safely on device'}
        </Text>
      </View>

      {/* Sync All Action Dock (when reports exist) */}
      {queue.length > 0 && (
        <View style={styles.syncBar}>
          <TouchableOpacity
            style={[
              styles.syncAllButton,
              (!isOnline || syncingAll) && styles.btnDisabled,
            ]}
            onPress={handleSyncAll}
            disabled={!isOnline || syncingAll}
          >
            {syncingAll ? (
              <>
                <ActivityIndicator size="small" color="#FFF" />
                <Text style={styles.syncAllButtonText}>Synchronizing All Reports...</Text>
              </>
            ) : (
              <>
                <Ionicons name="cloud-upload" size={18} color="#FFF" />
                <Text style={styles.syncAllButtonText}>
                  {isOnline ? `Sync All Now (${queue.length})` : 'Waiting for Internet...'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* List or Empty State */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.accent.primary} />
          <Text style={styles.loadingText}>Checking offline storage...</Text>
        </View>
      ) : (
        <FlatList
          data={queue}
          keyExtractor={(item) => item.queueId}
          renderItem={renderQueueItem}
          contentContainerStyle={[
            styles.listContent,
            queue.length === 0 && styles.emptyListContent,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.accent.primary}
              colors={[Colors.accent.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              iconName="cloud-done-outline"
              title="All Reports Synchronized"
              message="No ground hazard reports are waiting in local offline storage. When you report offline, records will queue here automatically."
              actionTitle="Return to Reports"
              onAction={() => router.replace('/(app)/reports' as never)}
            />
          }
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text.secondary,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.bg.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: Spacing.sm,
  },
  headerBarTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  headerBarSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.text.muted,
  },
  clearAllBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.bg.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  networkBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
  },
  networkBannerOnline: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderBottomColor: 'rgba(16, 185, 129, 0.25)',
  },
  networkBannerOffline: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderBottomColor: 'rgba(245, 158, 11, 0.25)',
  },
  networkBannerText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  syncBar: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.bg.secondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
  },
  syncAllButton: {
    backgroundColor: Colors.accent.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  syncAllButtonText: {
    color: '#FFF',
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl * 2,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  headerRightWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attemptBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  attemptBadgeText: {
    color: Colors.report.pending,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  queuedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.input.bg,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  queuedBadgeText: {
    color: Colors.text.muted,
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  cardBody: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.input.bg,
  },
  noThumbWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  locationText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text.primary,
    flex: 1,
  },
  districtText: {
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    marginBottom: 4,
  },
  descriptionSnippet: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    lineHeight: 16,
  },
  errorAlertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  errorAlertText: {
    fontSize: FontSize.xs,
    color: Colors.status.danger,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border.default,
  },
  timestampWrap: {
    flex: 1,
  },
  timeLabel: {
    fontSize: FontSize.xs - 1,
    color: Colors.text.muted,
  },
  cardActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  discardButton: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncItemButton: {
    backgroundColor: Colors.accent.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: BorderRadius.sm,
  },
  syncItemButtonText: {
    color: '#FFF',
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
});
