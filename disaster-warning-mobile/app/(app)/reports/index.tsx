/**
 * Report List Screen — Role-Aware Ground Report Queue.
 * UC02 Main Flow: Citizens see "My Ground Reports"; DMC Officers see "Verification Queue".
 * Supports pull-to-refresh, offline indicator, status filtering (officer), and FAB for submit.
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
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ScreenContainer';
import { ReportCard } from '@/components/ReportCard';
import { ReportDetailModal } from '@/components/ReportDetailModal';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { InAppNotificationBanner } from '@/components/InAppNotificationBanner';
import { EmptyState } from '@/components/EmptyState';
import { Colors, BorderRadius, Spacing, FontSize } from '@/constants/colors';
import { useAuth } from '@/hooks/useAuth';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useReportNotifications } from '@/hooks/useReportNotifications';
import {
  getMyReports,
  getPendingReports,
  getAllReports,
  verifyReport,
  rejectReport,
  requestAdditionalInfo,
  submitAdditionalInfo,
} from '@/services/groundReportService';
import { getActiveEvents } from '@/services/hazardEventService';
import { getOfflineQueueCount } from '@/services/offlineQueueService';
import {
  subscribeToSyncProgress,
  triggerSyncNow,
} from '@/services/offlineSyncManager';
import type { GroundReport, ReportStatus } from '@/types/groundReport';
import type { HazardEvent } from '@/types/resources';

type OfficerTab = 'pending' | 'info_requested' | 'all';

const OFFICER_TABS: { key: OfficerTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'pending', label: 'Pending', icon: 'time-outline' },
  { key: 'info_requested', label: 'Info Req.', icon: 'help-circle-outline' },
  { key: 'all', label: 'All', icon: 'list-outline' },
];

export default function ReportListScreen() {
  const { state: authState } = useAuth();
  const router = useRouter();
  const user = authState.user;

  const isOfficer = user?.role === 'dmc_officer';
  const canSubmit = user?.role === 'citizen' || user?.role === 'volunteer';

  const { isOffline } = useNetworkStatus();
  const {
    activeNotification,
    dismissNotification,
    refreshNotifications,
  } = useReportNotifications();

  const [reports, setReports] = useState<GroundReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<OfficerTab>('pending');
  const [offlineCount, setOfflineCount] = useState(0);

  // Detail modal state
  const [selectedReport, setSelectedReport] = useState<GroundReport | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [activeEvents, setActiveEvents] = useState<HazardEvent[]>([]);

  const fetchReports = useCallback(async () => {
    if (!user) return;
    try {
      let data: GroundReport[];
      if (isOfficer) {
        if (activeTab === 'pending') {
          data = await getPendingReports();
        } else if (activeTab === 'info_requested') {
          data = await getAllReports({ status: 'info_requested' });
        } else {
          data = await getAllReports();
        }
      } else {
        data = await getMyReports(user.id);
      }
      setReports(data);
    } catch (err) {
      console.warn('Failed to fetch reports:', err);
    }
  }, [user, isOfficer, activeTab]);

  const fetchOfflineCount = useCallback(async () => {
    try {
      const count = await getOfflineQueueCount();
      setOfflineCount(count);
    } catch {
      // non-fatal
    }
  }, []);

  const fetchActiveEvents = useCallback(async () => {
    try {
      const events = await getActiveEvents();
      setActiveEvents(events);
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([fetchReports(), fetchOfflineCount(), fetchActiveEvents()])
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [fetchReports, fetchOfflineCount, fetchActiveEvents]);

  // Subscribe to background synchronization events
  useEffect(() => {
    const unsubscribe = subscribeToSyncProgress((event) => {
      if (event.state === 'completed' || event.state === 'syncing') {
        fetchReports();
        fetchOfflineCount();
      }
    });
    return () => unsubscribe();
  }, [fetchReports, fetchOfflineCount]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchReports(),
      fetchOfflineCount(),
      fetchActiveEvents(),
      refreshNotifications(),
    ]);
    setRefreshing(false);
  }, [fetchReports, fetchOfflineCount, fetchActiveEvents, refreshNotifications]);

  const handleReportPress = (report: GroundReport) => {
    setSelectedReport(report);
    setModalVisible(true);
  };

  const handleVerify = async (
    reportId: string,
    hazardEventId?: string | null,
    hazardEventTitle?: string | null,
    decisionNote?: string,
  ) => {
    if (!user) return;
    await verifyReport(reportId, { uid: user.id, name: user.fullName }, {
      hazardEventId,
      hazardEventTitle,
      decisionNote,
    });
    await fetchReports();
  };

  const handleReject = async (reportId: string, reason: string) => {
    if (!user) return;
    await rejectReport(reportId, { uid: user.id, name: user.fullName }, reason);
    await fetchReports();
  };

  const handleRequestInfo = async (reportId: string, message: string) => {
    if (!user) return;
    await requestAdditionalInfo(reportId, { uid: user.id, name: user.fullName }, message);
    await fetchReports();
  };

  const handleSubmitAdditionalInfo = async (reportId: string, text: string) => {
    await submitAdditionalInfo(reportId, text);
    await fetchReports();
  };

  const renderReportItem = ({ item }: { item: GroundReport }) => (
    <ReportCard
      report={item}
      onPress={() => handleReportPress(item)}
      showSubmitter={isOfficer}
    />
  );

  const headerTitle = isOfficer ? 'Verification Queue' : 'My Ground Reports';
  const headerSubtitle = isOfficer
    ? `${reports.length} report${reports.length !== 1 ? 's' : ''} awaiting review`
    : `${reports.length} submitted report${reports.length !== 1 ? 's' : ''}`;

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.push('/(app)')}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={20} color={Colors.text.secondary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          <Text style={styles.headerSubtitle}>{headerSubtitle}</Text>
        </View>
      </View>

      {/* In-App Status Notification Feedback Banner */}
      {activeNotification && !isOfficer && (
        <InAppNotificationBanner
          notification={activeNotification}
          onPress={() => {
            router.push(`/(app)/reports/${activeNotification.reportId}` as never);
            dismissNotification(activeNotification);
          }}
          onDismiss={() => dismissNotification(activeNotification)}
        />
      )}

      {/* Offline Indicator */}
      <OfflineIndicator
        isOffline={isOffline}
        queueCount={offlineCount}
        onPressSync={async () => {
          await triggerSyncNow();
          await Promise.all([fetchReports(), fetchOfflineCount()]);
        }}
        onPressQueue={() => router.push('/(app)/reports/offline-queue' as never)}
      />

      {/* Officer Tabs */}
      {isOfficer && (
        <View style={styles.tabBar}>
          {OFFICER_TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={tab.icon}
                size={14}
                color={activeTab === tab.key ? Colors.accent.primary : Colors.text.tertiary}
              />
              <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.accent.primary} />
          <Text style={styles.loadingText}>Loading reports…</Text>
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          renderItem={renderReportItem}
          contentContainerStyle={[
            styles.listContent,
            reports.length === 0 && styles.emptyListContent,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.accent.primary}
              colors={[Colors.accent.primary]}
              progressBackgroundColor={Colors.bg.secondary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              iconName="document-text-outline"
              title={isOfficer ? 'Queue Clear' : 'No Reports Yet'}
              message={
                isOfficer
                  ? 'No ground reports in this category awaiting verification.'
                  : 'Submit your first ground hazard observation to help the Disaster Management Centre respond faster.'
              }
            />
          }
        />
      )}

      {/* FAB for Citizens / Volunteers */}
      {canSubmit && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/(app)/reports/submit' as never)}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={24} color="#080C14" />
          <Text style={styles.fabText}>Submit Report</Text>
        </TouchableOpacity>
      )}

      {/* Report Detail Modal */}
      <ReportDetailModal
        visible={modalVisible}
        report={selectedReport}
        onClose={() => {
          setModalVisible(false);
          setSelectedReport(null);
        }}
        onOpenFullScreen={(id) => {
          setModalVisible(false);
          setSelectedReport(null);
          router.push(`/(app)/reports/${id}` as never);
        }}
        isOfficer={isOfficer}
        activeEvents={activeEvents}
        onVerify={handleVerify}
        onReject={handleReject}
        onRequestInfo={handleRequestInfo}
        onSubmitAdditionalInfo={handleSubmitAdditionalInfo}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text.primary,
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: BorderRadius.md,
    padding: 3,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  tabItemActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  tabLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.text.tertiary,
  },
  tabLabelActive: {
    color: Colors.accent.primary,
    fontWeight: '700',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: FontSize.sm,
    color: Colors.text.tertiary,
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 120,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 80,
    right: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accent.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xxl,
    shadowColor: Colors.accent.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  fabText: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    color: '#080C14',
  },
});
