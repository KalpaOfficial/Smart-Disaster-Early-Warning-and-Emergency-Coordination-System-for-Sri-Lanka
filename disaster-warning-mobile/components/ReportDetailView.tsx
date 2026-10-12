import { AppAlert } from '@/utils/appNotice';
/**
 * Report Detail Screen — Deep View for Ground Hazard Observations.
 * UC02 Main Flow Steps 14-20 & Alternate Flows.
 * Dedicated screen for:
 * - Submitter viewing status, verification timeline, and responding to clarification requests.
 * - DMC Duty Officer reviewing evidence, coordinates, and performing Verification / Rejection / Info Requests.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Platform,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ReportReviewPanel } from '@/components/ReportReviewPanel';
import { CreateHazardEventModal } from '@/components/CreateHazardEventModal';
import { ReportPhotoGallery } from '@/components/ReportPhotoGallery';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ScreenContainer';
import { ReportStatusBadge } from '@/components/ReportStatusBadge';
import { ObservationTypeBadge } from '@/components/ObservationTypeBadge';
import { ReportScreenHero } from '@/components/ReportScreenHero';
import { EmptyState } from '@/components/EmptyState';
import { LightColors, MobileTypography, BorderRadius, Spacing } from '@/constants/colors';
import { getReportPermissions } from '@/constants/reportPermissions';
import { useAuth } from '@/hooks/useAuth';
import {
  getReportById,
  verifyReport,
  rejectReport,
  requestAdditionalInfo,
  submitAdditionalInfo,
} from '@/services/groundReportService';
import { getActiveEvents } from '@/services/hazardEventService';
import { markNotificationAsRead } from '@/services/reportNotificationService';
import type { GroundReport } from '@/types/groundReport';
import type { HazardEvent } from '@/types/resources';

// Optional native map support
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
let MapView: any = null;
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
let Marker: any = null;
if (Platform.OS !== 'web')
  try {
    /* eslint-disable-next-line @typescript-eslint/no-require-imports */
    const maps = require('react-native-maps');
    MapView = maps.default || maps.MapView;
    Marker = maps.Marker;
  } catch {
    MapView = null;
    Marker = null;
  }

