/**
 * UC01 – Hazard Event Details Screen
 * Renders full telemetry for a selected open hazard event retrieved strictly from Cloud Firestore by ID:
 * - Hazard Type
 * - Current Warning Level
 * - Affected Districts & River Basins
 * - Event Status
 * - Verified Ground Report Information & Count
 * Provides a clear "ISSUE WARNING" primary action button triggering the UC01 Warning Composer.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { MobileNavBar } from '@/components/MobileNavBar';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/colors';
import { getHazardEvent } from '@/services/hazardEventService';
import { getGroundReportsForEvent } from '@/services/warningService';
import type { HazardEvent } from '@/types/resources';
import type { VerifiedGroundReportStub } from '@/types/warning';

export default function HazardEventDetailsScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const { state } = useAuth();
  const user = state.user;

  const isDmcOfficer = user?.role === 'dmc_officer';

  // Component State
  const [event, setEvent] = useState<HazardEvent | null>(null);
  const [groundReports, setGroundReports] = useState<VerifiedGroundReportStub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch Event by Firestore ID & Ground Reports
  const fetchEventDetails = useCallback(async () => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const [evtData, reportsData] = await Promise.all([
        getHazardEvent(eventId),
        getGroundReportsForEvent(eventId),
      ]);

      setEvent(evtData);
      setGroundReports(reportsData);
    } catch (err) {
      console.error('Error fetching hazard event details from Firestore:', err);
      setError('Failed to fetch hazard event details. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchEventDetails();
  }, [fetchEventDetails]);

  // Navigate to Warning Composer with selected event
  const handleIssueWarning = () => {
    if (!event) return;
    router.push({
      pathname: '/(app)/warnings/compose',
      params: { eventId: event.id },
    } as never);
  };

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Navigation Header */}
        <View style={styles.navHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={Colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.navTitleBox}>
            <Text style={styles.navPill}>EVENT TELEMETRY</Text>
            <Text style={styles.navTitle}>Hazard Event Details</Text>
          </View>
        </View>

        {/* Loading State */}
        {loading ? (
          <Card style={styles.stateCard}>
            <ActivityIndicator size="large" color={Colors.accent.primary} />
            <Text style={styles.stateTitle}>Retrieving Hazard Event Details...</Text>
            <Text style={styles.stateDesc}>Fetching document from Cloud Firestore `hazardEvents/{eventId}`.</Text>
          </Card>
        ) : error ? (
          /* Error State */
          <Card style={styles.errorCard}>
            <Ionicons name="cloud-offline" size={36} color={Colors.danger} />
            <Text style={styles.errorTitle}>Firestore Fetch Error</Text>
            <Text style={styles.errorDesc}>{error}</Text>
            <Button title="Retry Fetch" variant="danger" size="sm" onPress={fetchEventDetails} style={styles.retryBtn} />
          </Card>
        ) : !event ? (
          /* Not Found State */
          <EmptyState
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
              colors={['#1E1B4B', '#0F172A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroBanner}
            >
              <View style={styles.heroHeaderRow}>
                <View style={styles.beaconPill}>
                  <View style={styles.beaconDot} />
                  <Text style={styles.beaconText}>{event.hazardType.toUpperCase()} EVENT • OPEN</Text>
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
                  <Text style={[styles.metricVal, { color: Colors.success }]}>{groundReports.length} Verified</Text>
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
                <Text style={styles.areaGroupLabel}>AFFECTED DISTRICTS ({event.affectedDistricts.length}):</Text>
                <View style={styles.chipsWrap}>
                  {event.affectedDistricts.map((d) => (
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
                    {event.affectedRiverBasins.map((basin) => (
                      <View key={basin} style={styles.basinChip}>
                        <Ionicons name="water" size={12} color="#38BDF8" />
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
                <Text style={styles.cardSectionTitle}>VERIFIED GROUND REPORTS ({groundReports.length})</Text>
              </View>

              {groundReports.length > 0 ? (
                groundReports.map((report) => (
                  <TouchableOpacity
                    key={report.id}
                    style={styles.groundReportCard}
                    activeOpacity={0.75}
                    onPress={() => router.push(`/(app)/reports/${report.id}` as never)}
                  >
                    <View style={styles.reportHeader}>
                      <View style={styles.verifiedTag}>
                        <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
                        <Text style={styles.verifiedTagText}>
                          {report.referenceNumber ? `#${report.referenceNumber} • ` : ''}VERIFIED BY {report.verifiedBy}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={styles.reportTime}>
                          {new Date(report.reportedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        <Ionicons name="chevron-forward" size={14} color={Colors.text.tertiary} />
                      </View>
                    </View>

                    <Text style={styles.reportLocation}>📍 {report.locationName} ({report.district})</Text>
                    <Text style={styles.reportDescription}>{report.description}</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.noReportsText}>No ground reports verified yet for this hazard event.</Text>
              )}
            </Card>

            {/* Clear "ISSUE WARNING" Primary CTA Action */}
            <View style={styles.actionSection}>
              {isDmcOfficer ? (
                <Button
                  title="ISSUE WARNING"
                  variant="primary"
                  icon={<Ionicons name="megaphone-outline" size={20} color="#FFFFFF" />}
                  onPress={handleIssueWarning}
                  style={styles.issueWarningBtn}
                />
              ) : (
                <View style={styles.nonOfficerNotice}>
                  <Ionicons name="information-circle-outline" size={16} color={Colors.text.tertiary} />
                  <Text style={styles.nonOfficerText}>
                    Warning issuance is restricted to DMC Duty Officers. You are viewing event telemetry.
                  </Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <MobileNavBar />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    color: '#FCA5A5',
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
    color: '#FFFFFF',
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
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: FontSize.micro,
    color: Colors.text.tertiary,
    fontWeight: '700',
  },
  metricVal: {
    fontSize: FontSize.xs,
    fontWeight: '900',
    color: '#FFF',
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
    fontSize: FontSize.micro,
    fontWeight: '800',
    color: Colors.text.tertiary,
    letterSpacing: 0.8,
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
    color: '#38BDF8',
    fontWeight: '800',
  },
  groundReportCard: {
    backgroundColor: '#0F172A',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
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
    color: '#FFF',
    marginTop: 2,
  },
  reportDescription: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    lineHeight: 18,
    marginTop: 4,
  },
  noReportsText: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    fontStyle: 'italic',
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
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
});
