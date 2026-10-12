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
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ScreenContainer';
import { CommunityReportCard as ReportCard } from '@/components/CommunityReportCard';
import { ReportDetailView } from '@/components/ReportDetailView';
import { FormModal } from '@/components/FormModal';
import { ReportScreenHero } from '@/components/ReportScreenHero';
import { MobileNavBar } from '@/components/MobileNavBar';
import {
  OfficerColors as Colors,
  OfficerFontSize as FontSize,
  officerScreenStyle,
  officerShellStyle,
} from '@/components/OfficerUi';
import { CommunityReports } from '@/components/CommunityReports';
import { isCommunityRole } from '@/constants/navigation';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { InAppNotificationBanner } from '@/components/InAppNotificationBanner';
import { EmptyState } from '@/components/EmptyState';
import { BorderRadius, Spacing } from '@/constants/colors';
import { getReportPermissions } from '@/constants/reportPermissions';
import { useAuth } from '@/hooks/useAuth';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useReportNotifications } from '@/hooks/useReportNotifications';
import { getMyReports, getPendingReports, getAllReports } from '@/services/groundReportService';
import { getOfflineQueueCount } from '@/services/offlineQueueService';
import { subscribeToSyncProgress, triggerSyncNow } from '@/services/offlineSyncManager';
import type { GroundReport } from '@/types/groundReport';

type OfficerTab = 'pending' | 'info_requested' | 'all';
type CitizenTab = 'verified' | 'my_reports';

const OFFICER_TABS: { key: OfficerTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'pending', label: 'Pending', icon: 'time-outline' },
  { key: 'info_requested', label: 'Needs info', icon: 'help-circle-outline' },
  { key: 'all', label: 'All', icon: 'list-outline' },
];

const CITIZEN_TABS: { key: CitizenTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'verified', label: 'Verified Feed', icon: 'shield-checkmark-outline' },
  { key: 'my_reports', label: 'My Submissions', icon: 'document-text-outline' },
];

export default function ReportListScreen() {
  const { state } = useAuth();
  return isCommunityRole(state.user?.role) ? <CommunityReports /> : <StaffReportListScreen />;
}

