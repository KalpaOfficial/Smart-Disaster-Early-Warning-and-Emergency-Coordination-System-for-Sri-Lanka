import { MobileTypography } from '@/constants/colors';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '@/components/ScreenContainer';
import { MobileNavBar } from '@/components/MobileNavBar';
import { FormModal } from '@/components/FormModal';
import { ReportDetailView } from '@/components/ReportDetailView';
import { CommunityReportCard, LIGHT_REPORT_STATUS } from '@/components/CommunityReportCard';
import { LightColors } from '@/constants/colors';
import { useAuth } from '@/hooks/useAuth';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useReportNotifications } from '@/hooks/useReportNotifications';
import { getAllReports, getMyReports } from '@/services/groundReportService';
import { getQueuedReports } from '@/services/offlineQueueService';
import { subscribeToSyncProgress } from '@/services/offlineSyncManager';
import type { GroundReport, ReportNotification, ReportStatus } from '@/types/groundReport';

type Tab = 'my_reports' | 'verified';
type Filter = 'all' | ReportStatus;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending_verification', label: 'Pending' },
  { key: 'info_requested', label: 'Needs info' },
  { key: 'verified', label: 'Verified' },
  { key: 'rejected', label: 'Rejected' },
];

export function CommunityReports() {
  const { state } = useAuth();
  const userId = state.user?.id;
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const insets = useSafeAreaInsets();
  const { isOffline } = useNetworkStatus();
  const { notifications, activeNotification, dismissNotification, refreshNotifications } =
    useReportNotifications();
  const [tab, setTab] = useState<Tab>(params.tab === 'verified' ? 'verified' : 'my_reports');
  const [filter, setFilter] = useState<Filter>('all');
  const [reports, setReports] = useState<GroundReport[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const requestId = useRef(0);
  useEffect(() => {
    if (params.tab === 'verified') {
      setTab('verified');
      setFilter('all');
    } else if (params.tab === 'my_reports' || params.tab === 'my') {
      setTab('my_reports');
      setFilter('all');
    }
  }, [params.tab]);
  const load = useCallback(async () => {
    if (!userId) return;
    const request = ++requestId.current;
    const [reportResult, savedResult] = await Promise.allSettled([
      tab === 'my_reports' ? getMyReports(userId) : getAllReports({ status: 'verified' }),
      getQueuedReports(),
    ]);
    if (request !== requestId.current) return;
    if (reportResult.status === 'fulfilled') {
      setReports(reportResult.value);
      setFailed(false);
    } else setFailed(true);
    if (savedResult.status === 'fulfilled')
      setSavedCount(savedResult.value.filter(r => r.submitterId === userId).length);
    setLoading(false);
  }, [userId, tab]);
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
      void refreshNotifications();
      return () => {
        requestId.current += 1;
      };
    }, [load, refreshNotifications])
  );
  useEffect(
    () =>
      subscribeToSyncProgress(event => {
        if (event.state === 'completed') void load();
      }),
    [load]
  );
  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([load(), refreshNotifications()]);
    } finally {
      setRefreshing(false);
    }
  };
  const dismiss = (notification: ReportNotification) => {
    void dismissNotification(notification).catch(() =>
      setNotificationError('Could not dismiss this update. Please try again.')
    );
  };
  const openReport = (id: string) => {
    const notification = notifications.find(n => n.reportId === id);
    if (notification) dismiss(notification);
    setSelectedReportId(id);
  };
  const closeReport = () => {
    setSelectedReportId(null);
    void load();
    void refreshNotifications();
  };
  const displayed =
    tab === 'my_reports' && filter !== 'all' ? reports.filter(r => r.status === filter) : reports;
  const unreadIds = new Set(notifications.map(n => n.reportId));
  const notificationTheme = activeNotification
    ? LIGHT_REPORT_STATUS[activeNotification.status]
    : null;
  const tabs = [
    { key: 'my_reports' as const, label: 'My reports', icon: 'document-text-outline' as const },
    { key: 'verified' as const, label: 'Verified feed', icon: 'shield-checkmark-outline' as const },
  ];
  return (
    <ScreenContainer style={styles.screen} contentStyle={styles.shell}>
      <StatusBar style="light" />
      <FlatList
        data={loading || failed ? [] : displayed}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <CommunityReportCard
            report={item}
            onPress={() => openReport(item.id)}
            isNew={unreadIds.has(item.id)}
            showSubmitter={tab === 'verified'}
          />
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 164 + insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={LightColors.primary}
            colors={[LightColors.primary]}
          />
        }
        ListHeaderComponent={
          <View>
            <LinearGradient
              colors={['#0855D9', '#1265D9', '#2475D5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.hero}
            >
              <View style={styles.heroCircle} pointerEvents="none" accessible={false} />
              <View style={styles.headerRow}>
                <TouchableOpacity
                  onPress={() => router.push('/(app)')}
                  style={styles.backButton}
                  accessibilityRole="button"
                  accessibilityLabel="Back to Home"
                >
                  <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerCaption}>Community reporting</Text>
                <View style={styles.heroIcon}>
                  <Ionicons name="documents-outline" size={22} color="#FFFFFF" />
                </View>
              </View>
              <Text accessibilityRole="header" style={styles.heroTitle}>
                {tab === 'my_reports' ? 'My ground reports' : 'Community reports'}
              </Text>
              <Text style={styles.heroDescription}>
                {tab === 'my_reports'
                  ? 'Your observations. Every update, in one place.'
                  : 'Verified observations from across Sri Lanka.'}
              </Text>
              <View style={styles.heroMeta}>
                <Ionicons
                  name={tab === 'my_reports' ? 'time-outline' : 'checkmark-circle-outline'}
                  size={14}
                  color="#DCEBFF"
                />
                <Text style={styles.heroMetaText}>
                  {loading
                    ? 'Updating reports...'
                    : failed
                      ? 'Updates temporarily unavailable'
                      : `${reports.length} ${tab === 'my_reports' ? 'submitted' : 'verified'} ${reports.length === 1 ? 'report' : 'reports'}`}
                </Text>
              </View>
            </LinearGradient>
            <View style={styles.tabs}>
              {tabs.map(item => (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.tab, tab === item.key && styles.activeTab]}
                  onPress={() => {
                    setTab(item.key);
                    setFilter('all');
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === item.key }}
                >
                  <Ionicons
                    name={item.icon}
                    size={17}
                    color={tab === item.key ? '#FFFFFF' : LightColors.secondaryText}
                  />
                  <Text style={[styles.tabText, tab === item.key && styles.activeTabText]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.headerBody}>
              {activeNotification && notificationTheme && (
                <View
                  style={[styles.notification, { backgroundColor: notificationTheme.background }]}
                >
                  <TouchableOpacity
                    onPress={() => openReport(activeNotification.reportId)}
                    style={styles.notificationContent}
                    accessibilityRole="button"
                  >
                    <View style={[styles.notificationIcon, { backgroundColor: '#FFFFFF' }]}>
                      <Ionicons
                        name={notificationTheme.icon}
                        size={22}
                        color={notificationTheme.color}
                      />
                    </View>
                    <View style={styles.flex}>
                      <Text style={[styles.notificationLabel, { color: notificationTheme.color }]}>
                        {notificationTheme.label}
                      </Text>
                      <Text style={styles.notificationTitle} numberOfLines={1}>
                        {activeNotification.title}
                      </Text>
                      <Text style={styles.notificationMessage} numberOfLines={2}>
                        {activeNotification.message}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => dismiss(activeNotification)}
                    style={styles.dismissButton}
                    accessibilityRole="button"
                    accessibilityLabel="Dismiss report update"
                  >
                    <Ionicons name="close" size={18} color={LightColors.secondaryText} />
                  </TouchableOpacity>
                </View>
              )}
              {!!notificationError && (
                <Text style={styles.errorText} accessibilityLiveRegion="polite">
                  {notificationError}
                </Text>
              )}
              {isOffline && (
                <View style={styles.offlineNotice}>
                  <Ionicons name="cloud-offline-outline" size={17} color="#946000" />
                  <Text style={styles.offlineText}>
                    You are offline. Report updates may be unavailable.
                  </Text>
                </View>
              )}
              {savedCount > 0 && (
                <TouchableOpacity
                  style={styles.savedNotice}
                  onPress={() => router.push('/(app)/reports/offline-queue')}
                  accessibilityRole="button"
                >
                  <Ionicons name="cloud-upload-outline" size={22} color={LightColors.primary} />
                  <View style={styles.flex}>
                    <Text style={styles.savedTitle}>
                      {savedCount} {savedCount === 1 ? 'report waiting' : 'reports waiting'} to
                      upload
                    </Text>
                    <Text style={styles.savedCaption}>View reports saved on this device</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={17} color={LightColors.primary} />
                </TouchableOpacity>
              )}
              {tab === 'my_reports' && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filters}
                >
                  {FILTERS.map(item => (
                    <TouchableOpacity
                      key={item.key}
                      onPress={() => setFilter(item.key)}
                      style={[styles.filter, filter === item.key && styles.activeFilter]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: filter === item.key }}
                    >
                      <Text
                        style={[styles.filterText, filter === item.key && styles.activeFilterText]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              <View style={styles.listHeading}>
                <Text style={styles.listTitle}>
                  {tab === 'verified'
                    ? 'Verified observations'
                    : filter === 'all'
                      ? 'Your submissions'
                      : FILTERS.find(f => f.key === filter)?.label}
                </Text>
                {!loading && !failed && (
                  <Text style={styles.resultCount}>
                    {displayed.length} {displayed.length === 1 ? 'report' : 'reports'}
                  </Text>
                )}
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            {loading ? (
              <>
                <ActivityIndicator color={LightColors.primary} />
                <Text style={styles.emptyCaption}>Loading your reports...</Text>
              </>
            ) : (
              <>
                <View style={styles.emptyIcon}>
                  <Ionicons
                    name={failed ? 'cloud-offline-outline' : 'document-text-outline'}
                    size={28}
                    color={LightColors.primary}
                  />
                </View>
                <Text style={styles.emptyTitle}>
                  {failed
                    ? 'Could not load reports'
                    : filter !== 'all' && tab === 'my_reports'
                      ? 'No reports in this category'
                      : tab === 'verified'
                        ? 'No verified reports yet'
                        : 'Your first report starts here'}
                </Text>
                <Text style={styles.emptyCaption}>
                  {failed
                    ? 'Check your connection and try again.'
                    : filter !== 'all' && tab === 'my_reports'
                      ? 'Choose All to see your other submissions.'
                      : tab === 'verified'
                        ? 'Reports reviewed and verified by the DMC team will appear here.'
                        : 'Report a hazard with a photo and location to help your community.'}
                </Text>
                {failed && (
                  <TouchableOpacity
                    onPress={refresh}
                    style={styles.retryButton}
                    accessibilityRole="button"
                  >
                    <Text style={styles.retryText}>Try again</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        }
      />
      <TouchableOpacity
        onPress={() => router.push('/(app)/reports/submit')}
        style={[styles.submitButton, { bottom: 90 + insets.bottom }]}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Submit a hazard report"
      >
        <Ionicons name="add" size={22} color="#FFFFFF" />
        <Text style={styles.submitText}>Report a hazard</Text>
      </TouchableOpacity>
      <MobileNavBar appearance="light" />
      <FormModal
        visible={!!selectedReportId}
        onClose={closeReport}
        title="Report details"
        appearance="light"
        scrollable={false}
      >
        {selectedReportId && (
          <ReportDetailView
            key={selectedReportId}
            reportId={selectedReportId}
            embedded
            onClose={closeReport}
          />
        )}
      </FormModal>
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { backgroundColor: '#0855D9' },
  shell: {
    backgroundColor: LightColors.background,
    borderColor: LightColors.border,
    shadowOpacity: 0.06,
  },
  hero: {
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 44,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
  },
  heroCircle: {
    position: 'absolute',
    right: -105,
    top: 40,
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 34,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCaption: { flex: 1, color: '#DCEBFF', ...MobileTypography.caption, fontWeight: '600' },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 29,
    lineHeight: 36,
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  heroDescription: { color: '#E4F0FF', ...MobileTypography.body, marginTop: 8 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 },
  heroMetaText: { color: '#DCEBFF', ...MobileTypography.caption },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 6,
    borderRadius: 18,
    marginTop: -24,
    marginHorizontal: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E7EEF8',
    shadowColor: '#154893',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  tab: {
    flex: 1,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 13,
  },
  activeTab: { backgroundColor: LightColors.primary },
  tabText: {
    color: LightColors.secondaryText,
    ...MobileTypography.caption,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'center',
  },
  activeTabText: { color: '#FFFFFF' },
  headerBody: { paddingHorizontal: 18 },
  notification: { flexDirection: 'row', borderRadius: 18, marginBottom: 14, padding: 12 },
  notificationContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationLabel: { ...MobileTypography.caption, fontWeight: '700', marginBottom: 4 },
  notificationTitle: {
    color: LightColors.text,
    ...MobileTypography.body,
    fontWeight: '700',
    marginBottom: 4,
  },
  notificationMessage: { color: LightColors.secondaryText, ...MobileTypography.body },
  dismissButton: { width: 36, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: LightColors.danger, ...MobileTypography.caption, marginBottom: 12 },
  offlineNotice: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    padding: 12,
    borderRadius: 13,
    backgroundColor: '#FFF2D4',
    marginBottom: 14,
  },
  offlineText: { flex: 1, color: '#946000', ...MobileTypography.caption },
  savedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: LightColors.primarySoft,
    padding: 14,
    borderRadius: 16,
    marginBottom: 14,
  },
  savedTitle: { ...MobileTypography.body, color: LightColors.text, fontWeight: '600' },
  savedCaption: { ...MobileTypography.caption, color: LightColors.secondaryText, marginTop: 4 },
  filters: { gap: 8, paddingBottom: 4 },
  filter: {
    minHeight: 40,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: LightColors.border,
  },
  activeFilter: { borderColor: '#B9D4FF', backgroundColor: LightColors.primarySoft },
  filterText: { color: LightColors.secondaryText, ...MobileTypography.caption, fontWeight: '600' },
  activeFilterText: { color: LightColors.primary },
  listHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 18,
    marginBottom: 12,
  },
  listTitle: {
    color: LightColors.text,
    ...MobileTypography.section,
    fontWeight: '700',
    flexShrink: 1,
  },
  resultCount: { color: LightColors.mutedText, ...MobileTypography.caption },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 18,
    padding: 30,
    borderWidth: 1,
    borderColor: LightColors.border,
    borderRadius: 20,
    alignItems: 'center',
    gap: 12,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: LightColors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: LightColors.text,
    ...MobileTypography.section,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyCaption: {
    color: LightColors.secondaryText,
    ...MobileTypography.caption,

    textAlign: 'center',
  },
  retryButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 18 },
  retryText: { color: LightColors.primary, fontWeight: '600', ...MobileTypography.button },
  submitButton: {
    position: 'absolute',
    right: 20,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: LightColors.primary,
    shadowColor: LightColors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
    elevation: 5,
  },
  submitText: { color: '#FFFFFF', ...MobileTypography.button, fontWeight: '700' },
});