export function ReportDetailView({
  reportId,
  onClose,
  embedded = false,
}: {
  reportId: string;
  onClose?: () => void;
  embedded?: boolean;
}) {
  const router = useRouter();
  const close = () => (onClose ? onClose() : router.back());
  const { state: authState } = useAuth();
  const user = authState.user;

  const [report, setReport] = useState<GroundReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeEvents, setActiveEvents] = useState<HazardEvent[]>([]);

  // Officer action state
  const [activeAction, setActiveAction] = useState<'verify' | 'reject' | 'info' | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [decisionText, setDecisionText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [decisionSaved, setDecisionSaved] = useState('');
  const [creatingEvent, setCreatingEvent] = useState(false);

  // Submitter reply state
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  const permissions = getReportPermissions(user?.role);
  const isOfficer = permissions.canVerify;
  const isSubmitter = user && report && user.id === report.submitterId;

  const loadData = useCallback(async () => {
    if (!reportId) return;
    try {
      const data = await getReportById(reportId);
      setReport(data);

      if (data && data.submitterId === user?.id && data.status !== 'pending_verification') {
        markNotificationAsRead(
          data.id,
          data.status,
          data.verificationTimestamp || data.updatedAt || data.createdAt
        ).catch(() => {});
      }

      if (isOfficer || user?.role === 'dmc_officer') {
        const events = await getActiveEvents();
        setActiveEvents(events);
      }
    } catch (err) {
      console.warn('Failed to fetch report detail:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [reportId, isOfficer, user?.role, user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleOpenExternalMaps = () => {
    if (!report?.location) return;
    const { latitude, longitude } = report.location;
    const label = encodeURIComponent(report.locationName || 'Hazard Observation');
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${latitude},${longitude}`,
      android: `geo:0,0?q=${latitude},${longitude}(${label})`,
      default: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
    });
    if (url) {
      Linking.openURL(url).catch(() => {
        AppAlert.alert('Maps Error', 'Could not open native maps application.');
      });
    }
  };

  // Officer verification submission
  const handleConfirmVerify = async () => {
    if (!report || !user || actionLoading) return;
    setActionError('');
    if (!permissions.canVerify) {
      setActionError('Only DMC officers can review reports.');
      return;
    }
    try {
      setActionLoading(true);
      const chosenEvent = activeEvents.find(e => e.id === selectedEventId);
      await verifyReport(
        report.id,
        { uid: user.id, name: user.fullName, role: user.role },
        {
          hazardEventId: selectedEventId || null,
          hazardEventTitle: chosenEvent?.title || null,
          decisionNote: decisionText || 'Verified by DMC Duty Officer.',
        }
      );
      setDecisionSaved(
        selectedEventId
          ? 'Report verified and linked to the selected hazard event.'
          : 'Report verified. No hazard event was linked.'
      );
      setActiveAction(null);
      setDecisionText('');
      await loadData();
    } catch (err) {
      setActionError((err as Error)?.message || 'Could not save your decision. Try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Officer rejection submission
  const handleConfirmReject = async () => {
    if (!report || !user || actionLoading) return;
    setActionError('');
    if (!permissions.canVerify) {
      setActionError('Only DMC officers can review reports.');
      return;
    }
    if (!decisionText.trim()) {
      setActionError('Add a reason before rejecting this report.');
      return;
    }
    try {
      setActionLoading(true);
      await rejectReport(
        report.id,
        { uid: user.id, name: user.fullName, role: user.role },
        decisionText.trim()
      );
      setDecisionSaved('Report rejected. Your reason has been saved.');
      setActiveAction(null);
      setDecisionText('');
      await loadData();
    } catch (err) {
      setActionError((err as Error)?.message || 'Could not save your decision. Try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Officer request additional info
  const handleConfirmRequestInfo = async () => {
    if (!report || !user || actionLoading) return;
    setActionError('');
    if (!permissions.canVerify) {
      setActionError('Only DMC officers can review reports.');
      return;
    }
    if (!decisionText.trim()) {
      setActionError('Write a message explaining what information you need.');
      return;
    }
    try {
      setActionLoading(true);
      await requestAdditionalInfo(
        report.id,
        { uid: user.id, name: user.fullName, role: user.role },
        decisionText.trim()
      );
      setDecisionSaved(
        'Information requested. The submitter can now reply with the missing details.'
      );
      setActiveAction(null);
      setDecisionText('');
      await loadData();
    } catch (err) {
      setActionError((err as Error)?.message || 'Could not save your decision. Try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Submitter reply submission
  const handleSendAdditionalInfo = async () => {
    if (!report) return;
    if (!replyText.trim()) {
      AppAlert.alert('Input Required', 'Please enter your response before sending.');
      return;
    }
    try {
      setSubmittingReply(true);
      await submitAdditionalInfo(report.id, replyText.trim());
      AppAlert.alert(
        'Information Submitted',
        'Your clarification has been submitted. The report is now back in the verification queue.'
      );
      setReplyText('');
      await loadData();
    } catch (err) {
      AppAlert.alert('Submission Failed', (err as Error)?.message || 'Could not send details.');
    } finally {
      setSubmittingReply(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer
        edges={embedded ? [] : undefined}
        style={embedded ? styles.embedded : styles.screen}
        contentStyle={embedded ? styles.embeddedShell : styles.shell}
      >
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={LightColors.primary} />
          <Text style={styles.loadingText}>Loading report details...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (!report) {
    return (
      <ScreenContainer
        edges={embedded ? [] : undefined}
        style={embedded ? styles.embedded : styles.screen}
        contentStyle={embedded ? styles.embeddedShell : styles.shell}
      >
        <View style={styles.headerBar}>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.backButton}
            onPress={close}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerBarTitle}>Report Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <EmptyState
          appearance="light"
          iconName="document-text-outline"
          title="Report Not Found"
          message="The requested ground observation report could not be found or may have been deleted."
          actionTitle="Back to Reports"
          onAction={close}
        />
      </ScreenContainer>
    );
  }

  // Privacy & Access Restriction: Unverified reports are restricted to DMC Officers and the original submitter
  const canView = isOfficer || isSubmitter || report.status === 'verified';
  if (!canView) {
    return (
      <ScreenContainer
        edges={embedded ? [] : undefined}
        style={embedded ? styles.embedded : styles.screen}
        contentStyle={embedded ? styles.embeddedShell : styles.shell}
      >
        <View style={styles.headerBar}>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.backButton}
            onPress={close}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerBarTitle}>Access Restricted</Text>
          <View style={{ width: 40 }} />
        </View>
        <EmptyState
          appearance="light"
          iconName="shield-outline"
          title="Under Verification Review"
          message="This ground hazard observation is currently pending official verification by DMC Duty Officers and is not publicly visible yet."
          actionTitle="Back to Reports"
          onAction={close}
        />
      </ScreenContainer>
    );
  }

  const formattedCaptureTime = new Date(report.captureTime).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const formattedSubmitTime = new Date(report.createdAt).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <ScreenContainer
      edges={embedded ? [] : undefined}
      style={embedded ? styles.embedded : styles.screen}
      contentStyle={embedded ? styles.embeddedShell : styles.shell}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={LightColors.primary}
            colors={[LightColors.primary]}
          />
        }
      >
        {!embedded && (
          <ReportScreenHero
            title="Report details"
            caption="Community reports"
            description="Review the photos, location and latest updates for this hazard report."
            icon="document-text-outline"
            onBack={close}
            action={{ label: 'Refresh report', icon: 'reload-outline', onPress: onRefresh }}
          />
        )}
        {/* Status & Category Overview */}
        <View style={[styles.summaryCard, embedded && styles.embeddedSummary]}>
          <View style={styles.badgeRow}>
            <ObservationTypeBadge appearance="light" type={report.observationType} size="md" />
            <ReportStatusBadge appearance="light" status={report.status} size="md" />
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Report ID</Text>
              <Text style={styles.metaValueHighlight}>{report.referenceNumber}</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>District</Text>
              <Text style={styles.metaValue}>{report.district}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.metaRow}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Captured</Text>
              <Text style={styles.metaSubValue}>{formattedCaptureTime}</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Submitted</Text>
              <Text style={styles.metaSubValue}>{formattedSubmitTime}</Text>
            </View>
          </View>
        </View>

        {/* Evidence Photograph Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="camera-outline" size={20} color={LightColors.primary} />
            <Text style={styles.sectionTitle}>Photos</Text>
          </View>

          {report.photoUrls?.length || report.photoUrl ? (
            <ReportPhotoGallery
              urls={report.photoUrls?.length ? report.photoUrls : [report.photoUrl]}
            />
          ) : (
            <View style={styles.noPhotoPlaceholder}>
              <Ionicons name="image-outline" size={40} color={LightColors.mutedText} />
              <Text style={styles.noPhotoText}>No photograph attached with this report.</Text>
            </View>
          )}
        </View>

        {/* Description Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text-outline" size={20} color={LightColors.primary} />
            <Text style={styles.sectionTitle}>What happened</Text>
          </View>
          <Text style={styles.descriptionText}>{report.description}</Text>

          {/* Submitter Info Card */}
          <View style={styles.submitterBadgeContainer}>
            <View style={styles.submitterIconWrap}>
              <Ionicons
                name={report.submitterRole === 'volunteer' ? 'shield-checkmark' : 'person'}
                size={16}
                color={LightColors.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.submitterNameText}>{report.submitterName}</Text>
              <Text style={styles.submitterRoleText}>
                Role: {report.submitterRole.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Location & Coordinates Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="location-outline" size={20} color={LightColors.primary} />
            <Text style={styles.sectionTitle}>Location</Text>
          </View>

          <Text style={styles.locationNameText}>{report.locationName}</Text>

          {/* Map Preview or Coordinates Card */}
          {Platform.OS === 'web' && report.location ? (
            <View style={styles.mapContainer}>
              <iframe
                title="Hazard Location Map"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${(report.location.longitude - 0.015).toFixed(4)}%2C${(report.location.latitude - 0.015).toFixed(4)}%2C${(report.location.longitude + 0.015).toFixed(4)}%2C${(report.location.latitude + 0.015).toFixed(4)}&layer=mapnik&marker=${report.location.latitude.toFixed(5)}%2C${report.location.longitude.toFixed(5)}`}
                style={{ width: '100%', height: 200, border: 0, borderRadius: 12 }}
              />
            </View>
          ) : MapView && report.location ? (
            <View style={styles.mapContainer}>
              <MapView
                style={styles.miniMap}
                initialRegion={{
                  latitude: report.location.latitude,
                  longitude: report.location.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
              >
                {Marker && (
                  <Marker
                    coordinate={{
                      latitude: report.location.latitude,
                      longitude: report.location.longitude,
                    }}
                    title={report.locationName}
                    description={report.description.substring(0, 50)}
                  />
                )}
              </MapView>
            </View>
          ) : null}

          <View style={styles.coordsGrid}>
            <View style={styles.coordItem}>
              <Text style={styles.coordLabel}>Latitude</Text>
              <Text style={styles.coordValue}>{report.location.latitude.toFixed(6)}° N</Text>
            </View>
            <View style={styles.coordItem}>
              <Text style={styles.coordLabel}>Longitude</Text>
              <Text style={styles.coordValue}>{report.location.longitude.toFixed(6)}° E</Text>
            </View>
            {report.location.accuracy != null && (
              <View style={styles.coordItem}>
                <Text style={styles.coordLabel}>Accuracy</Text>
                <Text style={styles.coordValue}>±{report.location.accuracy.toFixed(0)}m</Text>
              </View>
            )}
            <View style={styles.coordItem}>
              <Text style={styles.coordLabel}>Fix Type</Text>
              <Text style={styles.coordValue}>
                {report.isManualLocation ? 'Manual Pin' : 'GPS Fix'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            style={styles.openMapsButton}
            onPress={handleOpenExternalMaps}
          >
            <Ionicons name="navigate-outline" size={16} color={LightColors.primary} />
            <Text style={styles.openMapsButtonText}>Open in Maps</Text>
          </TouchableOpacity>
        </View>

        {/* Existing Decision / Clarification History */}
        {report.status === 'verified' && (
          <View style={[styles.sectionCard, styles.verifiedCardBorder]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="checkmark-circle" size={20} color={'#07834B'} />
              <Text style={[styles.sectionTitle, { color: '#07834B' }]}>Report verified</Text>
            </View>
            <Text style={styles.decisionBodyText}>
              {report.verificationDecision ||
                'This observation was verified by the DMC Duty Officer.'}
            </Text>
            {!report.hazardEventId && (
              <Text style={styles.decisionBodyText}>
                Verified independently. No related hazard event.
              </Text>
            )}
            {report.hazardEventTitle && (
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.linkedEventBox}
                activeOpacity={report.hazardEventId ? 0.75 : 1}
                onPress={() => {
                  if (report.hazardEventId) {
                    onClose?.();
                    router.push(`/(app)/warnings/${report.hazardEventId}` as never);
                  }
                }}
              >
                <View style={{ width: '100%' }}>
                  <View style={styles.linkedEventHeaderRow}>
                    <Ionicons name="link-outline" size={13} color={LightColors.primary} />
                    <Text style={styles.linkedEventLabel}>Related hazard event</Text>
                  </View>
                  <Text style={styles.linkedEventTitle}>{report.hazardEventTitle}</Text>
                </View>
                {report.hazardEventId && (
                  <View style={styles.viewEventAction}>
                    <Text style={styles.viewEventActionText}>View event details</Text>
                    <Ionicons name="arrow-forward" size={12} color={LightColors.primary} />
                  </View>
                )}
              </TouchableOpacity>
            )}
            <View style={styles.decisionFooter}>
              <Text style={styles.decisionOfficerText}>
                Officer: {report.verifiedByName || 'DMC Officer'}
              </Text>
              {report.verificationTimestamp && (
                <Text style={styles.decisionTimeText}>
                  {new Date(report.verificationTimestamp).toLocaleDateString()}
                </Text>
              )}
            </View>
          </View>
        )}

        {report.status === 'rejected' && (
          <View style={[styles.sectionCard, styles.rejectedCardBorder]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="close-circle" size={20} color={LightColors.danger} />
              <Text style={[styles.sectionTitle, { color: LightColors.danger }]}>
                Report Rejected
              </Text>
            </View>
            <Text style={styles.decisionBodyText}>
              {report.verificationDecision || 'This report was not verified as hazardous.'}
            </Text>
            <View style={styles.decisionFooter}>
              <Text style={styles.decisionOfficerText}>
                Officer: {report.verifiedByName || 'DMC Officer'}
              </Text>
              {report.verificationTimestamp && (
                <Text style={styles.decisionTimeText}>
                  {new Date(report.verificationTimestamp).toLocaleDateString()}
                </Text>
              )}
            </View>
          </View>
        )}

        {report.status === 'info_requested' && (
          <View style={[styles.sectionCard, styles.infoCardBorder]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="help-circle" size={20} color={LightColors.primary} />
              <Text style={[styles.sectionTitle, { color: LightColors.primary }]}>
                Additional Information Requested
              </Text>
            </View>
            <Text style={styles.decisionBodyText}>
              {report.infoRequestedMessage || 'The duty officer requested further clarification.'}
            </Text>
            <View style={styles.decisionFooter}>
              <Text style={styles.decisionOfficerText}>
                From: {report.verifiedByName || 'DMC Duty Officer'}
              </Text>
            </View>

            {/* Submitter response field */}
            {isSubmitter && (
              <View style={styles.replyBox}>
                <Text style={styles.replyBoxLabel}>Your Clarification Response:</Text>
                <TextInput
                  style={styles.replyInput}
                  multiline
                  numberOfLines={4}
                  placeholder="Provide additional details regarding the water level, road blockage, or specific landmarks..."
                  placeholderTextColor={LightColors.mutedText}
                  value={replyText}
                  onChangeText={setReplyText}
                />
                <TouchableOpacity
                  accessibilityRole="button"
                  style={[styles.replySubmitBtn, submittingReply && styles.btnDisabled]}
                  onPress={handleSendAdditionalInfo}
                  disabled={submittingReply}
                >
                  {submittingReply ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="paper-plane-outline" size={16} color="#FFF" />
                      <Text style={styles.replySubmitBtnText}>Submit Clarification</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {report.additionalInfo ? (
              <View style={styles.previousReplyBox}>
                <Text style={styles.previousReplyLabel}>Latest Submitter Clarification:</Text>
                <Text style={styles.previousReplyText}>{report.additionalInfo}</Text>
              </View>
            ) : null}
          </View>
        )}

        {isOfficer && Boolean(decisionSaved) && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Decision saved</Text>
            <Text style={styles.decisionBodyText}>{decisionSaved}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Back to reports"
              onPress={close}
              style={styles.openMapsButton}
            >
              <Text style={styles.openMapsButtonText}>Back to reports</Text>
              <Ionicons name="arrow-forward" size={18} color={LightColors.primary} />
            </TouchableOpacity>
          </View>
        )}
        {isOfficer &&
          !decisionSaved &&
          (report.status === 'pending_verification' || report.status === 'info_requested') && (
            <ReportReviewPanel
              action={activeAction}
              onAction={action => {
                setActiveAction(action);
                setDecisionText('');
                setActionError('');
              }}
              events={activeEvents}
              eventId={selectedEventId}
              onEvent={setSelectedEventId}
              onAddEvent={() => setCreatingEvent(true)}
              note={decisionText}
              onNote={setDecisionText}
              busy={actionLoading}
              error={actionError}
              onSubmit={() => {
                void (activeAction === 'verify'
                  ? handleConfirmVerify()
                  : activeAction === 'reject'
                    ? handleConfirmReject()
                    : handleConfirmRequestInfo());
              }}
            />
          )}

        <View style={{ height: Spacing.xl * 2 }} />
      </ScrollView>
      {creatingEvent && isOfficer && (
        <CreateHazardEventModal
          district={report.district}
          onClose={() => setCreatingEvent(false)}
          onCreated={event => {
            setActiveEvents(events => [event, ...events.filter(item => item.id !== event.id)]);
            setSelectedEventId(event.id);
            setCreatingEvent(false);
          }}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  embedded: { backgroundColor: LightColors.background },
  embeddedShell: {
    backgroundColor: LightColors.background,
    borderWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    shadowOpacity: 0,
  },
  embeddedSummary: { marginTop: 16 },
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
  },
  refreshIconButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.16)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: { paddingBottom: 24 },
  summaryCard: {
    marginHorizontal: 18,
    marginTop: -24,
    shadowColor: '#154893',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
    backgroundColor: LightColors.surface,
    borderRadius: 20,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: LightColors.border,
    marginBottom: 13,
  },
  badgeRow: {
    flexWrap: 'wrap',
    gap: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  metaRow: { flexWrap: 'wrap', gap: 12, flexDirection: 'row', justifyContent: 'space-between' },
  metaCol: { minWidth: 125, flex: 1 },
  metaLabel: {
    ...MobileTypography.caption,
    color: LightColors.mutedText,
    fontWeight: '600',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  metaValueHighlight: {
    ...MobileTypography.body,
    fontWeight: '700',
    color: LightColors.primary,
  },
  metaValue: {
    ...MobileTypography.body,
    fontWeight: '600',
    color: LightColors.text,
  },
  metaSubValue: {
    ...MobileTypography.label,
    color: LightColors.secondaryText,
  },
  divider: {
    height: 1,
    backgroundColor: LightColors.border,
    marginVertical: Spacing.sm,
  },
  sectionCard: {
    marginHorizontal: 18,
    backgroundColor: LightColors.surface,
    borderRadius: 20,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: LightColors.border,
    marginBottom: 13,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  sectionTitle: { flex: 1, ...MobileTypography.body, fontWeight: '700', color: LightColors.text },
  photoContainer: {
    width: '100%',
    height: 240,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    backgroundColor: LightColors.surfaceMuted,
    position: 'relative',
  },
  evidenceImage: {
    width: '100%',
    height: '100%',
  },
  zoomHintBadge: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.65)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  zoomHintText: {
    color: '#FFF',
    ...MobileTypography.caption,
    fontWeight: '600',
  },
  noPhotoPlaceholder: {
    padding: Spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: LightColors.surfaceMuted,
    borderRadius: BorderRadius.md,
  },
  noPhotoText: {
    marginTop: Spacing.sm,
    ...MobileTypography.label,
    color: LightColors.mutedText,
    textAlign: 'center',
  },
  descriptionText: {
    ...MobileTypography.body,
    color: LightColors.text,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  submitterBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: LightColors.surfaceMuted,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  submitterIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: LightColors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitterNameText: {
    ...MobileTypography.label,
    fontWeight: '600',
    color: LightColors.text,
  },
  submitterRoleText: {
    ...MobileTypography.caption,
    color: LightColors.mutedText,
  },
  locationNameText: {
    ...MobileTypography.body,
    fontWeight: '600',
    color: LightColors.text,
    marginBottom: Spacing.sm,
  },
  mapContainer: {
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  miniMap: {
    width: '100%',
    height: '100%',
  },
  coordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  coordItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: LightColors.surfaceMuted,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  coordLabel: {
    ...MobileTypography.caption,
    color: LightColors.mutedText,
  },
  coordValue: {
    ...MobileTypography.label,
    fontWeight: '600',
    color: LightColors.text,
    marginTop: 2,
  },
  openMapsButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: LightColors.primary,
    borderRadius: BorderRadius.md,
  },
  openMapsButtonText: {
    ...MobileTypography.label,
    color: LightColors.primary,
    fontWeight: '600',
  },
  verifiedCardBorder: {
    borderColor: '#07834B',
    borderLeftWidth: 4,
  },
  rejectedCardBorder: {
    borderColor: LightColors.danger,
    borderLeftWidth: 4,
  },
  infoCardBorder: {
    borderColor: LightColors.primary,
    borderLeftWidth: 4,
  },
  decisionBodyText: {
    ...MobileTypography.body,
    color: LightColors.text,
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
  linkedEventBox: {
    flexWrap: 'wrap',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EAF2FF',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#C9DCFF',
    padding: Spacing.md,
    marginVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  linkedEventHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 3,
  },
  linkedEventLabel: {
    ...MobileTypography.badge,
    fontWeight: '800',
    color: LightColors.primary,
    letterSpacing: 0.6,
  },
  linkedEventTitle: {
    ...MobileTypography.label,
    fontWeight: '700',
    color: LightColors.text,
  },
  viewEventAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EAF2FF',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: '#C9DCFF',
  },
  viewEventActionText: {
    ...MobileTypography.badge,
    fontWeight: '800',
    color: LightColors.primary,
  },
  decisionFooter: {
    flexWrap: 'wrap',
    gap: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  decisionOfficerText: {
    ...MobileTypography.caption,
    color: LightColors.secondaryText,
    fontWeight: '500',
  },
  decisionTimeText: {
    ...MobileTypography.caption,
    color: LightColors.mutedText,
  },
  replyBox: {
    marginTop: Spacing.md,
    backgroundColor: LightColors.surfaceMuted,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  replyBoxLabel: {
    ...MobileTypography.label,
    fontWeight: '600',
    color: LightColors.text,
    marginBottom: Spacing.xs,
  },
  replyInput: {
    backgroundColor: LightColors.surface,
    borderWidth: 1,
    borderColor: LightColors.border,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    color: LightColors.text,
    ...MobileTypography.label,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: Spacing.sm,
  },
  replySubmitBtn: {
    minHeight: 48,
    backgroundColor: LightColors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  replySubmitBtnText: {
    color: '#FFF',
    ...MobileTypography.label,
    fontWeight: '700',
  },
  previousReplyBox: {
    marginTop: Spacing.sm,
    backgroundColor: LightColors.surfaceMuted,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  previousReplyLabel: {
    ...MobileTypography.caption,
    fontWeight: '700',
    color: LightColors.mutedText,
    marginBottom: 2,
  },
  previousReplyText: {
    ...MobileTypography.label,
    color: LightColors.text,
  },
  officerPanelCard: {
    marginHorizontal: 18,
    backgroundColor: LightColors.surface,
    borderRadius: 20,
    padding: Spacing.lg,
    borderWidth: 1.5,
    borderColor: LightColors.primary,
    marginBottom: 13,
  },
  officerPanelHint: {
    ...MobileTypography.caption,
    color: LightColors.secondaryText,
    marginBottom: Spacing.md,
  },
  actionButtonRow: { flexWrap: 'wrap', flexDirection: 'row', gap: Spacing.sm },
  actionButton: {
    minHeight: 48,
    minWidth: 85,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  verifyBtn: {
    backgroundColor: '#07834B',
  },
  rejectBtn: {
    backgroundColor: LightColors.danger,
  },
  infoBtn: {
    backgroundColor: LightColors.primary,
  },
  actionButtonActive: {
    borderWidth: 2,
    borderColor: '#FFF',
  },
  actionBtnText: {
    color: '#FFF',
    ...MobileTypography.label,
    fontWeight: '700',
  },
  subActionForm: {
    marginTop: Spacing.md,
    backgroundColor: LightColors.surfaceMuted,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  subActionFormTitle: {
    ...MobileTypography.label,
    fontWeight: '700',
    color: LightColors.text,
    marginBottom: Spacing.sm,
  },
  inputLabel: {
    ...MobileTypography.caption,
    color: LightColors.secondaryText,
    marginBottom: 4,
    fontWeight: '600',
  },
  eventChipScroll: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  eventChip: {
    backgroundColor: LightColors.surface,
    borderWidth: 1,
    borderColor: LightColors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.xs,
  },
  eventChipSelected: {
    backgroundColor: LightColors.primary,
    borderColor: LightColors.primary,
  },
  eventChipText: {
    ...MobileTypography.caption,
    color: LightColors.secondaryText,
  },
  eventChipTextSelected: {
    color: '#FFF',
    fontWeight: '700',
  },
  actionTextInput: {
    backgroundColor: LightColors.surface,
    borderWidth: 1,
    borderColor: LightColors.border,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    color: LightColors.text,
    ...MobileTypography.label,
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: Spacing.sm,
  },
  confirmActionButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmVerifyBtn: {
    backgroundColor: '#07834B',
  },
  confirmRejectBtn: {
    backgroundColor: LightColors.danger,
  },
  confirmInfoBtn: {
    backgroundColor: LightColors.primary,
  },
  confirmActionBtnText: {
    color: '#FFF',
    ...MobileTypography.label,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  modalImage: {
    width: '94%',
    height: '75%',
  },
  modalCaption: {
    color: '#FFF',
    ...MobileTypography.label,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
});
