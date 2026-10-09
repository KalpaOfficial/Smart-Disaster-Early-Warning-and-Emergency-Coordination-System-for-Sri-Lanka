/**
 * Report Detail Modal Component for UC02: Submit and Verify Ground Report.
 * Displays high-resolution evidence photo, interactive coordinates, metadata,
 * and officer review verification controls (Verify, Reject, Request Info).
 */
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ReportStatusBadge } from './ReportStatusBadge';
import { ObservationTypeBadge } from './ObservationTypeBadge';
import { Colors, BorderRadius, Spacing, FontSize } from '@/constants/colors';
import type { GroundReport } from '@/types/groundReport';
import type { HazardEvent } from '@/types/resources';

interface ReportDetailModalProps {
  visible: boolean;
  report: GroundReport | null;
  onClose: () => void;
  onOpenFullScreen?: (reportId: string) => void;
  onOpenLinkedEvent?: (hazardEventId: string) => void;
  isOfficer?: boolean;
  activeEvents?: HazardEvent[];
  onVerify?: (
    reportId: string,
    hazardEventId?: string | null,
    hazardEventTitle?: string | null,
    decisionNote?: string,
  ) => Promise<void>;
  onReject?: (reportId: string, reason: string) => Promise<void>;
  onRequestInfo?: (reportId: string, message: string) => Promise<void>;
  onSubmitAdditionalInfo?: (reportId: string, text: string) => Promise<void>;
}

