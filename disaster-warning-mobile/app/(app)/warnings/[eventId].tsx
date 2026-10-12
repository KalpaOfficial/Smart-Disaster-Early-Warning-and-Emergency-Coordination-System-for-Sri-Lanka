/**
 * UC01 – Hazard Event Details Screen
 * Renders full telemetry for a selected open hazard event retrieved strictly from Cloud Firestore by ID:
 * - Hazard Type
 * - Current Warning Level
 * - Affected Districts & River Basins
 * - Event Status
 * - Verified Ground Report Information & Count
 * Provides a clear "Issue warning" primary action button triggering the UC01 Warning Composer.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { ScreenContainer } from '@/components/ScreenContainer';
import {
  OfficerCard as Card,
  OfficerButton as Button,
  OfficerHero,
  officerScreenStyle,
  officerShellStyle,
} from '@/components/OfficerUi';
import { FormModal } from '@/components/FormModal';
import { ReportDetailView } from '@/components/ReportDetailView';
import { EmptyState } from '@/components/EmptyState';
import { MobileNavBar } from '@/components/MobileNavBar';
import { Spacing, BorderRadius } from '@/constants/colors';
import { OfficerColors as Colors, OfficerFontSize as FontSize } from '@/components/OfficerUi';
import { getHazardEvent } from '@/services/hazardEventService';
import { getGroundReportsForEvent, getWarningsForEvent } from '@/services/warningService';
import type { HazardEvent } from '@/types/resources';
import type { VerifiedGroundReportStub, HazardWarning } from '@/types/warning';

export default function HazardEventDetailsScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const { state } = useAuth();
  const user = state.user;

  const isDmcOfficer = user?.role === 'dmc_officer';

  // Component State
  const [event, setEvent] = useState<HazardEvent | null>(null);
  const [groundReports, setGroundReports] = useState<VerifiedGroundReportStub[]>([]);
  const [existingWarnings, setExistingWarnings] = useState<HazardWarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllWarnings, setShowAllWarnings] = useState(false);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch Event by Firestore ID, Ground Reports & Issued Warnings
  const fetchEventDetails = useCallback(async () => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const [evtData, reportsData, warningsData] = await Promise.all([
        getHazardEvent(eventId),
        getGroundReportsForEvent(eventId),
        getWarningsForEvent(eventId),
      ]);

      setEvent(evtData);
      setGroundReports(reportsData);
      setExistingWarnings(warningsData);
    } catch (err) {
      console.error('Error fetching hazard event details from Firestore:', err);
      setError('Failed to fetch hazard event details. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useFocusEffect(
    useCallback(() => {
      void fetchEventDetails();
    }, [fetchEventDetails])
  );

  // Navigate to Warning Composer with selected event
  const handleIssueWarning = () => {
    if (!event || event.status !== 'active') return;
    router.push({
      pathname: '/(app)/warnings/compose',
      params: { eventId: event.id },
    } as never);
  };

  return (
    <ScreenContainer style={officerScreenStyle} contentStyle={officerShellStyle}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Navigation Header */}
        <OfficerHero
          title="Hazard event"
          description="Review affected areas, verified reports and issued warnings."
          caption="DMC Officer"
          icon="notifications-outline"
          onBack={() => router.back()}
        />

        {/* Loading State */}
        {loading ? (
          <Card style={styles.stateCard}>
            <ActivityIndicator size="large" color={Colors.accent.primary} />
            <Text style={styles.stateTitle}>Retrieving Hazard Event Details...</Text>
            <Text style={styles.stateDesc}>
              Fetching document from Cloud Firestore `hazardEvents/{eventId}`.
            </Text>
          </Card>
        ) : error ? (
          /* Error State */
          <Card style={styles.errorCard}>
            <Ionicons name="cloud-offline" size={36} color={Colors.danger} />
            <Text style={styles.errorTitle}>Firestore Fetch Error</Text>
            <Text style={styles.errorDesc}>{error}</Text>
            <Button
              title="Retry Fetch"
              variant="danger"
              size="sm"
              onPress={fetchEventDetails}
              style={styles.retryBtn}
            />
          </Card>
        ) : !event ? (
          /* Not Found State */
          <EmptyState
            appearance="light"
            iconName="alert-circle-outline"
            title="Hazard Event Not Found"
            message={`No active hazard event document was found in Cloud Firestore matching ID "${eventId}".`}
            actionTitle="Return to Open Events"
            onAction={() => router.back()}
          />
        ) : (
          /* Event Telemetry Content */
          <>
            {/* Hero Event Banner */}
            <LinearGradient
              colors={['#EAF2FF', '#F8FAFD']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroBanner}
            >
              <View style={styles.heroHeaderRow}>
                <View style={styles.beaconPill}>
                  <View style={styles.beaconDot} />
                  <Text style={styles.beaconText}>
                    {event.hazardType.toUpperCase()} EVENT •{' '}
                    {event.status === 'active' ? 'OPEN' : 'CLOSED'}
                  </Text>
                </View>
                <View style={styles.statusChip}>
                  <Text style={styles.statusChipText}>{event.status.toUpperCase()}</Text>
                </View>
              </View>

              <Text style={styles.eventTitle}>{event.title}</Text>
              <Text style={styles.eventDesc}>{event.description}</Text>

              {/* Quick Metrics Strip */}
              <View style={styles.metricsRow}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>HAZARD TYPE</Text>
                  <Text style={styles.metricVal}>{event.hazardType.toUpperCase()}</Text>
                </View>

                <View style={styles.metricDivider} />

                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>WARNING LEVEL</Text>
                  <Text style={[styles.metricVal, { color: '#EF4444' }]}>
                    {event.warningLevel || 'LEVEL 4 ALERT'}
                  </Text>
                </View>

                <View style={styles.metricDivider} />

                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>GROUND REPORTS</Text>
                  <Text style={[styles.metricVal, { color: Colors.success }]}>
                    {groundReports.length} Verified
                  </Text>
                </View>
              </View>
            </LinearGradient>

            {/* Affected Areas & River Basins Card */}
            <Card style={styles.cardSection}>
              <View style={styles.cardHeaderRow}>
                <Ionicons name="location-sharp" size={18} color={Colors.accent.primary} />
                <Text style={styles.cardSectionTitle}>TARGET AFFECTED LOCATIONS</Text>
              </View>

              <View style={styles.areaGroup}>
                <Text style={styles.areaGroupLabel}>
                  AFFECTED DISTRICTS ({event.affectedDistricts.length}):
                </Text>
                <View style={styles.chipsWrap}>
                  {event.affectedDistricts.map(d => (
                    <View key={d} style={styles.districtChip}>
                      <Ionicons name="location" size={12} color={Colors.accent.primary} />
                      <Text style={styles.districtChipText}>{d}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {event.affectedRiverBasins && event.affectedRiverBasins.length > 0 ? (
                <View style={styles.areaGroup}>
                  <Text style={styles.areaGroupLabel}>
                    AFFECTED RIVER BASINS ({event.affectedRiverBasins.length}):
                  </Text>
                  <View style={styles.chipsWrap}>
                    {event.affectedRiverBasins.map(basin => (
                      <View key={basin} style={styles.basinChip}>
                        <Ionicons name="water" size={12} color="#0066FF" />
                        <Text style={styles.basinChipText}>{basin}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </Card>

            {/* Verified Ground Reports Section */}
            <Card style={styles.cardSection}>
              <View style={styles.cardHeaderRow}>
                <Ionicons name="shield-checkmark" size={18} color={Colors.success} />
                <Text style={styles.cardSectionTitle}>
                  Verified ground reports ({groundReports.length})
                </Text>
              </View>

              {groundReports.length > 0 ? (
                groundReports.map(report => (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`View report: ${report.referenceNumber || report.id}`}
                    key={report.id}
                    style={styles.groundReportCard}
                    onPress={() => setSelectedReport(report.id)}
                  >
                    <View style={styles.reportHeader}>
                      <Text style={styles.reportReference}>
                        {report.referenceNumber || 'Verified report'}
                      </Text>
                      <Ionicons name="chevron-forward" size={18} color={Colors.accent.primary} />
                    </View>
                    <Text style={styles.reportLocation}>{report.locationName}</Text>
                    <Text style={styles.reportDescription}>
                      {report.district} · {new Date(report.reportedAt).toLocaleDateString()}
                    </Text>
                    <Text style={styles.reportDescription} numberOfLines={2}>
                      {report.description}
                    </Text>
                    <Text style={styles.viewReportLabel}>View report details</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.noReportsBox}>
                  <View style={styles.noReportsHeader}>
                    <Ionicons
                      name="information-circle-outline"
                      size={18}
                      color={Colors.accent.primary}
                    />
                    <Text style={styles.noReportsTitle}>
                      No verified ground reports available for this hazard event.
                    </Text>
                  </View>
                  <Text style={styles.noReportsText}>
                    You can still issue a warning using official monitoring information. Review the
                    event details before deciding.
                  </Text>
                </View>
              )}
            </Card>

            {/* Issued Warnings for this Event Card */}
            {existingWarnings.length > 0 && (
              <Card style={styles.cardSection}>
                <View style={styles.cardHeaderRow}>
                  <Ionicons name="notifications" size={18} color="#F59E0B" />
                  <Text style={styles.cardSectionTitle}>
                    Issued warnings ({existingWarnings.length})
                  </Text>
                </View>

                <Text style={styles.reportDescription}>
                  Most recent first. Open delivery details to see whether each alert reached its
                  audience.
                </Text>
                {(showAllWarnings ? existingWarnings : existingWarnings.slice(0, 3)).map(warn => (
                  <View key={warn.id} style={styles.existingWarningCard}>
                    <View style={styles.reportHeader}>
                      <Text
                        style={[
                          styles.severityText,
                          {
                            color: warn.severity === 'evacuation' ? Colors.danger : Colors.warning,
                          },
                        ]}
                      >
                        {warn.severity === 'evacuation'
                          ? 'Evacuation order'
                          : warn.severity === 'advisory'
                            ? 'Advisory'
                            : 'Warning'}
                      </Text>
                      <Text style={styles.reportTime}>
                        {new Date(warn.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <Text style={styles.warningHeadline}>{warn.headline}</Text>
                    <Text style={styles.reportDescription}>{warn.targetAreas.join(', ')}</Text>
                    <Text style={styles.reportDescription}>
                      {warn.recipientCount} registered recipients ·{' '}
                      {warn.status === 'delivered'
                        ? 'Sent'
                        : warn.status === 'partially_failed'
                          ? 'Some deliveries failed'
                          : warn.status === 'failed'
                            ? 'Delivery failed'
                            : warn.status.replace(/_/g, ' ')}
                    </Text>
                    {warn.previousWarningId && (
                      <Text style={styles.reportTime}>Updates an earlier warning</Text>
                    )}
                    <View style={styles.warningActions}>
                      <Button
                        title="View delivery details"
                        variant="secondary"
                        onPress={() =>
                          router.push({
                            pathname: '/(app)/warnings/summary',
                            params: { warningId: warn.id, eventId },
                          } as never)
                        }
                      />
                      {isDmcOfficer && event.status === 'active' && (
                        <Button
                          title={
                            warn.severity === 'evacuation' ? 'Update warning' : 'Raise alert level'
                          }
                          variant="outline"
                          onPress={() =>
                            router.push({
                              pathname: '/(app)/warnings/compose',
                              params: { eventId, escalateWarningId: warn.id },
                            } as never)
                          }
                        />
                      )}
                    </View>
                  </View>
                ))}
                {existingWarnings.length > 3 && (
                  <Button
                    title={
                      showAllWarnings
                        ? 'Show recent warnings'
                        : `View all ${existingWarnings.length} warnings`
                    }
                    variant="secondary"
                    onPress={() => setShowAllWarnings(value => !value)}
                  />
                )}
              </Card>
            )}

            {/* Clear "Issue warning" Primary CTA Action */}
            <View style={styles.actionSection}>
              {isDmcOfficer && (
                <Button
                  title="Manage hazard events"
                  variant="secondary"
                  onPress={() => router.push('/(app)/warnings/events' as never)}
                  style={{ marginBottom: 12 }}
                />
              )}
              {isDmcOfficer && event.status === 'active' ? (
                <Button
                  title="Issue warning"
                  variant="primary"
                  icon={<Ionicons name="megaphone-outline" size={20} color="#FFFFFF" />}
                  onPress={handleIssueWarning}
                  style={styles.issueWarningBtn}
                />
              ) : (
                <View style={styles.nonOfficerNotice}>
                  <Ionicons
                    name="information-circle-outline"
                    size={16}
                    color={Colors.text.tertiary}
                  />
                  <Text style={styles.nonOfficerText}>
                    {event.status === 'closed'
                      ? 'This event is closed. Its reports and warning history remain available.'
                      : 'Only DMC officers can issue warnings. You can view the event details.'}
                  </Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <FormModal
        appearance="light"
        visible={Boolean(selectedReport)}
        title="Report details"
        scrollable={false}
        onClose={() => setSelectedReport(null)}
      >
        {selectedReport && (
          <ReportDetailView
            reportId={selectedReport}
            embedded
            onClose={() => setSelectedReport(null)}
          />
        )}
      </FormModal>
      <MobileNavBar appearance="light" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  reportReference: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.success,
    fontWeight: '600',
    flex: 1,
  },
  viewReportLabel: {
    fontSize: 14,
    lineHeight: 22,
    color: Colors.accent.primary,
    fontWeight: '600',
    marginTop: 8,
  },
  severityText: { fontSize: 14, lineHeight: 22, fontWeight: '600', flex: 1 },
  warningHeadline: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.text.primary,
    fontWeight: '700',
    marginVertical: 8,
  },
  warningActions: { gap: 10, marginTop: 12 },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: 110,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 20,
    backgroundColor: '#F8FAFD',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DFE7F1',
  },
  navTitleBox: {
    flex: 1,
  },
  navPill: {
    fontSize: FontSize.micro,
    fontWeight: '800',
    color: Colors.accent.primary,
    letterSpacing: 0.8,
  },
  navTitle: {
    fontSize: FontSize.lg,
    fontWeight: '900',
    color: Colors.text.primary,
  },
  heroBanner: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.35)',
    marginBottom: Spacing.xl,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    flexWrap: 'wrap',
    gap: 8,
  },
  beaconPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    gap: 6,
  },
  beaconDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  beaconText: {
    fontSize: FontSize.micro,
    fontWeight: '800',
    color: '#B42332',
    letterSpacing: 0.5,
  },
  statusChip: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  statusChipText: {
    fontSize: FontSize.micro,
    fontWeight: '800',
    color: Colors.success,
  },
  eventTitle: {
    fontSize: FontSize.xl,
    fontWeight: '900',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  eventDesc: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'center',
    backgroundColor: '#F8FAFD',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#DFE7F1',
  },
  metricItem: {
    flexGrow: 1,
    flexBasis: 90,
    minWidth: 0,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: FontSize.micro,
    color: Colors.text.tertiary,
    fontWeight: '700',
    textAlign: 'center',
  },
  metricVal: {
    fontSize: FontSize.xs,
    fontWeight: '900',
    color: Colors.text.primary,
    marginTop: 2,
    textAlign: 'center',
  },
  metricDivider: {
    display: 'none',
    width: 1,
    height: 24,
    backgroundColor: '#DFE7F1',
  },
  cardSection: {
    marginBottom: Spacing.xl,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  cardSectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.text.tertiary,
    letterSpacing: 0,
  },
  areaGroup: {
    marginBottom: Spacing.sm,
  },
  areaGroupLabel: {
    fontSize: FontSize.micro,
    fontWeight: '800',
    color: Colors.text.tertiary,
    marginBottom: 4,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  districtChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  districtChipText: {
    fontSize: FontSize.xs,
    color: Colors.accent.primary,
    fontWeight: '700',
  },
  basinChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  basinChipText: {
    fontSize: FontSize.xs,
    color: '#0066FF',
    fontWeight: '800',
  },
  groundReportCard: {
    backgroundColor: '#F8FAFD',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: '#DFE7F1',
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedTagText: {
    fontSize: FontSize.micro,
    color: Colors.success,
    fontWeight: '700',
  },
  reportTime: {
    fontSize: FontSize.micro,
    color: Colors.text.tertiary,
  },
  reportLocation: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.text.primary,
    marginTop: 2,
  },
  reportDescription: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    lineHeight: 22,
    marginTop: 4,
  },
  noReportsBox: {
    padding: Spacing.md,
    backgroundColor: '#DFE7F1',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#DFE7F1',
    gap: Spacing.xs,
  },
  noReportsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  noReportsTitle: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.accent.primary,
    flex: 1,
  },
  noReportsText: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    lineHeight: 22,
  },
  actionSection: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xxl,
  },
  issueWarningBtn: {
    width: '100%',
  },
  nonOfficerNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.md,
    backgroundColor: '#F8FAFD',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#DFE7F1',
  },
  nonOfficerText: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
  },
  stateCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
    marginVertical: Spacing.xl,
  },
  stateTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: Spacing.md,
  },
  stateDesc: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginTop: 4,
    textAlign: 'center',
  },
  errorCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    marginVertical: Spacing.xl,
  },
  errorTitle: {
    fontSize: FontSize.lg,
    fontWeight: '900',
    color: Colors.danger,
    marginTop: Spacing.md,
  },
  errorDesc: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  retryBtn: {
    minWidth: 160,
  },
  existingWarningCard: {
    backgroundColor: '#F8FAFD',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#DFE7F1',
    marginBottom: Spacing.sm,
  },
  existingWarningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  severityIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  existingWarningHeadline: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.text.primary,
    flex: 1,
  },
  existingWarningSeverityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  existingWarningSeverityText: {
    fontSize: FontSize.micro,
    fontWeight: '800',
  },
  escalatedNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  escalatedNoticeText: {
    fontSize: FontSize.micro,
    fontWeight: '700',
    color: '#F59E0B',
  },
  existingWarningMeta: {
    fontSize: FontSize.micro,
    color: Colors.text.tertiary,
    marginBottom: Spacing.sm,
  },
  existingWarningBtnRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: 4,
  },
});
