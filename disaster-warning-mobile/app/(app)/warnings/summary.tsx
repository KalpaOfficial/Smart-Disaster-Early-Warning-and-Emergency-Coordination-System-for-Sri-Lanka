/**
 * UC01 – Delivery Summary Screen
 * Displays dispatch outcome telemetry for an issued disaster warning document:
 * - Status Banner (Dispatched / Partial / Failed)
 * - Warning Headline, Hazard Type, Severity, Target Areas, Recipient Count
 * - Per-channel delivery breakdown (Delivered Count & Failed Count for Push, SMS, Audible)
 * - Overall warning status
 * - Dispatch timestamp
 * - Primary action button to return to the target hazard event.
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
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { MobileNavBar } from '@/components/MobileNavBar';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/colors';
import { getWarningById, getDeliveryLogsForWarning } from '@/services/warningService';
import type { HazardWarning, DeliveryLog, DeliveryChannel, WarningStatus } from '@/types/warning';

const CHANNEL_CONFIG: Record<
  DeliveryChannel,
  { label: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  push: { label: 'Push', icon: 'notifications' },
  sms: { label: 'SMS', icon: 'chatbox-ellipses' },
  audible: { label: 'Audible', icon: 'volume-high' },
};

export default function WarningDeliverySummaryScreen() {
  const params = useLocalSearchParams<{ warningId?: string; eventId?: string }>();
  const router = useRouter();

  const warningId = params.warningId || '';

  const [warning, setWarning] = useState<HazardWarning | null>(null);
  const [deliveryLogs, setDeliveryLogs] = useState<DeliveryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummaryData = useCallback(async () => {
    if (!warningId) {
      setLoading(false);
      setError('No warning ID specified for delivery summary.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [fetchedWarning, logs] = await Promise.all([
        getWarningById(warningId),
        getDeliveryLogsForWarning(warningId),
      ]);

      if (fetchedWarning) {
        setWarning(fetchedWarning);
        setDeliveryLogs(logs);
      } else {
        setError(`Warning document with ID "${warningId}" was not found.`);
      }
    } catch (err) {
      console.error('Error fetching warning delivery summary:', err);
      setError('Failed to load warning delivery summary from Cloud Firestore.');
    } finally {
      setLoading(false);
    }
  }, [warningId]);

  useEffect(() => {
    fetchSummaryData();
  }, [fetchSummaryData]);

  // Navigate back to the target hazard event
  const handleReturnToEvent = () => {
    const targetEventId = warning?.eventId || params.eventId;
    if (targetEventId) {
      router.push({
        pathname: '/(app)/warnings/[eventId]',
        params: { eventId: targetEventId },
      } as never);
    } else {
      router.push('/(app)/warnings' as never);
    }
  };

  // Helper for overall status branding & labels
  const getStatusBranding = (status?: WarningStatus) => {
    switch (status) {
      case 'delivered':
        return {
          bannerTitle: 'WARNING DISPATCHED',
          statusText: 'Dispatched',
          color: Colors.success,
          bgColor: 'rgba(16, 185, 129, 0.12)',
          borderColor: 'rgba(16, 185, 129, 0.35)',
          icon: 'checkmark-circle' as keyof typeof Ionicons.glyphMap,
          gradientColors: ['#064E3B', '#0F172A'] as const,
        };
      case 'partially_failed':
        return {
          bannerTitle: 'DISPATCHED WITH PARTIAL DELIVERY',
          statusText: 'Dispatched (Partial)',
          color: Colors.warning,
          bgColor: 'rgba(245, 158, 11, 0.12)',
          borderColor: 'rgba(245, 158, 11, 0.35)',
          icon: 'warning' as keyof typeof Ionicons.glyphMap,
          gradientColors: ['#78350F', '#0F172A'] as const,
        };
      case 'failed':
        return {
          bannerTitle: 'DISPATCH FAILED',
          statusText: 'Dispatch Failed',
          color: Colors.danger,
          bgColor: 'rgba(239, 68, 68, 0.12)',
          borderColor: 'rgba(239, 68, 68, 0.35)',
          icon: 'close-circle' as keyof typeof Ionicons.glyphMap,
          gradientColors: ['#7F1D1D', '#0F172A'] as const,
        };
      default:
        return {
          bannerTitle: 'WARNING DISPATCH SUMMARY',
          statusText: status || 'Processing',
          color: Colors.accent.primary,
          bgColor: 'rgba(99, 102, 241, 0.12)',
          borderColor: 'rgba(99, 102, 241, 0.35)',
          icon: 'information-circle' as keyof typeof Ionicons.glyphMap,
          gradientColors: ['#1E1B4B', '#0F172A'] as const,
        };
    }
  };

  // Format severity level for display
  const formatSeverity = (sev: string) => {
    switch (sev.toLowerCase()) {
      case 'evacuation':
        return 'High (Evacuation Order)';
      case 'warning':
        return 'High';
      case 'advisory':
        return 'Medium';
      default:
        return sev;
    }
  };

  // Channel delivery fallback generator if logs are empty (derived from warning.channelResults or channels)
  const effectiveChannelLogs = (): {
    channel: DeliveryChannel;
    deliveredCount: number;
    failedCount: number;
    status: string;
    errorMessage?: string;
  }[] => {
    if (deliveryLogs.length > 0) {
      return deliveryLogs.map((log) => ({
        channel: log.channel,
        deliveredCount: log.deliveredCount,
        failedCount: log.failedCount,
        status: log.status,
        errorMessage: log.errorMessage,
      }));
    }

    if (warning?.channelResults && warning.channelResults.length > 0) {
      return warning.channelResults.map((chRes) => {
        const isSuccess = chRes.status === 'success' || chRes.status === 'Success';
        const isFailed = chRes.status === 'failed' || chRes.status === 'Failed';
        return {
          channel: chRes.channel,
          deliveredCount: isSuccess ? chRes.recipientCount : 0,
          failedCount: isFailed ? chRes.recipientCount : 0,
          status: String(chRes.status),
          errorMessage: chRes.errorMessage,
        };
      });
    }

    if (warning?.channels) {
      return warning.channels.map((ch) => ({
        channel: ch,
        deliveredCount: warning.status === 'delivered' ? warning.recipientCount : 0,
        failedCount: warning.status === 'failed' ? warning.recipientCount : 0,
        status: warning.status === 'delivered' ? 'Success' : 'Failed',
      }));
    }

    return [];
  };

  const branding = getStatusBranding(warning?.status);
  const logsToDisplay = effectiveChannelLogs();

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Navigation Header */}
        <View style={styles.navHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={Colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.navTitleBox}>
            <Text style={styles.navPill}>UC01 — DISPATCH OUTCOME</Text>
            <Text style={styles.navTitle}>Delivery Summary</Text>
          </View>
        </View>

        {/* Loading State */}
        {loading ? (
          <Card style={styles.stateCard}>
            <ActivityIndicator size="large" color={Colors.accent.primary} />
            <Text style={styles.stateTitle}>Retrieving Delivery Logs...</Text>
            <Text style={styles.stateDesc}>Fetching dispatch summary from Cloud Firestore.</Text>
          </Card>
        ) : error && !warning ? (
          /* Error State */
          <Card style={styles.errorCard}>
            <Ionicons name="alert-circle" size={36} color={Colors.danger} />
            <Text style={styles.errorTitle}>Summary Fetch Error</Text>
            <Text style={styles.errorDesc}>{error}</Text>
            <Button
              title="Return to Events"
              variant="secondary"
              size="sm"
              onPress={() => router.push('/(app)/warnings' as never)}
              style={styles.actionBtn}
            />
          </Card>
        ) : warning ? (
          <>
            {/* Top Status Banner */}
            <LinearGradient
              colors={branding.gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.statusBanner, { borderColor: branding.borderColor }]}
            >
              <View style={styles.bannerHeaderRow}>
                <Ionicons name={branding.icon} size={28} color={branding.color} />
                <View style={styles.bannerTitleBox}>
                  <Text style={[styles.bannerHeadline, { color: branding.color }]}>
                    {branding.bannerTitle}
                  </Text>
                  {warning.dispatchedAt && (
                    <Text style={styles.timestampText}>
                      Dispatched: {new Date(warning.dispatchedAt).toLocaleString()}
                    </Text>
                  )}
                </View>
              </View>
            </LinearGradient>

            {/* Warning Details Overview Card */}
            <Card style={styles.overviewCard}>
              <Text style={styles.warningTitle}>{warning.headline}</Text>

              <View style={styles.divider} />

              <View style={styles.detailGrid}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Hazard Type:</Text>
                  <Text style={styles.detailValueBold}>
                    {warning.hazardType.toUpperCase()}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Severity:</Text>
                  <Text style={[styles.detailValueBold, { color: Colors.danger }]}>
                    {formatSeverity(warning.severity)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Target Areas:</Text>
                  <Text style={styles.detailValue}>
                    {warning.targetAreas.join(', ')}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Recipients:</Text>
                  <Text style={[styles.detailValueBold, { color: Colors.accent.primary }]}>
                    {warning.recipientCount.toLocaleString()}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Selected Channels:</Text>
                  <Text style={styles.detailValue}>
                    {warning.channels.map((c) => CHANNEL_CONFIG[c]?.label || c).join(', ')}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Per-Channel Delivery Results Section */}
            <View style={styles.sectionHeaderBox}>
              <Text style={styles.sectionTitle}>DELIVERY CHANNELS</Text>
            </View>

            {logsToDisplay.map((log) => {
              const cfg = CHANNEL_CONFIG[log.channel] || {
                label: log.channel,
                icon: 'notifications',
              };
              const isSuccess =
                log.status === 'Success' ||
                log.status === 'success' ||
                (log.failedCount === 0 && log.deliveredCount > 0);
              const isFailed =
                log.status === 'Failed' ||
                log.status === 'failed' ||
                log.deliveredCount === 0;

              const badgeColor = isSuccess
                ? Colors.success
                : isFailed
                ? Colors.danger
                : Colors.warning;

              return (
                <Card key={log.channel} style={styles.channelCard}>
                  <View style={styles.channelHeader}>
                    <View style={styles.channelTitleRow}>
                      <Ionicons name={cfg.icon} size={20} color={Colors.accent.primary} />
                      <Text style={styles.channelName}>{cfg.label}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: `${badgeColor}20` }]}>
                      <Text style={[styles.statusBadgeText, { color: badgeColor }]}>
                        {isSuccess ? 'DELIVERED' : isFailed ? 'FAILED' : 'PARTIAL'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.channelMetricsRow}>
                    <View style={styles.countBadgeDelivered}>
                      <Text style={styles.countNumberDelivered}>
                        {log.deliveredCount.toLocaleString()}
                      </Text>
                      <Text style={styles.countLabelDelivered}>delivered</Text>
                    </View>

                    <View style={styles.countBadgeFailed}>
                      <Text style={styles.countNumberFailed}>
                        {log.failedCount.toLocaleString()}
                      </Text>
                      <Text style={styles.countLabelFailed}>failed</Text>
                    </View>
                  </View>

                  {log.errorMessage && (
                    <View style={styles.errorNote}>
                      <Ionicons name="warning-outline" size={14} color={Colors.danger} />
                      <Text style={styles.errorNoteText}>{log.errorMessage}</Text>
                    </View>
                  )}
                </Card>
              );
            })}

            {/* Overall Status Card */}
            <Card style={styles.overallCard}>
              <Text style={styles.overallLabel}>Overall:</Text>
              <Text style={[styles.overallValue, { color: branding.color }]}>
                {branding.statusText}
              </Text>
            </Card>

            {/* Action Button: Return to Hazard Event */}
            <View style={styles.actionContainer}>
              <Button
                title="Return to Hazard Event"
                variant="primary"
                size="lg"
                icon={<Ionicons name="arrow-back-circle-outline" size={22} color="#FFFFFF" />}
                onPress={handleReturnToEvent}
                style={styles.returnBtn}
              />
            </View>
          </>
        ) : null}
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
  stateCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  stateTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: Spacing.md,
  },
  stateDesc: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  errorCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  errorTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.danger,
    marginTop: Spacing.sm,
  },
  errorDesc: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginVertical: Spacing.sm,
  },
  statusBanner: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  bannerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  bannerTitleBox: {
    flex: 1,
  },
  bannerHeadline: {
    fontSize: FontSize.md,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  timestampText: {
    fontSize: FontSize.micro,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  overviewCard: {
    marginBottom: Spacing.lg,
  },
  warningTitle: {
    fontSize: FontSize.lg,
    fontWeight: '900',
    color: Colors.text.primary,
    lineHeight: 24,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: Spacing.md,
  },
  detailGrid: {
    gap: Spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: FontSize.xs,
    color: Colors.text.primary,
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
    marginLeft: Spacing.md,
  },
  detailValueBold: {
    fontSize: FontSize.xs,
    color: Colors.text.primary,
    fontWeight: '800',
    textAlign: 'right',
  },
  sectionHeaderBox: {
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.micro,
    fontWeight: '800',
    color: Colors.text.tertiary,
    letterSpacing: 0.8,
  },
  channelCard: {
    marginBottom: Spacing.md,
  },
  channelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  channelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  channelName: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.xs,
  },
  statusBadgeText: {
    fontSize: FontSize.micro,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  channelMetricsRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginTop: 4,
  },
  countBadgeDelivered: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  countNumberDelivered: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  countLabelDelivered: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
  },
  countBadgeFailed: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  countNumberFailed: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.danger,
  },
  countLabelFailed: {
    fontSize: FontSize.xs,
    color: Colors.danger,
  },
  errorNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(239, 68, 68, 0.2)',
  },
  errorNoteText: {
    fontSize: FontSize.micro,
    color: Colors.danger,
    flex: 1,
  },
  overallCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: Spacing.md,
    backgroundColor: '#0F172A',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  overallLabel: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    color: Colors.text.secondary,
  },
  overallValue: {
    fontSize: FontSize.md,
    fontWeight: '900',
  },
  actionContainer: {
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  returnBtn: {
    width: '100%',
  },
  actionBtn: {
    marginTop: Spacing.md,
  },
});