export function ReportDetailModal({
  visible,
  report,
  onClose,
  onOpenFullScreen,
  onOpenLinkedEvent,
  isOfficer = false,
  activeEvents = [],
  onVerify,
  onReject,
  onRequestInfo,
  onSubmitAdditionalInfo,
}: ReportDetailModalProps) {
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [decisionText, setDecisionText] = useState('');
  const [infoReplyText, setInfoReplyText] = useState('');
  const [activeAction, setActiveAction] = useState<'verify' | 'reject' | 'info' | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const onSelectAction = (action: 'verify' | 'reject' | 'info') => {
    setActiveAction(action);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  if (!report) return null;

  const handleVerify = async () => {
    if (!onVerify) return;
    try {
      setActionLoading(true);
      const ev = activeEvents.find((e) => e.id === selectedEventId);
      await onVerify(
        report.id,
        selectedEventId || null,
        ev?.title || null,
        decisionText || 'Verified by DMC Duty Officer.',
      );
      const targetReportId = report.id;
      setActiveAction(null);
      setDecisionText('');
      onClose();

      Alert.alert(
        'Report Verified',
        'The report has been officially verified. Would you like to issue an emergency hazard warning based on this report?',
        [
          {
            text: 'Issue Warning Now',
            onPress: () => {
              router.push({
                pathname: '/(app)/warnings/compose',
                params: { reportId: targetReportId },
              } as never);
            },
          },
          { text: 'Done', style: 'cancel' },
        ],
      );
    } catch (err) {
      Alert.alert('Verification Error', (err as Error)?.message || 'Failed to verify report.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!onReject) return;
    if (!decisionText.trim()) {
      Alert.alert('Reason Required', 'Please provide a clear justification for rejecting this report.');
      return;
    }
    try {
      setActionLoading(true);
      await onReject(report.id, decisionText);
      Alert.alert('Report Rejected', 'The report has been marked as rejected and logged.');
      setActiveAction(null);
      setDecisionText('');
      onClose();
    } catch (err) {
      Alert.alert('Rejection Error', (err as Error)?.message || 'Failed to reject report.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestInfo = async () => {
    if (!onRequestInfo) return;
    if (!decisionText.trim()) {
      Alert.alert('Message Required', 'Please specify what additional information is required.');
      return;
    }
    try {
      setActionLoading(true);
      await onRequestInfo(report.id, decisionText);
      Alert.alert('Information Requested', 'The submitter has been notified to provide further details.');
      setActiveAction(null);
      setDecisionText('');
      onClose();
    } catch (err) {
      Alert.alert('Request Error', (err as Error)?.message || 'Failed to request info.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitReply = async () => {
    if (!onSubmitAdditionalInfo) return;
    if (!infoReplyText.trim()) {
      Alert.alert('Information Required', 'Please enter your clarification response.');
      return;
    }
    try {
      setActionLoading(true);
      await onSubmitAdditionalInfo(report.id, infoReplyText);
      Alert.alert('Clarification Sent', 'Your report has returned to the verification queue.');
      setInfoReplyText('');
      onClose();
    } catch (err) {
      Alert.alert('Submission Error', (err as Error)?.message || 'Failed to submit additional info.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header Bar */}
          <View style={styles.headerBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.refTitle}>{report.referenceNumber}</Text>
              <Text style={styles.headerSubtitle}>Ground Hazard Observation</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
              {onOpenFullScreen && (
                <TouchableOpacity
                  onPress={() => onOpenFullScreen(report.id)}
                  style={styles.closeBtn}
                  activeOpacity={0.7}
                  accessibilityLabel="Open full screen"
                >
                  <Ionicons name="open-outline" size={18} color={Colors.accent.primary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                <Ionicons name="close" size={20} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            ref={scrollViewRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            style={{ flex: 1 }}
          >
            {/* Status and Observation Badges */}
            <View style={styles.badgeRow}>
              <ReportStatusBadge status={report.status} size="md" />
              <ObservationTypeBadge type={report.observationType} size="md" />
            </View>

            {/* Evidence Photograph */}
            {report.photoUrl ? (
              <View style={styles.photoContainer}>
                <Image
                  source={{ uri: report.photoUrl }}
                  style={styles.photo}
                  contentFit="cover"
                  transition={250}
                />
              </View>
            ) : null}

            {/* Observation Description */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Observation Narrative</Text>
              <Text style={styles.descriptionText}>{report.description}</Text>
            </View>

            {/* Location & GPS Telemetry */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Location & Telemetry</Text>
              <View style={styles.telemetryCard}>
                <View style={styles.telemetryRow}>
                  <Ionicons name="location-sharp" size={16} color={Colors.accent.primary} />
                  <Text style={styles.telemetryValue}>{report.locationName}</Text>
                </View>
                <View style={styles.telemetryRow}>
                  <Ionicons name="map-outline" size={16} color={Colors.text.tertiary} />
                  <Text style={styles.telemetryMuted}>
                    District: <Text style={styles.telemetryBold}>{report.district}</Text>
                  </Text>
                </View>
                <View style={styles.telemetryRow}>
                  <Ionicons name="navigate-circle-outline" size={16} color={Colors.text.tertiary} />
                  <Text style={styles.telemetryMuted}>
                    {report.location.latitude.toFixed(5)}° N, {report.location.longitude.toFixed(5)}° E
                    {report.isManualLocation ? ' (Manually Placed)' : ' (GPS Acquired)'}
                  </Text>
                </View>

                {Platform.OS === 'web' && report.location && (
                  <View style={{ marginTop: 8, height: 160, borderRadius: 8, overflow: 'hidden' }}>
                    <iframe
                      title="Incident Map"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${(report.location.longitude - 0.012).toFixed(4)}%2C${(report.location.latitude - 0.012).toFixed(4)}%2C${(report.location.longitude + 0.012).toFixed(4)}%2C${(report.location.latitude + 0.012).toFixed(4)}&layer=mapnik&marker=${report.location.latitude.toFixed(5)}%2C${report.location.longitude.toFixed(5)}`}
                      style={{ width: '100%', height: 160, border: 0 }}
                    />
                  </View>
                )}
              </View>
            </View>

            {/* Submitter Details */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Observer Information</Text>
              <View style={styles.observerRow}>
                <View style={styles.observerAvatar}>
                  <Ionicons name="person" size={18} color={Colors.accent.primary} />
                </View>
                <View>
                  <Text style={styles.observerName}>{report.submitterName}</Text>
                  <Text style={styles.observerRole}>
                    {report.submitterRole === 'volunteer'
                      ? 'Community Disaster Volunteer'
                      : 'Registered Citizen'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Officer Decision Display — Verified Assessment */}
            {report.status === 'verified' && (
              <View style={styles.verifiedDecisionCard}>
                <View style={styles.decisionHeader}>
                  <Ionicons name="shield-checkmark" size={18} color={Colors.status.success} />
                  <Text style={[styles.decisionTitle, { color: Colors.status.success }]}>
                    Verified Assessment
                  </Text>
                </View>
                <Text style={styles.decisionText}>
                  {report.verificationDecision || 'This observation was officially verified by the DMC Duty Officer.'}
                </Text>
                {report.hazardEventTitle && (
                  <TouchableOpacity
                    style={styles.linkedEventBadge}
                    activeOpacity={report.hazardEventId && onOpenLinkedEvent ? 0.75 : 1}
                    onPress={() => {
                      if (report.hazardEventId && onOpenLinkedEvent) {
                        onClose();
                        onOpenLinkedEvent(report.hazardEventId);
                      }
                    }}
                  >
                    <Ionicons name="link-outline" size={13} color={Colors.accent.primary} />
                    <Text style={styles.linkedEventText}>
                      Linked Hazard: <Text style={styles.linkedEventHighlight}>{report.hazardEventTitle}</Text>
                    </Text>
                    {report.hazardEventId && onOpenLinkedEvent && (
                      <Ionicons name="arrow-forward" size={12} color={Colors.accent.primary} style={{ marginLeft: 2 }} />
                    )}
                  </TouchableOpacity>
                )}
                <View style={styles.decisionFooterRow}>
                  <Text style={styles.decisionOfficer}>
                    Verified by: {report.verifiedByName || 'DMC Duty Officer'}
                  </Text>
                  {report.verificationTimestamp && (
                    <Text style={styles.decisionTimestamp}>
                      {new Date(report.verificationTimestamp).toLocaleDateString()}
                    </Text>
                  )}
                </View>

                {isOfficer && (
                  <TouchableOpacity
                    style={styles.issueHazardWarningModalBtn}
                    onPress={() => {
                      const repId = report.id;
                      onClose();
                      router.push({
                        pathname: '/(app)/warnings/compose',
                        params: { reportId: repId },
                      } as never);
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="warning" size={16} color="#080C14" />
                    <Text style={styles.issueHazardWarningModalBtnText}>
                      Issue Hazard Warning from Report
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Officer Decision Display — Rejection with Rationale */}
            {report.status === 'rejected' && (
              <View style={styles.rejectedDecisionCard}>
                <View style={styles.decisionHeader}>
                  <Ionicons name="close-circle" size={18} color={Colors.status.danger} />
                  <Text style={[styles.decisionTitle, { color: Colors.status.danger }]}>
                    Report Rejected
                  </Text>
                </View>
                <Text style={styles.rejectionReasonLabel}>Official Rejection Reason:</Text>
                <Text style={styles.rejectionReasonText}>
                  {report.verificationDecision || 'This observation was reviewed and marked as unverified.'}
                </Text>
                <View style={styles.decisionFooterRow}>
                  <Text style={styles.decisionOfficer}>
                    Reviewed by: {report.verifiedByName || 'DMC Duty Officer'}
                  </Text>
                  {report.verificationTimestamp && (
                    <Text style={styles.decisionTimestamp}>
                      {new Date(report.verificationTimestamp).toLocaleDateString()}
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* Submitter Reply Section (when info is requested) */}
            {report.status === 'info_requested' && !isOfficer && (
              <View style={styles.replySection}>
                <View style={styles.infoAlert}>
                  <Ionicons name="help-circle" size={18} color={Colors.info} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoAlertTitle}>Officer Clarification Needed</Text>
                    <Text style={styles.infoAlertMsg}>{report.infoRequestedMessage}</Text>
                  </View>
                </View>

                <TextInput
                  style={styles.replyInput}
                  value={infoReplyText}
                  onChangeText={setInfoReplyText}
                  placeholder="Enter requested details (e.g. estimated crack width, water depth)..."
                  placeholderTextColor={Colors.input.placeholder}
                  multiline
                />

                <TouchableOpacity
                  style={styles.replyBtn}
                  onPress={handleSubmitReply}
                  disabled={actionLoading}
                  activeOpacity={0.8}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color="#080C14" />
                  ) : (
                    <>
                      <Ionicons name="send" size={14} color="#080C14" />
                      <Text style={styles.replyBtnText}>Submit Clarification</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Officer Action Buttons (When Officer reviews pending report) */}
            {isOfficer && report.status === 'pending_verification' && (
              <View style={styles.officerActionsSection}>
                <Text style={styles.sectionLabel}>DMC Verification Decision</Text>

                {activeAction === null ? (
                  <View style={styles.officerBtnRow}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.officerBtn,
                        styles.btnVerify,
                        pressed && styles.btnPressed,
                      ]}
                      onPress={() => onSelectAction('verify')}
                      accessibilityRole="button"
                      accessibilityLabel="Verify Ground Report"
                    >
                      <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                      <Text style={styles.officerBtnText}>Verify</Text>
                    </Pressable>

                    <Pressable
                      style={({ pressed }) => [
                        styles.officerBtn,
                        styles.btnReject,
                        pressed && styles.btnPressed,
                      ]}
                      onPress={() => onSelectAction('reject')}
                      accessibilityRole="button"
                      accessibilityLabel="Reject Ground Report"
                    >
                      <Ionicons name="close-circle" size={16} color="#FFF" />
                      <Text style={styles.officerBtnText}>Reject</Text>
                    </Pressable>

                    <Pressable
                      style={({ pressed }) => [
                        styles.officerBtn,
                        styles.btnInfo,
                        pressed && styles.btnPressed,
                      ]}
                      onPress={() => onSelectAction('info')}
                      accessibilityRole="button"
                      accessibilityLabel="Request Information"
                    >
                      <Ionicons name="help-circle" size={16} color="#FFF" />
                      <Text style={styles.officerBtnText}>Ask Info</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.actionFormCard}>
                    <Text style={styles.actionFormTitle}>
                      {activeAction === 'verify'
                        ? 'Confirm Verification & Link Event'
                        : activeAction === 'reject'
                        ? 'Reject Report with Rationale'
                        : 'Request Information from Submitter'}
                    </Text>

                    {activeAction === 'verify' && (
                      <View style={{ marginBottom: Spacing.sm }}>
                        <Text style={styles.miniLabel}>Link to Open Hazard Event (Optional):</Text>
                        {activeEvents.length > 0 ? (
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
                            <TouchableOpacity
                              style={[
                                styles.eventChip,
                                selectedEventId === '' && styles.eventChipActive,
                              ]}
                              onPress={() => setSelectedEventId('')}
                            >
                              <Text
                                style={[
                                  styles.eventChipText,
                                  selectedEventId === '' && styles.eventChipTextActive,
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
                                  selectedEventId === ev.id && styles.eventChipActive,
                                ]}
                                onPress={() => setSelectedEventId(selectedEventId === ev.id ? '' : ev.id)}
                              >
                                <Text
                                  style={[
                                    styles.eventChipText,
                                    selectedEventId === ev.id && styles.eventChipTextActive,
                                  ]}
                                  numberOfLines={1}
                                >
                                  {ev.title}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        ) : (
                          <Text style={styles.noEventsMiniNotice}>
                            No open hazard events. Observation will be verified as standalone.
                          </Text>
                        )}
                      </View>
                    )}

                    <TextInput
                      style={styles.decisionInput}
                      value={decisionText}
                      onChangeText={setDecisionText}
                      placeholder={
                        activeAction === 'verify'
                          ? 'Optional review notes (e.g. Confirmed with Grama Niladhari)...'
                          : activeAction === 'reject'
                          ? 'Enter reason for rejection (required)...'
                          : 'Enter specific clarification needed...'
                      }
                      placeholderTextColor={Colors.input.placeholder}
                      multiline
                    />

                    <View style={styles.actionSubmitRow}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.cancelActionBtn,
                          pressed && styles.btnPressed,
                        ]}
                        onPress={() => {
                          setActiveAction(null);
                          setDecisionText('');
                        }}
                      >
                        <Text style={styles.cancelActionBtnText}>Cancel</Text>
                      </Pressable>

                      <Pressable
                        style={({ pressed }) => [
                          styles.confirmActionBtn,
                          activeAction === 'verify'
                            ? styles.btnVerify
                            : activeAction === 'reject'
                            ? styles.btnReject
                            : styles.btnInfo,
                          pressed && styles.btnPressed,
                          actionLoading && styles.btnDisabled,
                        ]}
                        onPress={
                          activeAction === 'verify'
                            ? handleVerify
                            : activeAction === 'reject'
                            ? handleReject
                            : handleRequestInfo
                        }
                        disabled={actionLoading}
                      >
                        {actionLoading ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <Text style={styles.confirmActionBtnText}>
                            {activeAction === 'verify'
                              ? 'Confirm Verification'
                              : activeAction === 'reject'
                              ? 'Confirm Rejection'
                              : 'Send Request'}
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.bg.overlay,
    justifyContent: 'flex-end',
    zIndex: 10000,
  },
  sheetContainer: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '92%',
    paddingBottom: Spacing.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
    zIndex: 10001,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  refTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.accent.primary,
  },
  headerSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: Spacing.xl,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  photoContainer: {
    height: 220,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.xs + 2,
  },
  descriptionText: {
    fontSize: FontSize.md,
    color: Colors.text.primary,
    lineHeight: 22,
  },
  telemetryCard: {
    backgroundColor: '#090F1C',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: Spacing.xs + 2,
  },
  telemetryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  telemetryValue: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  telemetryMuted: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
  },
  telemetryBold: {
    color: Colors.accent.primary,
    fontWeight: '600',
  },
  observerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  observerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  observerName: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  observerRole: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
  },
  verifiedDecisionCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  rejectedDecisionCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  decisionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    marginBottom: 6,
  },
  decisionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  decisionText: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    lineHeight: 18,
    marginBottom: Spacing.xs + 2,
  },
  rejectionReasonLabel: {
    fontSize: FontSize.micro,
    fontWeight: '700',
    color: Colors.status.danger,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  rejectionReasonText: {
    fontSize: FontSize.xs,
    color: Colors.text.primary,
    lineHeight: 18,
    marginBottom: Spacing.xs + 2,
  },
  linkedEventBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs,
    alignSelf: 'flex-start',
    marginBottom: Spacing.xs + 2,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  linkedEventText: {
    fontSize: FontSize.micro,
    color: Colors.text.secondary,
  },
  linkedEventHighlight: {
    color: Colors.accent.primary,
    fontWeight: '700',
  },
  decisionFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  decisionOfficer: {
    fontSize: FontSize.micro,
    color: Colors.text.tertiary,
    fontStyle: 'italic',
  },
  decisionTimestamp: {
    fontSize: FontSize.micro,
    color: Colors.text.tertiary,
  },
  replySection: {
    backgroundColor: '#090F1C',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    marginBottom: Spacing.lg,
  },
  infoAlert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  infoAlertTitle: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.info,
  },
  infoAlertMsg: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  replyInput: {
    backgroundColor: '#0D1527',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: Spacing.sm,
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    height: 70,
    marginBottom: Spacing.sm,
    textAlignVertical: 'top',
  },
  replyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.accent.primary,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  replyBtnText: {
    color: '#080C14',
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  officerActionsSection: {
    marginTop: Spacing.md,
  },
  officerBtnRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  officerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer', userSelect: 'none' } as never) : {}),
  },
  btnPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnVerify: {
    backgroundColor: '#059669',
  },
  btnReject: {
    backgroundColor: '#DC2626',
  },
  btnInfo: {
    backgroundColor: '#0284C7',
  },
  officerBtnText: {
    color: '#FFF',
    fontSize: FontSize.xs,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  actionFormCard: {
    backgroundColor: '#090F1C',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: Spacing.md,
  },
  actionFormTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  miniLabel: {
    fontSize: FontSize.micro,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  eventChip: {
    backgroundColor: '#1E293B',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.xs,
    maxWidth: 220,
  },
  eventChipActive: {
    backgroundColor: Colors.accent.primary,
  },
  eventChipText: {
    fontSize: FontSize.micro,
    color: Colors.text.secondary,
  },
  eventChipTextActive: {
    color: '#080C14',
    fontWeight: '700',
  },
  noEventsMiniNotice: {
    fontSize: FontSize.micro,
    color: Colors.text.tertiary,
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  decisionInput: {
    backgroundColor: '#0D1527',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: Spacing.sm,
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    height: 70,
    marginBottom: Spacing.md,
    textAlignVertical: 'top',
  },
  actionSubmitRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
  },
  cancelActionBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer', userSelect: 'none' } as never) : {}),
  },
  cancelActionBtnText: {
    color: Colors.text.secondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  confirmActionBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer', userSelect: 'none' } as never) : {}),
  },
  confirmActionBtnText: {
    color: '#FFF',
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  issueHazardWarningModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.accent.primary,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  issueHazardWarningModalBtnText: {
    color: '#080C14',
    fontSize: FontSize.xs,
    fontWeight: '800',
  },
});
