import { AppAlert } from '@/utils/appNotice';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { ScreenContainer } from '@/components/ScreenContainer';
import { ObservationTypeBadge } from '@/components/ObservationTypeBadge';
import { ReportScreenHero } from '@/components/ReportScreenHero';
import { EmptyState } from '@/components/EmptyState';
import { LightColors, MobileTypography, BorderRadius, Spacing } from '@/constants/colors';
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
      AppAlert.alert(
        'No Internet Connection',
        'Device is currently offline. Reconnect to Wi-Fi or cellular network to upload queued reports.'
      );
      return;
    }

    try {
      setSyncingAll(true);
      const summary = await syncAllQueuedReports();
      await loadQueue();

      if (summary.failedCount === 0) {
        AppAlert.alert(
          'Synchronization Complete',
          `Successfully uploaded and synchronized ${summary.syncedCount} report${summary.syncedCount !== 1 ? 's' : ''}.`,
          [
            {
              text: 'View Reports',
              onPress: () => router.replace('/(app)/reports' as never),
            },
            { text: 'OK' },
          ]
        );
      } else {
        AppAlert.alert(
          'Partial Synchronization',
          `${summary.syncedCount} succeeded, ${summary.failedCount} failed to upload. Unsynced reports remain safely stored in the queue for retry.`
        );
      }
    } catch (err) {
      AppAlert.alert('Sync Error', (err as Error)?.message || 'Failed to sync queued reports.');
    } finally {
      setSyncingAll(false);
    }
  };

  // Sync a single queued item
  const handleSyncSingle = async (item: OfflineReportQueueItem) => {
    if (!isOnline) {
      AppAlert.alert(
        'Device Offline',
        'Please connect to the internet before retrying this report upload.'
      );
      return;
    }

    try {
      setSyncingItemId(item.queueId);
      const res = await syncSingleQueuedReport(item);
      await loadQueue();

      if (res.success) {
        AppAlert.alert(
          'Report Synced',
          `Reference ID ${res.referenceNumber || 'Generated'} was assigned and sent to verification.`
        );
      } else {
        AppAlert.alert(
          'Sync Failed',
          res.error || 'Failed to upload report. The report has been preserved in the queue.'
        );
      }
    } catch (err) {
      AppAlert.alert('Sync Error', (err as Error)?.message || 'Could not sync report.');
    } finally {
      setSyncingItemId(null);
    }
  };

  // Remove single item with confirmation
  const handleRemoveItem = (queueId: string) => {
    AppAlert.alert(
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
      ]
    );
  };

  // Clear all items with confirmation
  const handleClearAll = () => {
    AppAlert.alert(
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
      ]
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
          <ObservationTypeBadge
            appearance="light"
            type={item.reportData.observationType}
            size="sm"
          />
          <View style={styles.headerRightWrap}>
            {item.syncAttempts > 0 ? (
              <View style={styles.attemptBadge}>
                <Ionicons name="warning-outline" size={12} color={'#946000'} />
                <Text style={styles.attemptBadgeText}>{item.syncAttempts} attempt(s)</Text>
              </View>
            ) : (
              <View style={styles.queuedBadge}>
                <Ionicons name="cloud-offline-outline" size={12} color={LightColors.mutedText} />
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
              <Ionicons name="image-outline" size={24} color={LightColors.mutedText} />
            </View>
          )}

          <View style={styles.cardInfo}>
            <View style={styles.locationRow}>
              <Ionicons name="location-sharp" size={14} color={LightColors.primary} />
              <Text style={styles.locationText} numberOfLines={2}>
                {item.reportData.locationName}
              </Text>
            </View>
            <Text style={styles.districtText}>
              {item.reportData.district} District •{' '}
              {item.reportData.isManualLocation ? 'Manual' : 'GPS'}
            </Text>
            <Text style={styles.descriptionSnippet} numberOfLines={2}>
              {item.reportData.description}
            </Text>
          </View>
        </View>

        {/* Sync Failure Error Message (if any) */}
        {item.lastSyncError ? (
          <View style={styles.errorAlertBox}>
            <Ionicons name="alert-circle" size={14} color={LightColors.danger} />
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
              accessibilityRole="button"
              style={styles.discardButton}
              onPress={() => handleRemoveItem(item.queueId)}
              accessibilityLabel="Discard report"
            >
              <Ionicons name="trash-outline" size={16} color={LightColors.danger} />
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              style={[
                styles.syncItemButton,
                (!isOnline || isThisItemSyncing) && styles.btnDisabled,
              ]}
              onPress={() => handleSyncSingle(item)}
              disabled={!isOnline || isThisItemSyncing}
            >
              {isThisItemSyncing ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={14} color="#FFF" />
                  <Text style={styles.syncItemButtonText}>Send</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer style={styles.screen} contentStyle={styles.shell}>
      {/* The hero and cards share one scrolling list, matching the shelter directory. */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={LightColors.primary} />
          <Text style={styles.loadingText}>Checking offline storage...</Text>
        </View>
      ) : (
        <FlatList
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              <ReportScreenHero
                title="Saved reports"
                caption="Community reports"
                description="Keep track of reports saved on your device and send them when you’re back online."
                icon="cloud-upload-outline"
                onBack={() => router.back()}
                action={
                  queue.length
                    ? {
                        label: 'Clear all offline queue',
                        icon: 'trash-bin-outline',
                        onPress: handleClearAll,
                      }
                    : undefined
                }
              />
              <View style={styles.statusPanel}>
                <Text style={styles.panelTitle}>
                  {queue.length} {queue.length === 1 ? 'report' : 'reports'} waiting to upload
                </Text>
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
                    color={isOnline ? '#07834B' : '#946000'}
                  />
                  <Text
                    style={[styles.networkBannerText, { color: isOnline ? '#07834B' : '#946000' }]}
                  >
                    {isOnline
                      ? 'You’re online. Saved reports are ready to send.'
                      : 'You’re offline. Your reports are saved on this device.'}
                  </Text>
                </View>
              </View>
              {/* Sync All Action Dock (when reports exist) */}
              {queue.length > 0 && (
                <View style={styles.syncBar}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={[styles.syncAllButton, (!isOnline || syncingAll) && styles.btnDisabled]}
                    onPress={handleSyncAll}
                    disabled={!isOnline || syncingAll}
                  >
                    {syncingAll ? (
                      <>
                        <ActivityIndicator size="small" color="#FFF" />
                        <Text style={styles.syncAllButtonText}>Sending saved reports...</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="cloud-upload" size={18} color="#FFF" />
                        <Text style={styles.syncAllButtonText}>
                          {isOnline
                            ? `Send all reports (${queue.length})`
                            : 'Connect to send reports'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {queue.length > 0 && (
                <View style={styles.listHeading}>
                  <Text style={styles.directoryTitle}>Reports on this device</Text>
                  <Text style={styles.directoryCount}>{queue.length} saved</Text>
                </View>
              )}
            </View>
          }
          data={queue}
          keyExtractor={item => item.queueId}
          renderItem={renderQueueItem}
          contentContainerStyle={[
            styles.listContent,
            queue.length === 0 && styles.emptyListContent,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={LightColors.primary}
              colors={[LightColors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              appearance="light"
              iconName="cloud-done-outline"
              title="You’re all caught up"
              message="No reports are waiting to upload. Reports you save offline will appear here until you reconnect."
              actionTitle="Back to my reports"
              onAction={() => router.replace('/(app)/reports' as never)}
            />
          }
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  statusPanel: {
    marginHorizontal: 18,
    marginTop: -24,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderWidth: 1,
    borderColor: LightColors.border,
    shadowColor: '#154893',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
    marginBottom: 18,
  },
  panelTitle: {
    ...MobileTypography.label,
    color: LightColors.text,
    fontWeight: '700',
    marginBottom: 12,
  },
  listHeading: {
    marginHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 16,
    marginBottom: 12,
  },
  directoryTitle: {
    ...MobileTypography.section,
    flexShrink: 1,
    fontWeight: '700',
    color: LightColors.text,
  },
  directoryCount: { ...MobileTypography.caption, color: LightColors.secondaryText },
  screen: { backgroundColor: '#0855D9' },
  shell: {
    backgroundColor: LightColors.background,
    borderColor: LightColors.border,
    shadowOpacity: 0,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    marginTop: Spacing.md,
    ...MobileTypography.body,
    color: LightColors.secondaryText,
  },
  headerBar: {
    backgroundColor: LightColors.primary,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: LightColors.border,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.16)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: Spacing.sm,
  },
  headerBarTitle: {
    ...MobileTypography.section,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerBarSubtitle: {
    ...MobileTypography.caption,
    color: '#E0ECFF',
    textAlign: 'center',
  },
  clearAllBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.16)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  networkBanner: {
    marginHorizontal: 0,
    marginTop: 0,
    borderRadius: 14,
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
  networkBannerText: { flex: 1, ...MobileTypography.caption, fontWeight: '600' },
  syncBar: {
    paddingHorizontal: 18,
    paddingVertical: Spacing.md,
    backgroundColor: LightColors.background,
    borderBottomWidth: 0,
    borderBottomColor: LightColors.border,
  },
  syncAllButton: {
    minHeight: 50,
    backgroundColor: LightColors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  syncAllButtonText: {
    color: '#FFF',
    ...MobileTypography.body,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  listContent: {
    paddingBottom: Spacing.xl * 2,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  card: {
    marginHorizontal: 18,
    backgroundColor: LightColors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: LightColors.border,
    padding: 16,
    marginBottom: 13,
  },
  cardHeader: {
    flexWrap: 'wrap',
    gap: 8,
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
    color: '#946000',
    ...MobileTypography.caption,
    fontWeight: '600',
  },
  queuedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: LightColors.surfaceMuted,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  queuedBadgeText: {
    color: LightColors.mutedText,
    ...MobileTypography.caption,
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
    backgroundColor: LightColors.surfaceMuted,
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
    ...MobileTypography.label,
    fontWeight: '700',
    color: LightColors.text,
    flex: 1,
  },
  districtText: {
    ...MobileTypography.caption,
    color: LightColors.mutedText,
    marginBottom: 4,
  },
  descriptionSnippet: {
    ...MobileTypography.caption,
    color: LightColors.secondaryText,
    lineHeight: 22,
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
    ...MobileTypography.caption,
    color: LightColors.danger,
    flex: 1,
  },
  cardFooter: {
    flexWrap: 'wrap',
    gap: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: LightColors.border,
  },
  timestampWrap: { minWidth: 160, flex: 1 },
  timeLabel: {
    ...MobileTypography.small,
    color: LightColors.mutedText,
  },
  cardActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  discardButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncItemButton: {
    minHeight: 44,
    backgroundColor: LightColors.primary,
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
    ...MobileTypography.caption,
    fontWeight: '700',
  },
});
