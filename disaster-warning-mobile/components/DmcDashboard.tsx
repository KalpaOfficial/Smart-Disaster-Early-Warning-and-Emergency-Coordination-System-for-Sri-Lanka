import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { useLogoutConfirmation } from './LogoutConfirmation';
import { ScreenContainer } from './ScreenContainer';
import { MobileNavBar } from './MobileNavBar';
import { FormModal } from './FormModal';
import { ReportDetailView } from './ReportDetailView';
import { LightColors, MobileTypography } from '@/constants/colors';
import { subscribeToGroundReports } from '@/services/groundReportService';
import { subscribeToActiveWarnings } from '@/services/warningService';
import { getActiveEvents } from '@/services/hazardEventService';
import { dmcReportSummary } from '@/utils/dmcDashboard';
import type { GroundReport } from '@/types/groundReport';
import type { HazardEvent } from '@/types/resources';
import type { HazardWarning } from '@/types/warning';

export function DmcDashboard() {
  const { state } = useAuth();
  const router = useRouter();
  const logout = useLogoutConfirmation();
  const insets = useSafeAreaInsets();
  const [reports, setReports] = useState<GroundReport[]>([]);
  const [warnings, setWarnings] = useState<HazardWarning[]>([]);
  const [events, setEvents] = useState<HazardEvent[]>([]);
  const [reportLoading, setReportLoading] = useState(true);
  const [warningLoading, setWarningLoading] = useState(true);
  const [eventLoading, setEventLoading] = useState(true);
  const [reportError, setReportError] = useState(false);
  const [warningError, setWarningError] = useState(false);
  const [eventError, setEventError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  useEffect(() => {
    setReportLoading(true);
    setWarningLoading(true);
    const stopReports = subscribeToGroundReports(
      items => {
        setReports(items);
        setReportLoading(false);
        setReportError(false);
      },
      () => {
        setReportError(true);
        setReportLoading(false);
      }
    );
    const stopWarnings = subscribeToActiveWarnings(
      items => {
        setWarnings(items);
        setWarningLoading(false);
        setWarningError(false);
      },
      () => {
        setWarningError(true);
        setWarningLoading(false);
      }
    );
    return () => {
      stopReports();
      stopWarnings();
    };
  }, [revision]);
  useFocusEffect(
    React.useCallback(() => {
      let active = true;
      setEventLoading(true);
      void getActiveEvents()
        .then(items => {
          if (active) {
            setEvents(items);
            setEventError(false);
          }
        })
        .catch(() => {
          if (active) setEventError(true);
        })
        .finally(() => {
          if (active) setEventLoading(false);
        });
      return () => {
        active = false;
      };
      // The revision intentionally reloads events when pull-to-refresh is used.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [revision])
  );
  const summary = dmcReportSummary(reports);
  const metrics: {
    label: string;
    value: number;
    color: string;
    background: string;
    icon: keyof typeof Ionicons.glyphMap;
  }[] = [
    {
      label: 'Pending review',
      value: summary.pending,
      color: '#946000',
      background: '#FFF2D4',
      icon: 'time-outline',
    },
    {
      label: 'Needs information',
      value: summary.infoRequested,
      color: LightColors.primary,
      background: LightColors.primarySoft,
      icon: 'chatbubble-ellipses-outline',
    },
    {
      label: 'Verified reports',
      value: summary.verified,
      color: '#07834B',
      background: '#E5F7ED',
      icon: 'checkmark-circle-outline',
    },
    {
      label: 'Rejected reports',
      value: summary.rejected,
      color: LightColors.danger,
      background: LightColors.dangerSoft,
      icon: 'close-circle-outline',
    },
  ];
  const openWarnings = () => router.push('/(app)/warnings');
  const openReports = () => router.push({ pathname: '/(app)/reports', params: { tab: 'pending' } });
  return (
    <ScreenContainer style={styles.screen} contentStyle={styles.shell}>
      <StatusBar style="light" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={reportLoading || warningLoading || eventLoading}
            onRefresh={() => setRevision(n => n + 1)}
            colors={[LightColors.primary]}
            tintColor={LightColors.primary}
          />
        }
      >
        <LinearGradient colors={['#0855D9', '#1265D9', '#2475D5']} style={styles.hero}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Ionicons name="shield-checkmark" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.flex}>
              <Text style={styles.profileName}>DisasterGuard</Text>
              <Text style={styles.profileRole}>
                DMC Officer / {state.user?.district || 'National coordination'}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              onPress={logout}
              style={styles.logout}
            >
              <Ionicons name="log-out-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.welcome}>
            Hello, {state.user?.fullName?.split(' ')[0] || 'Officer'}
          </Text>
          <Text style={styles.heroTitle}>Protect communities.</Text>
          <Text style={styles.heroDescription}>
            Issue warnings, verify reports and review the response to completed events.
          </Text>
        </LinearGradient>
        <View style={styles.metrics}>
          {metrics.map(metric => (
            <TouchableOpacity
              key={metric.label}
              accessibilityRole="button"
              accessibilityLabel={`${metric.label}: ${reportLoading || reportError ? 'unavailable' : metric.value}. Open verification queue`}
              onPress={() =>
                router.push({
                  pathname: '/(app)/reports',
                  params: {
                    tab:
                      metric.label === 'Needs information'
                        ? 'info_requested'
                        : metric.label === 'Pending review'
                          ? 'pending'
                          : 'all',
                  },
                })
              }
              style={styles.metric}
            >
              <View style={styles.metricTop}>
                <View style={[styles.metricIcon, { backgroundColor: metric.background }]}>
                  <Ionicons name={metric.icon} size={20} color={metric.color} />
                </View>
                <Text style={styles.metricValue}>
                  {reportLoading || reportError ? '—' : metric.value}
                </Text>
              </View>
              <Text style={styles.metricLabel}>{metric.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.body}>
          {(reportError || warningError || eventError) && (
            <View style={styles.error}>
              <Text style={styles.errorText}>
                Some updates are unavailable. Refresh to try again.
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => setRevision(n => n + 1)}
                style={styles.retry}
              >
                <Text style={styles.link}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
          <Text style={styles.sectionTitle}>Quick actions</Text>
          <View style={styles.card}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Manage hazard events"
              onPress={() => router.push('/(app)/warnings/events' as never)}
              style={styles.actionRow}
            >
              <View style={styles.actionIcon}>
                <Ionicons name="warning-outline" size={23} color={LightColors.primary} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.actionTitle}>Manage hazard events</Text>
                <Text style={styles.caption}>
                  Create events, update areas and close resolved hazards
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={LightColors.secondaryText} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Issue hazard warnings"
              onPress={openWarnings}
              style={styles.actionRow}
            >
              <View style={styles.actionIcon}>
                <Ionicons name="notifications-outline" size={23} color={LightColors.primary} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.actionTitle}>Issue hazard warnings</Text>
                <Text style={styles.caption}>
                  Review active events and send official instructions
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={LightColors.secondaryText} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Verify ground reports"
              onPress={openReports}
              style={styles.actionRow}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#E5F7ED' }]}>
                <Ionicons name="shield-checkmark-outline" size={23} color="#07834B" />
              </View>
              <View style={styles.flex}>
                <Text style={styles.actionTitle}>Verify ground reports</Text>
                <Text style={styles.caption}>Verify, reject or request more information</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={LightColors.secondaryText} />
            </TouchableOpacity>
          </View>
          <View style={styles.card}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Post-event reports"
              onPress={() => router.push('/(app)/post-event-reports')}
              style={styles.actionRow}
            >
              <View style={styles.actionIcon}>
                <Ionicons name="stats-chart-outline" size={23} color={LightColors.primary} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.actionTitle}>Post-event reports</Text>
                <Text style={styles.caption}>
                  Analyse completed events and export response reports
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={LightColors.secondaryText} />
            </TouchableOpacity>
          </View>
          <View style={styles.heading}>
            <Text style={styles.sectionTitle}>Hazard warnings</Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={openWarnings}
              style={styles.textButton}
            >
              <Text style={styles.link}>View all</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.card}>
            <View style={styles.warningSummary}>
              <View style={styles.flex}>
                <Text style={styles.metricValue}>
                  {eventLoading || eventError ? '—' : events.length}
                </Text>
                <Text style={styles.caption}>Active events</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.metricValue}>
                  {warningLoading || warningError ? '—' : warnings.length}
                </Text>
                <Text style={styles.caption}>Issued warnings</Text>
              </View>
            </View>
            {!eventLoading && !eventError && !events.length && (
              <Text style={styles.caption}>No active hazard events.</Text>
            )}
            {!eventError &&
              events.slice(0, 3).map(event => (
                <TouchableOpacity
                  key={event.id}
                  accessibilityRole="button"
                  accessibilityLabel={`View hazard event: ${event.title}`}
                  onPress={() =>
                    router.push({
                      pathname: '/(app)/warnings/[eventId]',
                      params: { eventId: event.id },
                    })
                  }
                  style={styles.event}
                >
                  <View style={styles.flex}>
                    <Text style={styles.actionTitle}>{event.title}</Text>
                    <Text style={styles.caption}>{event.affectedDistricts.join(', ')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={LightColors.primary} />
                </TouchableOpacity>
              ))}
          </View>
          <View style={styles.heading}>
            <Text style={styles.sectionTitle}>Awaiting review</Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={openReports}
              style={styles.textButton}
            >
              <Text style={styles.link}>View queue</Text>
            </TouchableOpacity>
          </View>
          {reportLoading ? (
            <ActivityIndicator color={LightColors.primary} style={styles.loading} />
          ) : reportError ? (
            <Text style={styles.caption}>The verification queue could not be loaded.</Text>
          ) : !summary.pendingReports.length ? (
            <View style={styles.card}>
              <Text style={styles.actionTitle}>You’re up to date</Text>
              <Text style={styles.caption}>No reports are waiting for verification.</Text>
            </View>
          ) : (
            summary.pendingReports.map(report => (
              <TouchableOpacity
                key={report.id}
                accessibilityRole="button"
                accessibilityLabel={`View report: ${report.referenceNumber}`}
                onPress={() => setSelectedReport(report.id)}
                style={styles.card}
              >
                <Text style={styles.reference}>{report.referenceNumber}</Text>
                <Text style={styles.actionTitle}>{report.locationName}</Text>
                <Text style={styles.caption}>
                  {report.district} · {new Date(report.createdAt).toLocaleDateString()}
                </Text>
                <Text style={styles.reportDescription} numberOfLines={2}>
                  {report.description}
                </Text>
                <View style={styles.reportFooter}>
                  <Text style={styles.link}>Review report</Text>
                  <Ionicons name="chevron-forward" size={18} color={LightColors.primary} />
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
      <MobileNavBar appearance="light" />
      <FormModal
        title="Review report"
        visible={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        appearance="light"
        scrollable={false}
      >
        {selectedReport && (
          <ReportDetailView
            key={selectedReport}
            reportId={selectedReport}
            embedded
            onClose={() => setSelectedReport(null)}
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
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcome: { ...MobileTypography.caption, color: '#DCEBFF', marginBottom: 8 },
  profileName: { ...MobileTypography.section, fontWeight: '700', color: '#FFFFFF' },
  profileRole: { ...MobileTypography.caption, color: '#DCEBFF' },
  logout: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 26, fontWeight: '800', letterSpacing: -0.8, color: '#FFFFFF' },
  heroDescription: { ...MobileTypography.body, color: '#E4F0FF', marginTop: 10 },
  sectionTitle: {
    ...MobileTypography.section,
    color: LightColors.text,
    fontWeight: '700',
    flexShrink: 1,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: -28,
    marginHorizontal: 18,
    marginBottom: 28,
  },
  metric: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    minHeight: 108,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  metricTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: { fontSize: 25, lineHeight: 32, color: LightColors.text, fontWeight: '800' },
  metricLabel: { ...MobileTypography.caption, color: LightColors.secondaryText },
  body: { paddingHorizontal: 18 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E7EEF8',
    marginTop: 12,
    marginBottom: 13,
  },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 76 },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: LightColors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    ...MobileTypography.body,
    color: LightColors.text,
    fontWeight: '700',
    marginBottom: 4,
  },
  caption: { ...MobileTypography.caption, color: LightColors.secondaryText },
  divider: { height: 1, backgroundColor: LightColors.border, marginVertical: 12 },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 14,
  },
  textButton: { minHeight: 44, justifyContent: 'center' },
  link: { ...MobileTypography.label, color: LightColors.primary, fontWeight: '600' },
  warningSummary: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  event: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 14,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: LightColors.border,
  },
  reference: {
    ...MobileTypography.caption,
    color: LightColors.primary,
    fontWeight: '700',
    marginBottom: 10,
  },
  reportDescription: { ...MobileTypography.body, color: LightColors.secondaryText, marginTop: 10 },
  reportFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  error: {
    backgroundColor: LightColors.dangerSoft,
    borderRadius: 14,
    padding: 12,
    marginBottom: 20,
  },
  errorText: { ...MobileTypography.caption, color: LightColors.danger },
  retry: { minHeight: 44, justifyContent: 'center' },
  loading: { padding: 30 },
});
