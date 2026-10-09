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
  Alert,
  Platform,
  Linking,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ScreenContainer';
import { ReportStatusBadge } from '@/components/ReportStatusBadge';
import { ObservationTypeBadge } from '@/components/ObservationTypeBadge';
import { EmptyState } from '@/components/EmptyState';
import { Colors, BorderRadius, Spacing, FontSize } from '@/constants/colors';
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
try {
  /* eslint-disable-next-line @typescript-eslint/no-require-imports */
  const maps = require('react-native-maps');
  MapView = maps.default || maps.MapView;
  Marker = maps.Marker;
} catch {
  MapView = null;
  Marker = null;
}

export default function ReportDetailScreen() {
  const { reportId } = useLocalSearchParams<{ reportId: string }>();
  const router = useRouter();
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

  // Submitter reply state
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // Full screen photo modal
  const [photoModalOpen, setPhotoModalOpen] = useState(false);

  const permissions = getReportPermissions(user?.role);
  const isOfficer = permissions.canVerify;
  const isSubmitter = user && report && user.id === report.submitterId;

  const loadData = useCallback(async () => {
    if (!reportId) return;
    try {
      const data = await getReportById(reportId);
      setReport(data);

      if (data && data.status !== 'pending_verification') {
        markNotificationAsRead(data.id, data.status).catch(() => {});
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
  }, [reportId, isOfficer, user?.role]);

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
        Alert.alert('Maps Error', 'Could not open native maps application.');
      });
    }
  };

  // Officer verification submission
  const handleConfirmVerify = async () => {
    if (!report || !user) return;
    if (!permissions.canVerify) {
      Alert.alert('Unauthorized', 'Only DMC Duty Officers have verification authority.');
      return;
    }
    try {
      setActionLoading(true);
      const chosenEvent = activeEvents.find((e) => e.id === selectedEventId);
      await verifyReport(
        report.id,
        { uid: user.id, name: user.fullName, role: user.role },
        {
          hazardEventId: selectedEventId || null,
          hazardEventTitle: chosenEvent?.title || null,
          decisionNote: decisionText || 'Verified by DMC Duty Officer.',
        },
      );
      Alert.alert('Report Verified', 'The observation has been officially verified and linked.');
      setActiveAction(null);
      setDecisionText('');
      await loadData();
    } catch (err) {
      Alert.alert('Verification Failed', (err as Error)?.message || 'An error occurred.');
    } finally {
      setActionLoading(false);
    }
  };

  // Officer rejection submission
  const handleConfirmReject = async () => {
    if (!report || !user) return;
    if (!permissions.canVerify) {
      Alert.alert('Unauthorized', 'Only DMC Duty Officers have verification authority.');
      return;
    }
    if (!decisionText.trim()) {
      Alert.alert('Reason Required', 'Please provide an official justification for rejection.');
      return;
    }
    try {
      setActionLoading(true);
      await rejectReport(
        report.id,
        { uid: user.id, name: user.fullName, role: user.role },
        decisionText.trim(),
      );
      Alert.alert('Report Rejected', 'The report has been rejected and logged.');
      setActiveAction(null);
      setDecisionText('');
      await loadData();
    } catch (err) {
      Alert.alert('Rejection Failed', (err as Error)?.message || 'An error occurred.');
    } finally {
      setActionLoading(false);
    }
  };

  // Officer request additional info
  const handleConfirmRequestInfo = async () => {
    if (!report || !user) return;
    if (!permissions.canVerify) {
      Alert.alert('Unauthorized', 'Only DMC Duty Officers have verification authority.');
      return;
    }
    if (!decisionText.trim()) {
      Alert.alert('Instructions Required', 'Please provide questions or guidance for the submitter.');
      return;
    }
    try {
      setActionLoading(true);
      await requestAdditionalInfo(
        report.id,
        { uid: user.id, name: user.fullName, role: user.role },
        decisionText.trim(),
      );
      Alert.alert('Request Sent', 'The submitter has been notified to provide clarification.');
      setActiveAction(null);
      setDecisionText('');
      await loadData();
    } catch (err) {
      Alert.alert('Request Failed', (err as Error)?.message || 'An error occurred.');
    } finally {
      setActionLoading(false);
    }
  };

  // Submitter reply submission
  const handleSendAdditionalInfo = async () => {
    if (!report) return;
    if (!replyText.trim()) {
      Alert.alert('Input Required', 'Please enter your response before sending.');
      return;
    }
    try {
      setSubmittingReply(true);
      await submitAdditionalInfo(report.id, replyText.trim());
      Alert.alert(
        'Information Submitted',
        'Your clarification has been submitted. The report is now back in the verification queue.',
      );
      setReplyText('');
      await loadData();
    } catch (err) {
      Alert.alert('Submission Failed', (err as Error)?.message || 'Could not send details.');
    } finally {
      setSubmittingReply(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.accent.primary} />
          <Text style={styles.loadingText}>Loading report details...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (!report) {
    return (
      <ScreenContainer>
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerBarTitle}>Report Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <EmptyState
          iconName="document-text-outline"
          title="Report Not Found"
          message="The requested ground observation report could not be found or may have been deleted."
          actionTitle="Back to Reports"
          onAction={() => router.back()}
        />
      </ScreenContainer>
    );
  }

  // Privacy & Access Restriction: Unverified reports are restricted to DMC Officers and the original submitter
  const canView = isOfficer || isSubmitter || report.status === 'verified';
  if (!canView) {
    return (
      <ScreenContainer>
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerBarTitle}>Access Restricted</Text>
          <View style={{ width: 40 }} />
        </View>
        <EmptyState
          iconName="shield-outline"
          title="Under Verification Review"
          message="This ground hazard observation is currently pending official verification by DMC Duty Officers and is not publicly visible yet."
          actionTitle="Back to Reports"
          onAction={() => router.back()}
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
    <ScreenContainer>
      {/* Top Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerBarTitle} numberOfLines={1}>
            {report.referenceNumber}
          </Text>
          <Text style={styles.headerBarSubtitle}>Ground Hazard Observation</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshIconButton}
          onPress={onRefresh}
          accessibilityLabel="Refresh report"
        >
          <Ionicons name="reload-outline" size={20} color={Colors.text.secondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent.primary}
            colors={[Colors.accent.primary]}
          />
        }
      >
        {/* Status & Category Overview */}
        <View style={styles.summaryCard}>
          <View style={styles.badgeRow}>
            <ObservationTypeBadge type={report.observationType} size="md" />
            <ReportStatusBadge status={report.status} size="md" />
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>REFERENCE ID</Text>
              <Text style={styles.metaValueHighlight}>{report.referenceNumber}</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>DISTRICT</Text>
              <Text style={styles.metaValue}>{report.district}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.metaRow}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>CAPTURED TIME</Text>
              <Text style={styles.metaSubValue}>{formattedCaptureTime}</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>SUBMITTED AT</Text>
              <Text style={styles.metaSubValue}>{formattedSubmitTime}</Text>
            </View>
          </View>
        </View>

        {/* Evidence Photograph Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="camera-outline" size={20} color={Colors.accent.primary} />
            <Text style={styles.sectionTitle}>Photographic Evidence</Text>
          </View>

          {report.photoUrl ? (
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.photoContainer}
              onPress={() => setPhotoModalOpen(true)}
            >
              <Image
                source={{ uri: report.photoUrl }}
                style={styles.evidenceImage}
                contentFit="cover"
                transition={300}
              />
              <View style={styles.zoomHintBadge}>
                <Ionicons name="expand-outline" size={14} color="#FFF" />
                <Text style={styles.zoomHintText}>Tap to enlarge</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.noPhotoPlaceholder}>
              <Ionicons name="image-outline" size={40} color={Colors.text.muted} />
              <Text style={styles.noPhotoText}>No photograph attached with this report.</Text>
            </View>
          )}
        </View>

        {/* Description Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text-outline" size={20} color={Colors.accent.primary} />
            <Text style={styles.sectionTitle}>Hazard Description</Text>
          </View>
          <Text style={styles.descriptionText}>{report.description}</Text>

          {/* Submitter Info Card */}
          <View style={styles.submitterBadgeContainer}>
            <View style={styles.submitterIconWrap}>
              <Ionicons
                name={report.submitterRole === 'volunteer' ? 'shield-checkmark' : 'person'}
                size={16}
                color={Colors.accent.primary}
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
            <Ionicons name="location-outline" size={20} color={Colors.accent.primary} />
            <Text style={styles.sectionTitle}>Observation Location</Text>
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
            style={styles.openMapsButton}
            onPress={handleOpenExternalMaps}
          >
            <Ionicons name="navigate-outline" size={16} color={Colors.accent.primary} />
            <Text style={styles.openMapsButtonText}>Open in Google Maps / Apple Maps</Text>
          </TouchableOpacity>
        </View>

        {/* Existing Decision / Clarification History */}
        {report.status === 'verified' && (
          <View style={[styles.sectionCard, styles.verifiedCardBorder]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.status.success} />
              <Text style={[styles.sectionTitle, { color: Colors.status.success }]}>
                Verified Assessment
              </Text>
            </View>
            <Text style={styles.decisionBodyText}>
              {report.verificationDecision || 'This observation was verified by the DMC Duty Officer.'}
            </Text>
            {report.hazardEventTitle && (
              <TouchableOpacity
                style={styles.linkedEventBox}
                activeOpacity={report.hazardEventId ? 0.75 : 1}
                onPress={() => {
                  if (report.hazardEventId) {
                    router.push(`/(app)/warnings/${report.hazardEventId}` as never);
                  }
                }}
              >
                <View style={{ flex: 1 }}>
                  <View style={styles.linkedEventHeaderRow}>
                    <Ionicons name="link-outline" size={13} color={Colors.accent.primary} />
                    <Text style={styles.linkedEventLabel}>LINKED OPEN HAZARD EVENT</Text>
                  </View>
                  <Text style={styles.linkedEventTitle}>{report.hazardEventTitle}</Text>
                </View>
                {report.hazardEventId && (
                  <View style={styles.viewEventAction}>
                    <Text style={styles.viewEventActionText}>View Event</Text>
                    <Ionicons name="arrow-forward" size={12} color={Colors.accent.primary} />
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
              <Ionicons name="close-circle" size={20} color={Colors.status.danger} />
              <Text style={[styles.sectionTitle, { color: Colors.status.danger }]}>
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
              <Ionicons name="help-circle" size={20} color={Colors.report.infoRequested} />
              <Text style={[styles.sectionTitle, { color: Colors.report.infoRequested }]}>
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
                  placeholderTextColor={Colors.text.muted}
                  value={replyText}
                  onChangeText={setReplyText}
                />
                <TouchableOpacity
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

        {/* Officer Review Panel (DMC Officer only when Pending or Info Requested) */}
        {isOfficer && (report.status === 'pending_verification' || report.status === 'info_requested') && (
          <View style={styles.officerPanelCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="shield-checkmark-outline" size={20} color={Colors.accent.primary} />
              <Text style={styles.sectionTitle}>DMC Officer Verification Actions</Text>
            </View>
            <Text style={styles.officerPanelHint}>
              Review the hazard observation evidence against active early-warning events.
            </Text>

            {/* Action Buttons */}
            <View style={styles.actionButtonRow}>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.verifyBtn,
                  activeAction === 'verify' && styles.actionButtonActive,
                ]}
                onPress={() => setActiveAction(activeAction === 'verify' ? null : 'verify')}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
                <Text style={styles.actionBtnText}>Verify</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.rejectBtn,
                  activeAction === 'reject' && styles.actionButtonActive,
                ]}
                onPress={() => setActiveAction(activeAction === 'reject' ? null : 'reject')}
              >
                <Ionicons name="close-circle-outline" size={18} color="#FFF" />
                <Text style={styles.actionBtnText}>Reject</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.infoBtn,
                  activeAction === 'info' && styles.actionButtonActive,
                ]}
                onPress={() => setActiveAction(activeAction === 'info' ? null : 'info')}
              >
                <Ionicons name="help-circle-outline" size={18} color="#FFF" />
                <Text style={styles.actionBtnText}>Ask Info</Text>
              </TouchableOpacity>
            </View>

            {/* Active Action Sub-forms */}
            {activeAction === 'verify' && (
              <View style={styles.subActionForm}>
                <Text style={styles.subActionFormTitle}>Verify and Attach to Hazard Event</Text>
                <Text style={styles.inputLabel}>Select Hazard Event (Optional):</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.eventChipScroll}>
                  <TouchableOpacity
                    style={[
                      styles.eventChip,
                      selectedEventId === '' && styles.eventChipSelected,
                    ]}
                    onPress={() => setSelectedEventId('')}
                  >
                    <Text
                      style={[
                        styles.eventChipText,
                        selectedEventId === '' && styles.eventChipTextSelected,
                      ]}
                    >
                      None (Standalone)
                    </Text>
                  </TouchableOpacity>
                  {activeEvents.map((ev) => (
                    <TouchableOpacity
                      key={ev.id}
                      style={[
                        styles.eventChip,
                        selectedEventId === ev.id && styles.eventChipSelected,
                      ]}
                      onPress={() => setSelectedEventId(ev.id)}
                    >
                      <Text
                        style={[
                          styles.eventChipText,
                          selectedEventId === ev.id && styles.eventChipTextSelected,
                        ]}
                      >
                        {ev.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.inputLabel}>Verification Note / Decision Summary:</Text>
                <TextInput
                  style={styles.actionTextInput}
                  placeholder="e.g. Confirmed flood height over 0.5m. Alert issued to sector 4."
                  placeholderTextColor={Colors.text.muted}
                  multiline
                  value={decisionText}
                  onChangeText={setDecisionText}
                />

                <TouchableOpacity
                  style={[styles.confirmActionButton, styles.confirmVerifyBtn, actionLoading && styles.btnDisabled]}
                  onPress={handleConfirmVerify}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.confirmActionBtnText}>Confirm Official Verification</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {activeAction === 'reject' && (
              <View style={styles.subActionForm}>
                <Text style={styles.subActionFormTitle}>Reject Ground Report</Text>
                <Text style={styles.inputLabel}>Justification / Reason (Required):</Text>
                <TextInput
                  style={styles.actionTextInput}
                  placeholder="e.g. Duplicate report, insufficient evidence, or normal water levels observed."
                  placeholderTextColor={Colors.text.muted}
                  multiline
                  value={decisionText}
                  onChangeText={setDecisionText}
                />

                <TouchableOpacity
                  style={[styles.confirmActionButton, styles.confirmRejectBtn, actionLoading && styles.btnDisabled]}
                  onPress={handleConfirmReject}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.confirmActionBtnText}>Confirm Rejection</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {activeAction === 'info' && (
              <View style={styles.subActionForm}>
                <Text style={styles.subActionFormTitle}>Request Additional Details</Text>
                <Text style={styles.inputLabel}>Instructions for Citizen/Volunteer (Required):</Text>
                <TextInput
                  style={styles.actionTextInput}
                  placeholder="e.g. Please clarify if the culvert is obstructed or if vehicles can pass."
                  placeholderTextColor={Colors.text.muted}
                  multiline
                  value={decisionText}
                  onChangeText={setDecisionText}
                />

                <TouchableOpacity
                  style={[styles.confirmActionButton, styles.confirmInfoBtn, actionLoading && styles.btnDisabled]}
                  onPress={handleConfirmRequestInfo}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.confirmActionBtnText}>Send Request to Submitter</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        <View style={{ height: Spacing.xl * 2 }} />
      </ScrollView>

      {/* Full Screen Photo Modal */}
      <Modal
        visible={photoModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.modalCloseBtn}
            onPress={() => setPhotoModalOpen(false)}
          >
            <Ionicons name="close" size={28} color="#FFF" />
          </TouchableOpacity>
          {report.photoUrl ? (
            <Image
              source={{ uri: report.photoUrl }}
              style={styles.modalImage}
              contentFit="contain"
            />
          ) : null}
          <Text style={styles.modalCaption}>{report.locationName}</Text>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text.secondary,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.bg.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: Spacing.sm,
  },
  headerBarTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  headerBarSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.text.muted,
  },
  refreshIconButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.bg.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  summaryCard: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
    marginBottom: Spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    fontWeight: '600',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  metaValueHighlight: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.accent.primary,
  },
  metaValue: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  metaSubValue: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border.default,
    marginVertical: Spacing.sm,
  },
  sectionCard: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  photoContainer: {
    width: '100%',
    height: 240,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    backgroundColor: Colors.input.bg,
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
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  noPhotoPlaceholder: {
    padding: Spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.input.bg,
    borderRadius: BorderRadius.md,
  },
  noPhotoText: {
    marginTop: Spacing.sm,
    fontSize: FontSize.sm,
    color: Colors.text.muted,
    textAlign: 'center',
  },
  descriptionText: {
    fontSize: FontSize.md,
    color: Colors.text.primary,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  submitterBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.input.bg,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  submitterIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.bg.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitterNameText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  submitterRoleText: {
    fontSize: FontSize.xs,
    color: Colors.text.muted,
  },
  locationNameText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  mapContainer: {
    width: '100%',
    height: 160,
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
    backgroundColor: Colors.input.bg,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  coordLabel: {
    fontSize: FontSize.xs,
    color: Colors.text.muted,
  },
  coordValue: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: 2,
  },
  openMapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.accent.primary,
    borderRadius: BorderRadius.md,
  },
  openMapsButtonText: {
    fontSize: FontSize.sm,
    color: Colors.accent.primary,
    fontWeight: '600',
  },
  verifiedCardBorder: {
    borderColor: Colors.status.success,
    borderLeftWidth: 4,
  },
  rejectedCardBorder: {
    borderColor: Colors.status.danger,
    borderLeftWidth: 4,
  },
  infoCardBorder: {
    borderColor: Colors.report.infoRequested,
    borderLeftWidth: 4,
  },
  decisionBodyText: {
    fontSize: FontSize.md,
    color: Colors.text.primary,
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
  linkedEventBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
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
    fontSize: FontSize.micro,
    fontWeight: '800',
    color: Colors.accent.primary,
    letterSpacing: 0.6,
  },
  linkedEventTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  viewEventAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  viewEventActionText: {
    fontSize: FontSize.micro,
    fontWeight: '800',
    color: Colors.accent.primary,
  },
  decisionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  decisionOfficerText: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  decisionTimeText: {
    fontSize: FontSize.xs,
    color: Colors.text.muted,
  },
  replyBox: {
    marginTop: Spacing.md,
    backgroundColor: Colors.input.bg,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  replyBoxLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  replyInput: {
    backgroundColor: Colors.bg.secondary,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: Spacing.sm,
  },
  replySubmitBtn: {
    backgroundColor: Colors.report.infoRequested,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  replySubmitBtnText: {
    color: '#FFF',
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  previousReplyBox: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.input.bg,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  previousReplyLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.text.muted,
    marginBottom: 2,
  },
  previousReplyText: {
    fontSize: FontSize.sm,
    color: Colors.text.primary,
  },
  officerPanelCard: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1.5,
    borderColor: Colors.accent.primary,
    marginBottom: Spacing.md,
  },
  officerPanelHint: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    marginBottom: Spacing.md,
  },
  actionButtonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  verifyBtn: {
    backgroundColor: Colors.report.verified,
  },
  rejectBtn: {
    backgroundColor: Colors.report.rejected,
  },
  infoBtn: {
    backgroundColor: Colors.report.infoRequested,
  },
  actionButtonActive: {
    borderWidth: 2,
    borderColor: '#FFF',
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  subActionForm: {
    marginTop: Spacing.md,
    backgroundColor: Colors.input.bg,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  subActionFormTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  inputLabel: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    marginBottom: 4,
    fontWeight: '600',
  },
  eventChipScroll: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  eventChip: {
    backgroundColor: Colors.bg.secondary,
    borderWidth: 1,
    borderColor: Colors.border.default,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.xs,
  },
  eventChipSelected: {
    backgroundColor: Colors.accent.primary,
    borderColor: Colors.accent.primary,
  },
  eventChipText: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
  },
  eventChipTextSelected: {
    color: '#FFF',
    fontWeight: '700',
  },
  actionTextInput: {
    backgroundColor: Colors.bg.secondary,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    color: Colors.text.primary,
    fontSize: FontSize.sm,
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
    backgroundColor: Colors.report.verified,
  },
  confirmRejectBtn: {
    backgroundColor: Colors.report.rejected,
  },
  confirmInfoBtn: {
    backgroundColor: Colors.report.infoRequested,
  },
  confirmActionBtnText: {
    color: '#FFF',
    fontSize: FontSize.sm,
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
    fontSize: FontSize.sm,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
});
