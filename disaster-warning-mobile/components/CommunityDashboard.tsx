import { MobileTypography } from '@/constants/colors';
/** Citizen and volunteer home: local warnings, reporting and shelter access. */
import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '@/components/ScreenContainer';
import { MobileNavBar } from '@/components/MobileNavBar';
import { useAuth } from '@/hooks/useAuth';
import { useLogoutConfirmation } from '@/components/LogoutConfirmation';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { LightColors } from '@/constants/colors';
import { getActiveWarnings } from '@/services/warningService';
import { getActiveEvents } from '@/services/hazardEventService';
import { getShelters } from '@/services/shelterService';
import { getMyReports } from '@/services/groundReportService';
import { getQueuedReports } from '@/services/offlineQueueService';
import { getCommunityWarnings, getAvailableCommunityShelters } from '@/utils/communityDashboard';
import type { HazardWarning } from '@/types/warning';
import type { GroundReport, ReportStatus } from '@/types/groundReport';

type LoadState = 'loading' | 'ready' | 'error';
const reportStatus: Record<ReportStatus, { label: string; color: string; background: string }> = {
  pending_verification: { label: 'Pending', color: '#996100', background: '#FFF4CF' },
  verified: { label: 'Verified', color: '#07834B', background: '#E8F8EF' },
  rejected: { label: 'Rejected', color: LightColors.danger, background: LightColors.dangerSoft },
  info_requested: {
    label: 'Info requested',
    color: LightColors.primary,
    background: LightColors.primarySoft,
  },
};
const observationLabel = {
  rising_water: 'Rising water',
  blocked_road: 'Blocked road',
  landslide_crack: 'Landslide crack',
  other: 'Hazard observation',
};
const severityStyle = {
  evacuation: {
    label: 'Evacuation alert',
    color: '#C52D3E',
    background: '#FFF4F4',
    border: '#F7D7DD',
    badge: '#FCE3E8',
  },
  warning: {
    label: 'Warning',
    color: '#946000',
    background: '#FFFBF0',
    border: '#F3E4B9',
    badge: '#FFF0C5',
  },
  advisory: {
    label: 'Advisory',
    color: LightColors.primary,
    background: '#F0F6FF',
    border: '#D3E3FC',
    badge: '#E0EDFF',
  },
};