function StaffReportListScreen() {
  const { state: authState } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const user = authState.user;

  const permissions = getReportPermissions(user?.role);
  const isOfficer = permissions.canSeeQueue;
  const canSubmit = permissions.canSubmit;
  const isDistrictOfficer = user?.role === 'district_officer';

  const { isOffline } = useNetworkStatus();
  const { notifications, activeNotification, dismissNotification, refreshNotifications } =
    useReportNotifications();

  const [reports, setReports] = useState<GroundReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<OfficerTab>('pending');
  const [citizenTab, setCitizenTab] = useState<CitizenTab>(
    params.tab === 'my_reports' || params.tab === 'my' ? 'my_reports' : 'verified'
  );
  const [offlineCount, setOfflineCount] = useState(0);

  // Sync tab state if query parameter changes
  useEffect(() => {
    if (
      isOfficer &&
      (params.tab === 'pending' || params.tab === 'info_requested' || params.tab === 'all')
    ) {
      setActiveTab(params.tab);
    }
    if (params.tab === 'my_reports' || params.tab === 'my') {
      setCitizenTab('my_reports');
    } else if (params.tab === 'verified') {
      setCitizenTab('verified');
    }
  }, [params.tab, isOfficer]);

  // Detail modal state
  const [selectedReport, setSelectedReport] = useState<GroundReport | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

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
      } else if (isDistrictOfficer) {
        // District Officer (UC02 Phase 7.3): Situational Awareness feed of verified reports
        data = await getAllReports({
          status: 'verified',
          district: user.district || undefined,
        });
        if (data.length === 0) {
          // If no reports in user's specific district, show all verified reports across Sri Lanka
          data = await getAllReports({ status: 'verified' });
        }
      } else if (citizenTab === 'my_reports') {
        data = await getMyReports(user.id);
      } else {
        // Public Verified Feed: ONLY reports officially verified by DMC officers
        data = await getAllReports({ status: 'verified' });
      }
      setReports(data);
    } catch (err) {
      console.warn('Failed to fetch reports:', err);
    }
  }, [user, isOfficer, isDistrictOfficer, activeTab, citizenTab]);

  const fetchOfflineCount = useCallback(async () => {
    try {
      const count = await getOfflineQueueCount();
      setOfflineCount(count);
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([fetchReports(), fetchOfflineCount()]).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [fetchReports, fetchOfflineCount]);

  // Re-poll for updates and unread status notifications when screen gains focus
  useFocusEffect(
    useCallback(() => {
      fetchReports();
      fetchOfflineCount();
      refreshNotifications();
    }, [fetchReports, fetchOfflineCount, refreshNotifications])
  );

  // Subscribe to background synchronization events
  useEffect(() => {
    const unsubscribe = subscribeToSyncProgress(event => {
      if (event.state === 'completed' || event.state === 'syncing') {
        fetchReports();
        fetchOfflineCount();
      }
    });
    return () => unsubscribe();
  }, [fetchReports, fetchOfflineCount]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchReports(), fetchOfflineCount(), refreshNotifications()]);
    setRefreshing(false);
  }, [fetchReports, fetchOfflineCount, refreshNotifications]);

  const handleReportPress = (report: GroundReport) => {
    // If report has an unacknowledged notification, dismiss it as seen
    const matchingNotif = notifications.find(n => n.reportId === report.id);
    if (matchingNotif) {
      dismissNotification(matchingNotif);
    }
    setSelectedReport(report);
    setModalVisible(true);
  };

  const renderReportItem = ({ item }: { item: GroundReport }) => {
    const isNew = !isOfficer && notifications.some(n => n.reportId === item.id);
    return (
      <ReportCard
        report={item}
        onPress={() => handleReportPress(item)}
        showSubmitter={isOfficer || citizenTab === 'verified' || isDistrictOfficer}
        isNew={isNew}
      />
    );
  };

  const headerTitle = isOfficer
    ? 'Verification Queue'
    : isDistrictOfficer
      ? 'District Ground Observations'
      : citizenTab === 'verified'
        ? 'Verified Ground Observations'
        : 'My Ground Reports';

  const headerSubtitle = isOfficer
    ? `${reports.length} report${reports.length !== 1 ? 's' : ''} ${activeTab === 'pending' ? 'awaiting review' : activeTab === 'info_requested' ? 'awaiting more information' : 'in all categories'}`
    : isDistrictOfficer
      ? `${reports.length} verified observation${reports.length !== 1 ? 's' : ''} • Situational Feed`
      : citizenTab === 'verified'
        ? `${reports.length} verified report${reports.length !== 1 ? 's' : ''} • Official Public Feed`
        : `${reports.length} submitted report${reports.length !== 1 ? 's' : ''}`;

  return (
    <ScreenContainer style={officerScreenStyle} contentStyle={officerShellStyle}>
      {/* Header */}
      <ReportScreenHero
        title={headerTitle}
        description={headerSubtitle}
        caption="Ground reports"
        icon="shield-checkmark-outline"
        onBack={() => router.push('/(app)')}
      />

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
      {!isOfficer && (
        <OfflineIndicator
          isOffline={isOffline}
          queueCount={offlineCount}
          onPressSync={async () => {
            await triggerSyncNow();
            await Promise.all([fetchReports(), fetchOfflineCount()]);
          }}
          onPressQueue={() => router.push('/(app)/reports/offline-queue' as never)}
        />
      )}

      {/* Officer Tabs */}
      {isOfficer && (
        <View style={styles.tabBar}>
          {OFFICER_TABS.map(tab => (
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

      {/* Citizen & Volunteer Tabs: Verified Feed vs My Reports */}
      {!isOfficer && !isDistrictOfficer && (
        <View style={styles.tabBar}>
          {CITIZEN_TABS.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabItem, citizenTab === tab.key && styles.tabItemActive]}
              onPress={() => setCitizenTab(tab.key)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={tab.icon}
                size={14}
                color={citizenTab === tab.key ? Colors.accent.primary : Colors.text.tertiary}
              />
              <Text style={[styles.tabLabel, citizenTab === tab.key && styles.tabLabelActive]}>
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
          keyExtractor={item => item.id}
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
              appearance="light"
              iconName="document-text-outline"
              title={
                isOfficer
                  ? 'Queue Clear'
                  : isDistrictOfficer
                    ? 'No Verified Observations'
                    : citizenTab === 'verified'
                      ? 'No Verified Reports'
                      : 'No Reports Yet'
              }
              message={
                isOfficer
                  ? 'No ground reports in this category awaiting verification.'
                  : isDistrictOfficer
                    ? `No verified hazard observations currently recorded for ${user?.district || 'this operational sector'}.`
                    : citizenTab === 'verified'
                      ? 'No ground hazard observations have been officially verified by DMC Duty Officers yet.'
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
      <FormModal
        appearance="light"
        visible={modalVisible}
        title="Report details"
        scrollable={false}
        onClose={() => {
          setModalVisible(false);
          setSelectedReport(null);
          void fetchReports();
        }}
      >
        {selectedReport && (
          <ReportDetailView
            reportId={selectedReport.id}
            embedded
            onClose={() => {
              setModalVisible(false);
              setSelectedReport(null);
              void fetchReports();
            }}
          />
        )}
      </FormModal>
      <MobileNavBar appearance="light" />
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
    backgroundColor: '#DFE7F1',
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
    marginHorizontal: 18,
    marginBottom: Spacing.md,
    backgroundColor: '#FFFFFF',
    marginTop: -20,
    borderWidth: 1,
    borderColor: '#DFE7F1',
    borderRadius: BorderRadius.md,
    padding: 3,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 48,
    flexWrap: 'wrap',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  tabItemActive: {
    backgroundColor: '#EAF2FF',
    borderWidth: 1,
    borderColor: '#BDD5FF',
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