export function CommunityDashboard() {
  const { state } = useAuth();
  const handleLogout = useLogoutConfirmation();
  const user = state.user;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isOffline } = useNetworkStatus();
  const [warnings, setWarnings] = useState<HazardWarning[]>([]);
  const [warningState, setWarningState] = useState<LoadState>('loading');
  const [reports, setReports] = useState<GroundReport[]>([]);
  const [reportState, setReportState] = useState<LoadState>('loading');
  const [shelterCount, setShelterCount] = useState<number | null>(null);
  const [queuedCount, setQueuedCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);

  const loadDashboard = useCallback(async () => {
    if (!user?.id) return;
    const request = ++requestId.current;
    const results = await Promise.allSettled([
      Promise.all([getActiveWarnings({ throwOnError: true }), getActiveEvents()]),
      getMyReports(user.id),
      getShelters(),
      getQueuedReports(),
    ]);
    if (request !== requestId.current) return;
    const [warningResult, reportResult, shelterResult, queueResult] = results;
    if (warningResult.status === 'fulfilled') {
      setWarnings(
        getCommunityWarnings(warningResult.value[0], warningResult.value[1], user.district)
      );
      setWarningState('ready');
    } else setWarningState('error');
    if (reportResult.status === 'fulfilled') {
      setReports(reportResult.value);
      setReportState('ready');
    } else setReportState('error');
    setShelterCount(
      shelterResult.status === 'fulfilled'
        ? getAvailableCommunityShelters(shelterResult.value, user.district).length
        : null
    );
    setQueuedCount(
      queueResult.status === 'fulfilled'
        ? queueResult.value.filter(r => r.submitterId === user.id).length
        : 0
    );
  }, [user?.id, user?.district]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
      return () => {
        requestId.current += 1;
      };
    }, [loadDashboard])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadDashboard();
    } finally {
      setRefreshing(false);
    }
  };
  const myReports = () =>
    router.push({ pathname: '/(app)/reports', params: { tab: 'my_reports' } });

  const topWarning = warningState === 'ready' ? warnings[0] : undefined;
  const warningTheme = topWarning ? severityStyle[topWarning.severity] : null;
  const firstName = user?.fullName?.trim().split(/\s+/)[0] || 'there';
  const firstInfoRequest =
    reportState === 'ready' ? reports.find(r => r.status === 'info_requested') : undefined;
  const openReport = (report: GroundReport) =>
    router.push({ pathname: '/(app)/reports/[reportId]', params: { reportId: report.id } });

  return (
    <ScreenContainer style={styles.screen} contentStyle={styles.shell}>
      <StatusBar style="light" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: 100 + insets.bottom }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={LightColors.primary}
            colors={[LightColors.primary]}
          />
        }
      >
        <LinearGradient
          colors={['#0855D9', '#1265D9', '#2475D5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View pointerEvents="none" accessible={false} style={styles.heroCircle} />
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Ionicons name="shield-checkmark" size={22} color="#FFFFFF" />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.brandName}>DisasterGuard</Text>
              <Text style={styles.brandCaption}>
                {user?.role === 'volunteer' ? 'Volunteer community' : 'Your community companion'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/(app)/warnings')}
              style={styles.heroButton}
              accessibilityRole="button"
              accessibilityLabel="View official warnings"
            >
              <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
              {warningState === 'ready' && warnings.length > 0 && (
                <View style={styles.notificationDot} />
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.header}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.fullName?.trim().charAt(0).toUpperCase() || 'D'}
              </Text>
            </View>
            <View style={styles.headerText}>
              <Text style={styles.greeting}>Hello, {firstName}</Text>
              <View style={styles.identityRow}>
                <Text style={styles.identityText}>
                  {user?.role === 'volunteer' ? 'Community volunteer' : 'Citizen'}
                </Text>
                {user?.district ? (
                  <>
                    <Text style={styles.identityDot}>/</Text>
                    <Ionicons name="location-outline" size={13} color="#DCEBFF" />
                    <Text style={styles.identityText}>{user.district}</Text>
                  </>
                ) : null}
              </View>
            </View>
            <TouchableOpacity
              style={styles.logout}
              onPress={handleLogout}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={21} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.heroDescription}>Stay informed. Look out for each other.</Text>
        </LinearGradient>
        <View style={styles.summaryGrid}>
          {[
            {
              label: 'Pending reports',
              value:
                reportState === 'ready'
                  ? reports.filter(r => r.status === 'pending_verification').length
                  : null,
              icon: 'time-outline' as const,
              color: '#BD7B10',
              background: '#FFF2D8',
              action: myReports,
            },
            {
              label: 'Verified reports',
              value:
                reportState === 'ready'
                  ? reports.filter(r => r.status === 'verified').length
                  : null,
              icon: 'checkmark-circle-outline' as const,
              color: '#0C9B63',
              background: '#E1F7EC',
              action: myReports,
            },
            {
              label: 'Local warnings',
              value: warningState === 'ready' ? warnings.length : null,
              icon: 'notifications-outline' as const,
              color: '#0066FF',
              background: '#EAF2FF',
              action: () => router.push('/(app)/warnings'),
            },
            {
              label: 'Open shelters',
              value: shelterCount,
              icon: 'home-outline' as const,
              color: '#7655CF',
              background: '#F0EAFE',
              action: () => router.push('/(app)/resources/shelters'),
            },
          ].map(item => (
            <TouchableOpacity
              key={item.label}
              style={styles.summaryCard}
              onPress={item.action}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`${item.label}: ${item.value ?? 'unavailable'}`}
            >
              <View style={styles.summaryTop}>
                <View style={[styles.summaryIcon, { backgroundColor: item.background }]}>
                  <Ionicons name={item.icon} size={20} color={item.color} />
                </View>
                <Text style={styles.summaryValue}>{item.value ?? '--'}</Text>
              </View>
              <Text style={styles.summaryLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.dashboardBody}>
          {isOffline && (
            <View style={styles.offlineNotice}>
              <Ionicons name="cloud-offline-outline" size={18} color="#946000" />
              <Text style={styles.offlineText}>
                You&apos;re offline. Updates may be unavailable.
              </Text>
            </View>
          )}

          <View style={styles.sectionHeading}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              {user?.district ? 'Local warnings' : 'Latest warnings'}
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(app)/warnings')}
              style={styles.textLink}
              accessibilityRole="link"
            >
              <Text style={styles.linkText}>View all</Text>
              <Ionicons name="chevron-forward" size={14} color={LightColors.primary} />
            </TouchableOpacity>
          </View>
          <View
            style={[
              styles.warningCard,
              warningTheme && {
                backgroundColor: warningTheme.background,
                borderColor: warningTheme.border,
              },
            ]}
          >
            {warningState === 'loading' ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={LightColors.primary} />
                <Text style={styles.secondaryText}>Checking the latest warnings...</Text>
              </View>
            ) : warningState === 'error' ? (
              <>
                <View style={styles.noticeHeading}>
                  <Ionicons
                    name="cloud-offline-outline"
                    size={23}
                    color={LightColors.secondaryText}
                  />
                  <Text style={styles.cardTitle}>Warnings unavailable</Text>
                </View>
                <Text style={styles.cardDescription}>
                  We couldn&apos;t refresh the latest warnings. Check your connection and try again.
                </Text>
                <TouchableOpacity
                  onPress={onRefresh}
                  disabled={refreshing}
                  style={styles.textLink}
                  accessibilityRole="button"
                >
                  <Text style={styles.linkText}>Try again</Text>
                </TouchableOpacity>
              </>
            ) : topWarning && warningTheme ? (
              <>
                <View style={styles.warningMeta}>
                  <View style={[styles.warningBadge, { backgroundColor: warningTheme.badge }]}>
                    <Ionicons name="warning" size={13} color={warningTheme.color} />
                    <Text style={[styles.warningBadgeText, { color: warningTheme.color }]}>
                      {warningTheme.label}
                    </Text>
                  </View>
                  <Text style={styles.warningType}>
                    {topWarning.hazardType.charAt(0).toUpperCase() + topWarning.hazardType.slice(1)}
                  </Text>
                </View>
                <Text style={styles.warningTitle} numberOfLines={3}>
                  {topWarning.headline}
                </Text>
                <Text style={styles.cardDescription} numberOfLines={3}>
                  {topWarning.instructions}
                </Text>
                <View style={styles.warningFooter}>
                  <View style={styles.location}>
                    <Ionicons name="location-outline" size={14} color={LightColors.secondaryText} />
                    <Text style={styles.locationText} numberOfLines={1}>
                      {user?.district || topWarning.targetAreas.join(', ')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() =>
                      router.push({
                        pathname: '/(app)/warnings/[eventId]',
                        params: { eventId: topWarning.eventId || topWarning.hazardEventId || '' },
                      })
                    }
                    style={styles.textLink}
                    accessibilityRole="link"
                  >
                    <Text style={styles.linkText}>View details</Text>
                    <Ionicons name="arrow-forward" size={15} color={LightColors.primary} />
                  </TouchableOpacity>
                </View>
                {warnings.length > 1 && (
                  <Text style={styles.moreWarnings}>
                    {warnings.length - 1} more {warnings.length === 2 ? 'warning' : 'warnings'}{' '}
                    {user?.district ? 'for your district' : 'listed'}
                  </Text>
                )}
              </>
            ) : (
              <>
                <View style={styles.noticeHeading}>
                  <View style={styles.noticeIcon}>
                    <Ionicons name="notifications-outline" size={22} color={LightColors.primary} />
                  </View>
                  <Text style={styles.cardTitle}>No current warnings listed</Text>
                </View>
                <Text style={styles.cardDescription}>
                  {user?.district
                    ? 'No active warnings are listed for ' +
                      user.district +
                      '. Continue checking official updates.'
                    : 'Check the warnings page for the latest official updates.'}
                </Text>
              </>
            )}
          </View>

          <Text accessibilityRole="header" style={styles.actionHeading}>
            Quick actions
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(app)/reports/submit')}
            activeOpacity={0.85}
            style={styles.reportAction}
            accessibilityRole="button"
            accessibilityLabel="Report a hazard"
          >
            <View style={styles.reportIcon}>
              <Ionicons name="camera-outline" size={27} color="#FFFFFF" />
            </View>
            <View style={styles.actionCopy}>
              <Text style={styles.reportActionTitle}>Report a hazard</Text>
              <Text style={styles.reportActionDescription}>
                Share a photo and location of what you see.
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.quickLinks}>
            <TouchableOpacity
              onPress={myReports}
              activeOpacity={0.7}
              style={styles.quickRow}
              accessibilityRole="button"
              accessibilityLabel="View my reports"
            >
              <View style={styles.quickIcon}>
                <Ionicons name="document-text-outline" size={22} color={LightColors.primary} />
              </View>
              <View style={styles.actionCopy}>
                <Text style={styles.quickTitle}>My reports</Text>
                <Text style={styles.quickDescription}>Track your submissions and updates</Text>
              </View>
              {reportState === 'ready' && (
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{reports.length}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={17} color={LightColors.mutedText} />
            </TouchableOpacity>
            <View style={styles.rowDivider} />
            <TouchableOpacity
              onPress={() => router.push('/(app)/resources/shelters')}
              activeOpacity={0.7}
              style={styles.quickRow}
              accessibilityRole="button"
              accessibilityLabel="Find a shelter"
            >
              <View style={[styles.quickIcon, styles.shelterIcon]}>
                <Ionicons name="home-outline" size={22} color="#07834B" />
              </View>
              <View style={styles.actionCopy}>
                <Text style={styles.quickTitle}>Find a shelter</Text>
                <Text style={styles.quickDescription}>
                  {shelterCount !== null && shelterCount > 0
                    ? shelterCount +
                      ' open ' +
                      (shelterCount === 1 ? 'shelter' : 'shelters') +
                      (user?.district ? ' in ' + user.district : ' listed')
                    : 'View locations and availability'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={LightColors.mutedText} />
            </TouchableOpacity>
          </View>

          {queuedCount > 0 && (
            <TouchableOpacity
              onPress={() => router.push('/(app)/reports/offline-queue')}
              activeOpacity={0.7}
              style={styles.savedReports}
              accessibilityRole="button"
            >
              <Ionicons name="cloud-upload-outline" size={21} color="#946000" />
              <View style={styles.actionCopy}>
                <Text style={styles.savedTitle}>
                  {queuedCount} {queuedCount === 1 ? 'report waiting' : 'reports waiting'} to send
                </Text>
                <Text style={styles.quickDescription}>View your saved reports</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#946000" />
            </TouchableOpacity>
          )}
          {firstInfoRequest && (
            <TouchableOpacity
              onPress={() => openReport(firstInfoRequest)}
              activeOpacity={0.7}
              style={styles.followUp}
              accessibilityRole="button"
            >
              <Ionicons name="chatbubble-ellipses-outline" size={21} color={LightColors.primary} />
              <View style={styles.actionCopy}>
                <Text style={styles.quickTitle}>More information requested</Text>
                <Text style={styles.quickDescription}>Add details to help review your report.</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={LightColors.primary} />
            </TouchableOpacity>
          )}

          <View style={styles.sectionHeading}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Recent reports
            </Text>
            <TouchableOpacity onPress={myReports} style={styles.textLink} accessibilityRole="link">
              <Text style={styles.linkText}>View all</Text>
              <Ionicons name="chevron-forward" size={14} color={LightColors.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.recentCard}>
            {reportState === 'loading' ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={LightColors.primary} />
                <Text style={styles.secondaryText}>Loading your reports...</Text>
              </View>
            ) : reportState === 'error' ? (
              <View style={styles.emptyReports}>
                <Text style={styles.cardTitle}>Couldn&apos;t load your reports</Text>
                <Text style={styles.cardDescription}>Pull down to refresh or open My reports.</Text>
              </View>
            ) : reports.length === 0 ? (
              <View style={styles.emptyReports}>
                <View style={styles.noticeIcon}>
                  <Ionicons name="document-text-outline" size={23} color={LightColors.primary} />
                </View>
                <Text style={styles.cardTitle}>No reports yet</Text>
                <Text style={styles.emptyDescription}>
                  Your submitted reports and their review status will appear here.
                </Text>
              </View>
            ) : (
              reports.slice(0, 3).map((report, index) => {
                const status = reportStatus[report.status];
                return (
                  <View key={report.id}>
                    {index > 0 && <View style={styles.rowDivider} />}
                    <TouchableOpacity
                      onPress={() => openReport(report)}
                      activeOpacity={0.7}
                      style={styles.recentRow}
                      accessibilityRole="button"
                      accessibilityLabel={
                        observationLabel[report.observationType] + ', ' + status.label
                      }
                    >
                      <View style={styles.recentIcon}>
                        <Ionicons
                          name={
                            report.observationType === 'rising_water'
                              ? 'water-outline'
                              : report.observationType === 'blocked_road'
                                ? 'car-outline'
                                : 'warning-outline'
                          }
                          size={21}
                          color={LightColors.primary}
                        />
                      </View>
                      <View style={styles.recentCopy}>
                        <Text style={styles.recentTitle}>
                          {observationLabel[report.observationType]}
                        </Text>
                        <Text style={styles.recentDescription} numberOfLines={1}>
                          {report.locationName || report.district}
                        </Text>
                        <Text style={styles.recentDate}>
                          {new Date(report.createdAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: status.background }]}>
                        <Text style={[styles.statusText, { color: status.color }]}>
                          {status.label}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={LightColors.mutedText} />
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>
      <MobileNavBar appearance="light" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#0855D9' },
  shell: {
    backgroundColor: LightColors.background,
    borderColor: LightColors.border,
    shadowOpacity: 0.06,
  },
  content: { paddingTop: 0 },
  hero: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 58,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  heroCircle: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 35,
    borderColor: 'rgba(255,255,255,0.06)',
    right: -110,
    top: 30,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
  brandMark: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: { color: '#FFFFFF', ...MobileTypography.body, fontWeight: '800', letterSpacing: -0.5 },
  brandCaption: { color: '#DCEBFF', ...MobileTypography.caption, marginTop: 3 },
  heroButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FFC75F',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroDescription: { color: '#E4F0FF', ...MobileTypography.body, marginTop: 16 },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginHorizontal: 20,
    marginTop: -32,
    marginBottom: 24,
  },
  summaryCard: {
    flexBasis: '46%',
    flexGrow: 1,
    padding: 14,
    minHeight: 112,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EAF0F8',
    shadowColor: '#154893',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCopy: { flex: 1 },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  summaryValue: { color: LightColors.text, fontSize: 23, fontWeight: '800', letterSpacing: -0.6 },
  summaryLabel: { color: LightColors.secondaryText, ...MobileTypography.caption, marginTop: 2 },
  dashboardBody: { paddingHorizontal: 20 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 21, fontWeight: '700', color: '#FFFFFF' },
  headerText: { flex: 1 },
  greeting: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', letterSpacing: -0.7 },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 5,
  },
  identityText: { color: '#DCEBFF', ...MobileTypography.caption },
  identityDot: { color: '#DCEBFF', marginHorizontal: 3 },
  logout: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  sectionTitle: {
    color: LightColors.text,
    ...MobileTypography.section,
    fontWeight: '700',
    flexShrink: 1,
  },
  textLink: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  linkText: { ...MobileTypography.caption, fontWeight: '600', color: LightColors.primary },
  warningCard: {
    backgroundColor: LightColors.surface,
    borderWidth: 1,
    borderColor: LightColors.border,
    borderRadius: 18,
    padding: 18,
    marginBottom: 26,
    shadowColor: '#154893',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 1,
  },
  warningMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  warningBadgeText: { ...MobileTypography.badge, fontWeight: '600' },
  warningType: { color: LightColors.secondaryText, ...MobileTypography.caption },
  warningTitle: {
    color: LightColors.text,
    fontSize: 20,
    lineHeight: 27,
    letterSpacing: -0.3,
    fontWeight: '700',
    marginBottom: 8,
  },
  cardDescription: { color: LightColors.secondaryText, ...MobileTypography.body, marginTop: 6 },
  warningFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(21, 36, 59, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 16,
    paddingTop: 4,
  },
  location: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  locationText: { color: LightColors.secondaryText, ...MobileTypography.caption, flexShrink: 1 },
  moreWarnings: { color: LightColors.secondaryText, ...MobileTypography.caption, marginTop: 4 },
  noticeHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  noticeIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: LightColors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: LightColors.text,
    ...MobileTypography.body,
    fontWeight: '600',
    flexShrink: 1,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
  },
  secondaryText: { color: LightColors.secondaryText, ...MobileTypography.button },
  actionHeading: {
    color: LightColors.text,
    ...MobileTypography.section,
    fontWeight: '700',
    marginBottom: 14,
  },
  reportAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 18,
    borderRadius: 16,
    backgroundColor: LightColors.primary,
    marginBottom: 14,
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
  },
  reportIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCopy: { flex: 1 },
  reportActionTitle: {
    color: '#FFFFFF',
    ...MobileTypography.body,
    fontWeight: '700',
    marginBottom: 4,
  },
  reportActionDescription: { color: '#EAF2FF', ...MobileTypography.body },
  quickLinks: {
    backgroundColor: LightColors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LightColors.border,
    marginBottom: 24,
  },
  quickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, minHeight: 84 },
  quickIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: LightColors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shelterIcon: { backgroundColor: '#E8F8EF' },
  quickTitle: {
    color: LightColors.text,
    ...MobileTypography.body,
    fontWeight: '600',
    marginBottom: 4,
  },
  quickDescription: { color: LightColors.secondaryText, ...MobileTypography.body },
  countBadge: {
    backgroundColor: LightColors.primarySoft,
    minWidth: 25,
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  countText: { color: LightColors.primary, ...MobileTypography.caption, fontWeight: '600' },
  rowDivider: { height: 1, backgroundColor: '#EDF1F7', marginHorizontal: 16 },
  savedReports: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#F3E4B9',
    backgroundColor: '#FFFBF0',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  savedTitle: { color: '#946000', ...MobileTypography.body, fontWeight: '600', marginBottom: 3 },
  followUp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: LightColors.primarySoft,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  offlineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFF4CF',
    marginBottom: 18,
  },
  offlineText: { flex: 1, color: '#946000', ...MobileTypography.caption },
  recentCard: {
    backgroundColor: LightColors.surface,
    borderWidth: 1,
    borderColor: LightColors.border,
    borderRadius: 16,
  },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16 },
  recentCopy: { flex: 1 },
  recentIcon: {
    width: 40,
    height: 46,
    borderRadius: 13,
    backgroundColor: LightColors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentTitle: { color: LightColors.text, ...MobileTypography.body, fontWeight: '600' },
  recentDescription: { color: LightColors.secondaryText, ...MobileTypography.body, marginTop: 5 },
  recentDate: { color: LightColors.mutedText, ...MobileTypography.caption, marginTop: 5 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 5, maxWidth: 115 },
  statusText: { ...MobileTypography.badge, fontWeight: '600' },
  emptyReports: { alignItems: 'center', padding: 24, gap: 10 },
  emptyDescription: {
    color: LightColors.secondaryText,
    ...MobileTypography.body,

    textAlign: 'center',
    maxWidth: 250,
  },
});
