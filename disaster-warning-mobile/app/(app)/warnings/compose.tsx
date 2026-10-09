/**
 * UC01 – Warning Composer Screen
 * Allows authorized DMC Duty Officers to compose and validate disaster warnings.
 *
 * Requirements:
 * 1. Hazard Type: Prefilled from selected event (read-only).
 * 2. Severity: Required field ('evacuation' | 'warning' | 'advisory').
 * 3. Target Mode: 'district' | 'river_basin'.
 * 4. Target Areas: Select one or more target areas dynamically loaded from constants/Firebase.
 * 5. Estimated Recipients: Auto-calculated & deduplicated from registered users.
 * 6. Warning Headline: Required string.
 * 7. Instruction Text: Required multi-line string.
 * 8. Delivery Channels: Push, SMS, Audible (at least one required).
 * 9. Dispatch Warning button: Validates form and prepares warning payload.
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
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { MobileNavBar } from '@/components/MobileNavBar';
import { FormModal } from '@/components/FormModal';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/colors';
import { SRI_LANKAN_DISTRICTS } from '@/constants/districts';
import { SRI_LANKA_RIVER_BASINS } from '@/constants/riverBasins';
import { getHazardEvent } from '@/services/hazardEventService';
import { resolveRecipients } from '@/services/recipientService';
import {
  executeWarningDispatchPipeline,
  type WarningDispatchPipelineResult,
} from '@/services/warningService';
import type { ChannelExecutionOptions } from '@/services/deliveryService';
import type { HazardEvent, HazardType } from '@/types/resources';
import type {
  WarningSeverity,
  TargetMode,
  DeliveryChannel,
  CreateWarningPayload,
} from '@/types/warning';

const SEVERITY_OPTIONS: { label: string; value: WarningSeverity }[] = [
  { label: '🔴 RED — Immediate Evacuation Order', value: 'evacuation' },
  { label: '🟠 AMBER — Severe Warning (Prepare to Move)', value: 'warning' },
  { label: '🟡 YELLOW — General Hazard Advisory', value: 'advisory' },
];

const AVAILABLE_CHANNELS: { id: DeliveryChannel; label: string; icon: keyof typeof Ionicons.glyphMap; desc: string }[] = [
  { id: 'push', label: 'Push Notification', icon: 'notifications', desc: 'Instant mobile app alert' },
  { id: 'sms', label: 'SMS Gateway', icon: 'chatbox-ellipses', desc: 'Direct cellular text message' },
  { id: 'audible', label: 'Audible Siren', icon: 'volume-high', desc: 'Emergency siren sound broadcast' },
];

export default function WarningComposerScreen() {
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();
  const router = useRouter();
  const { state } = useAuth();
  const user = state.user;

  const isDmcOfficer = user?.role === 'dmc_officer';

  // Selected Hazard Event State
  const [event, setEvent] = useState<HazardEvent | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [eventError, setEventError] = useState<string | null>(null);

  // Warning Composer Form State
  const [hazardType, setHazardType] = useState<HazardType>('flood');
  const [severity, setSeverity] = useState<WarningSeverity | ''>('warning');
  const [targetMode, setTargetMode] = useState<TargetMode>('district');
  const [targetAreas, setTargetAreas] = useState<string[]>([]);
  const [headline, setHeadline] = useState('');
  const [instructions, setInstructions] = useState('');
  const [deliveryChannels, setDeliveryChannels] = useState<DeliveryChannel[]>(['push', 'sms', 'audible']);
  const [simulationMode, setSimulationMode] = useState<'standard' | 'scenario_a' | 'scenario_b'>('standard');

  // Recipient Resolution State
  const [resolvedDistricts, setResolvedDistricts] = useState<string[]>([]);
  const [recipientCount, setRecipientCount] = useState<number>(0);
  const [resolvingRecipients, setResolvingRecipients] = useState(false);

  // Validation & Payload Modal State
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [preparedPayload, setPreparedPayload] = useState<CreateWarningPayload | null>(null);
  const [createdWarningId, setCreatedWarningId] = useState<string | null>(null);
  const [pipelineResult, setPipelineResult] = useState<WarningDispatchPipelineResult | null>(null);
  const [showPayloadModal, setShowPayloadModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch Event from Cloud Firestore by ID
  const fetchEvent = useCallback(async () => {
    if (!eventId) {
      setLoadingEvent(false);
      setEventError('No hazard event ID specified.');
      return;
    }

    setLoadingEvent(true);
    setEventError(null);

    try {
      const fetchedEvent = await getHazardEvent(eventId);
      if (fetchedEvent) {
        setEvent(fetchedEvent);
        setHazardType(fetchedEvent.hazardType);

        // Pre-fill target areas from event if available
        if (fetchedEvent.affectedDistricts && fetchedEvent.affectedDistricts.length > 0) {
          setTargetAreas(fetchedEvent.affectedDistricts);
          setTargetMode('district');
        } else if (fetchedEvent.affectedRiverBasins && fetchedEvent.affectedRiverBasins.length > 0) {
          setTargetAreas(fetchedEvent.affectedRiverBasins);
          setTargetMode('river_basin');
        }

        // Pre-fill smart defaults for headline & instructions
        setHeadline(`EMERGENCY ALERT: Severe ${fetchedEvent.hazardType.toUpperCase()} Warning`);
        setInstructions(
          `Residents in targeted areas must move to higher ground immediately. Follow official instructions from DMC duty officers.`
        );
      } else {
        setEventError(`Hazard event matching ID "${eventId}" was not found.`);
      }
    } catch (err) {
      console.error('Error fetching hazard event for composer:', err);
      setEventError('Failed to load hazard event from Cloud Firestore.');
    } finally {
      setLoadingEvent(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  // Recipient Resolution Effect: Triggered when targetMode or targetAreas change
  useEffect(() => {
    let isCurrent = true;
    if (targetAreas.length === 0) {
      setResolvedDistricts([]);
      setRecipientCount(0);
      return;
    }

    setResolvingRecipients(true);
    resolveRecipients(targetMode, targetAreas).then((res) => {
      if (isCurrent) {
        setResolvedDistricts(res.resolvedDistricts);
        setRecipientCount(res.recipientCount);
        setResolvingRecipients(false);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [targetMode, targetAreas]);

  // Handle Target Mode Toggle
  const handleTargetModeChange = (mode: TargetMode) => {
    setTargetMode(mode);
    if (!event) {
      setTargetAreas([]);
      return;
    }
    if (mode === 'district') {
      setTargetAreas(event.affectedDistricts.length > 0 ? event.affectedDistricts : ['Ratnapura']);
    } else {
      setTargetAreas(
        event.affectedRiverBasins && event.affectedRiverBasins.length > 0
          ? event.affectedRiverBasins
          : ['Kalu River Basin']
      );
    }
  };

  // Toggle Target Area Selection
  const toggleTargetArea = (area: string) => {
    if (targetAreas.includes(area)) {
      setTargetAreas(targetAreas.filter((a) => a !== area));
    } else {
      setTargetAreas([...targetAreas, area]);
    }
  };

  // Toggle Delivery Channel Selection
  const toggleDeliveryChannel = (channel: DeliveryChannel) => {
    if (deliveryChannels.includes(channel)) {
      setDeliveryChannels(deliveryChannels.filter((c) => c !== channel));
    } else {
      setDeliveryChannels([...deliveryChannels, channel]);
    }
  };

  // Form Validation & Firestore Warning Document Creation
  const handleDispatch = async () => {
    if (submitting) return; // Prevent accidental double clicks during active dispatch
    setValidationErrors([]);
    const errors: string[] = [];

    if (!severity) {
      errors.push('Severity is required. Please select an emergency severity level.');
    }
    if (!targetMode) {
      errors.push('Target Mode is required.');
    }
    if (targetAreas.length === 0) {
      errors.push('At least one target area must be selected.');
    } else if (recipientCount <= 0 && !resolvingRecipients) {
      errors.push('No registered recipients found for the selected target area.');
    }
    if (!headline.trim()) {
      errors.push('Warning Headline is required.');
    }
    if (!instructions.trim()) {
      errors.push('Instruction Text is required.');
    }
    if (deliveryChannels.length === 0) {
      errors.push('At least one Delivery Channel (Push, SMS, or Audible) must be selected.');
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setSubmitting(true);

    try {
      const payload: CreateWarningPayload = {
        eventId: event?.id || eventId || '',
        hazardEventId: event?.id || eventId || '',
        hazardEventTitle: event?.title || 'Open Hazard Event',
        hazardType,
        severity: severity as WarningSeverity,
        targetMode,
        targetAreas,
        resolvedDistricts,
        recipientCount,
        headline: headline.trim(),
        instructions: instructions.trim(),
        channels: deliveryChannels,
        deliveryChannels,
      };

      // Build channel execution options based on selected simulation mode
      let channelOptions: Partial<Record<DeliveryChannel, ChannelExecutionOptions>> | undefined;

      if (simulationMode === 'scenario_a') {
        channelOptions = {
          sms: {
            mockFailure: true,
            customErrorMessage: 'Cellular SMS Gateway Error: Carrier network timeout / quota exceeded.',
          },
        };
      } else if (simulationMode === 'scenario_b') {
        channelOptions = {
          push: {
            mockFailure: true,
            customErrorMessage: 'Push Notification Service Gateway unreachable (Connection Timeout).',
          },
          sms: {
            mockFailure: true,
            customErrorMessage: 'Cellular SMS Gateway Error: Quota exceeded.',
          },
          audible: {
            mockFailure: true,
            customErrorMessage: 'Audible Siren Control Tower Offline: Grid power failure in target sectors.',
          },
        };
      }

      // Execute End-to-End UC01 Warning Creation & Multi-Channel Dispatch Pipeline:
      // 1. Validate mandatory information
      // 2. Resolve recipients again on service layer
      // 3. Abort if recipient count is zero
      // 4. Create warning document with status "dispatching"
      // 5. Run selected delivery channels (sendPush, sendSMS, sendAudible) with fault isolation
      // 6. Save individual per-channel delivery logs in `deliveryLogs` collection
      // 7. Calculate final warning status ('delivered', 'partially_failed', or 'failed')
      // 8. Update warning document status in Cloud Firestore
      const result = await executeWarningDispatchPipeline(
        payload,
        user?.id || user?.email || 'dmc-officer',
        user?.fullName || 'DMC Duty Officer',
        channelOptions,
      );

      setPreparedPayload(payload);
      setCreatedWarningId(result.warningId);
      setPipelineResult(result);

      // Navigate to UC01 Delivery Summary screen
      router.push({
        pathname: '/(app)/warnings/summary',
        params: { warningId: result.warningId, eventId: payload.eventId },
      } as never);
    } catch (err: unknown) {
      const errorMsg = (err as Error).message || 'Failed to create warning document in Cloud Firestore.';
      setValidationErrors([errorMsg]);
    } finally {
      setSubmitting(false);
    }
  };

  // List of Available Areas based on Target Mode
  const availableAreaOptions =
    targetMode === 'district'
      ? SRI_LANKAN_DISTRICTS
      : Object.keys(SRI_LANKA_RIVER_BASINS);

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Navigation Header */}
        <View style={styles.navHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={Colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.navTitleBox}>
            <Text style={styles.navPill}>DISASTER WARNING COMPOSER</Text>
            <Text style={styles.navTitle}>Issue Warning</Text>
          </View>
        </View>

        {/* Loading State */}
        {loadingEvent ? (
          <Card style={styles.stateCard}>
            <ActivityIndicator size="large" color={Colors.accent.primary} />
            <Text style={styles.stateTitle}>Loading Hazard Event...</Text>
            <Text style={styles.stateDesc}>Fetching document from Cloud Firestore.</Text>
          </Card>
        ) : eventError && !event ? (
          /* Error State */
          <Card style={styles.errorCard}>
            <Ionicons name="alert-circle" size={36} color={Colors.danger} />
            <Text style={styles.errorTitle}>Event Selection Error</Text>
            <Text style={styles.errorDesc}>{eventError}</Text>
            <Button title="Back to Events" variant="secondary" size="sm" onPress={() => router.back()} />
          </Card>
        ) : (
          /* Form Content */
          <>
            {/* Context Card: Target Event Telemetry */}
            {event && (
              <LinearGradient
                colors={['#1E1B4B', '#0F172A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroBanner}
              >
                <Text style={styles.heroSub}>TARGET HAZARD EVENT</Text>
                <Text style={styles.heroTitle}>{event.title}</Text>
                <Text style={styles.heroDesc}>{event.description}</Text>
              </LinearGradient>
            )}

            {/* Validation Errors Notice */}
            {validationErrors.length > 0 && (
              <Card style={styles.validationCard}>
                <View style={styles.validationHeader}>
                  <Ionicons name="warning-outline" size={20} color={Colors.danger} />
                  <Text style={styles.validationTitle}>Validation Errors ({validationErrors.length})</Text>
                </View>
                {validationErrors.map((err, idx) => (
                  <Text key={idx} style={styles.validationItem}>• {err}</Text>
                ))}
              </Card>
            )}

            {/* Form Step 1: Hazard Type (Read-only) */}
            <Card style={styles.formCard}>
              <Text style={styles.sectionLabel}>1. HAZARD TYPE (PREFILLED)</Text>
              <View style={styles.readOnlyBox}>
                <Ionicons name="flame" size={18} color={Colors.accent.primary} />
                <Text style={styles.readOnlyText}>{hazardType.toUpperCase()}</Text>
                <Text style={styles.readOnlyBadge}>READ ONLY</Text>
              </View>
              <Text style={styles.helperText}>Prefilled from selected hazard event.</Text>
            </Card>

            {/* Form Step 2: Severity (Required) */}
            <Card style={styles.formCard}>
              <Text style={styles.sectionLabel}>2. SEVERITY LEVEL *</Text>
              <Select
                label=""
                value={severity}
                onSelect={(val) => setSeverity(val as WarningSeverity)}
                options={SEVERITY_OPTIONS}
                placeholder="Select Emergency Severity Level"
              />
            </Card>

            {/* Form Step 3: Target Mode (Required) */}
            <Card style={styles.formCard}>
              <Text style={styles.sectionLabel}>3. TARGET MODE *</Text>
              <View style={styles.segmentedRow}>
                <TouchableOpacity
                  style={[styles.segmentedBtn, targetMode === 'district' && styles.segmentedBtnActive]}
                  onPress={() => handleTargetModeChange('district')}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="map"
                    size={16}
                    color={targetMode === 'district' ? Colors.accent.primary : Colors.text.tertiary}
                  />
                  <Text style={[styles.segmentedText, targetMode === 'district' && styles.segmentedTextActive]}>
                    District Mode
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.segmentedBtn, targetMode === 'river_basin' && styles.segmentedBtnActive]}
                  onPress={() => handleTargetModeChange('river_basin')}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="water"
                    size={16}
                    color={targetMode === 'river_basin' ? '#38BDF8' : Colors.text.tertiary}
                  />
                  <Text style={[styles.segmentedText, targetMode === 'river_basin' && styles.segmentedTextActive]}>
                    River Basin Mode
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>

            {/* Form Step 4: Target Areas (Required) */}
            <Card style={styles.formCard}>
              <Text style={styles.sectionLabel}>
                4. TARGET AREAS ({targetAreas.length} Selected) *
              </Text>
              <Text style={styles.helperText}>
                Select target {targetMode === 'district' ? 'districts' : 'river basins'} for notification.
              </Text>

              <View style={styles.chipGrid}>
                {availableAreaOptions.map((area) => {
                  const isSelected = targetAreas.includes(area);
                  return (
                    <TouchableOpacity
                      key={area}
                      style={[styles.chip, isSelected && styles.chipSelected]}
                      onPress={() => toggleTargetArea(area)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={isSelected ? 'checkmark-circle' : 'add-circle-outline'}
                        size={14}
                        color={isSelected ? Colors.accent.primary : Colors.text.tertiary}
                      />
                      <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                        {area}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Card>

            {/* Form Step 5: Estimated Recipients (Deduplicated) */}
            <Card style={styles.formCard}>
              <Text style={styles.sectionLabel}>5. ESTIMATED RECIPIENT RESOLUTION</Text>

              <View style={styles.recipientBox}>
                {resolvingRecipients ? (
                  <View style={styles.resolvingRow}>
                    <ActivityIndicator size="small" color={Colors.accent.primary} />
                    <Text style={styles.resolvingText}>Resolving registered recipients...</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.countRow}>
                      <Text style={[styles.countNumber, recipientCount === 0 && { color: Colors.warning }]}>
                        {recipientCount.toLocaleString()}
                      </Text>
                      <Text style={styles.countUnit}>Registered Recipients Resolved</Text>
                    </View>

                    {targetAreas.length > 0 && recipientCount === 0 && (
                      <View style={styles.zeroRecipientsNotice}>
                        <Ionicons name="warning" size={16} color={Colors.warning} />
                        <Text style={styles.zeroRecipientsNoticeText}>
                          No registered recipients found for the selected target area.
                        </Text>
                      </View>
                    )}

                    <Text style={styles.resolvedDistrictsLabel}>
                      Resolved Administrative Districts ({resolvedDistricts.length}):
                    </Text>
                    <View style={styles.districtsWrap}>
                      {resolvedDistricts.length > 0 ? (
                        resolvedDistricts.map((d) => (
                          <View key={d} style={styles.distBadge}>
                            <Text style={styles.distBadgeText}>{d}</Text>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.noDistrictsText}>No target areas selected yet.</Text>
                      )}
                    </View>
                  </>
                )}
              </View>
            </Card>

            {/* Form Step 6: Warning Headline (Required) */}
            <Card style={styles.formCard}>
              <Text style={styles.sectionLabel}>6. WARNING HEADLINE *</Text>
              <Input
                label=""
                value={headline}
                onChangeText={setHeadline}
                placeholder="e.g. URGENT FLOOD EVACUATION ORDER — KALU RIVER BASIN"
              />
            </Card>

            {/* Form Step 7: Instruction Text (Required) */}
            <Card style={styles.formCard}>
              <Text style={styles.sectionLabel}>7. INSTRUCTION TEXT *</Text>
              <Input
                label=""
                value={instructions}
                onChangeText={setInstructions}
                multiline
                numberOfLines={4}
                placeholder="Enter emergency action instructions for citizens in affected areas..."
              />
            </Card>

            {/* Form Step 8: Delivery Channels (Required) */}
            <Card style={styles.formCard}>
              <Text style={styles.sectionLabel}>
                8. DELIVERY CHANNELS ({deliveryChannels.length} Selected) *
              </Text>
              <Text style={styles.helperText}>Select broadcast delivery channels. At least one required.</Text>

              <View style={styles.channelCol}>
                {AVAILABLE_CHANNELS.map((ch) => {
                  const isSelected = deliveryChannels.includes(ch.id);
                  return (
                    <TouchableOpacity
                      key={ch.id}
                      style={[styles.channelCard, isSelected && styles.channelCardSelected]}
                      onPress={() => toggleDeliveryChannel(ch.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={ch.icon}
                        size={22}
                        color={isSelected ? Colors.accent.primary : Colors.text.tertiary}
                      />
                      <View style={styles.channelMeta}>
                        <Text style={[styles.channelLabel, isSelected && styles.channelLabelSelected]}>
                          {ch.label}
                        </Text>
                        <Text style={styles.channelDesc}>{ch.desc}</Text>
                      </View>
                      <Ionicons
                        name={isSelected ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={isSelected ? Colors.accent.primary : Colors.text.tertiary}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Card>

            {/* Development / Simulation Mode Selector */}
            <Card style={styles.formCard}>
              <Text style={styles.sectionLabel}>9. DISPATCH SIMULATION MODE (DEVELOPMENT / TEST)</Text>
              <Text style={styles.helperText}>
                Select delivery simulation behavior to evaluate fault isolation and error handling.
              </Text>

              <View style={{ gap: Spacing.sm, marginTop: Spacing.xs }}>
                <TouchableOpacity
                  style={[
                    styles.simOptionCard,
                    simulationMode === 'standard' && styles.simOptionCardActive,
                  ]}
                  onPress={() => setSimulationMode('standard')}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={simulationMode === 'standard' ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={simulationMode === 'standard' ? Colors.success : Colors.text.tertiary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.simOptionTitle, { color: Colors.success }]}>
                      🟢 Standard Delivery (All Channels Succeed)
                    </Text>
                    <Text style={styles.simOptionDesc}>
                      Normal multi-channel broadcast across Push, SMS, and Audible.
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.simOptionCard,
                    simulationMode === 'scenario_a' && styles.simOptionCardActive,
                  ]}
                  onPress={() => setSimulationMode('scenario_a')}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={simulationMode === 'scenario_a' ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={simulationMode === 'scenario_a' ? Colors.warning : Colors.text.tertiary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.simOptionTitle, { color: Colors.warning }]}>
                      🟠 Scenario A: Partial Delivery (Push & Audible Succeed, SMS Fails)
                    </Text>
                    <Text style={styles.simOptionDesc}>
                      Simulates SMS gateway failure while Push & Audible proceed without interruption.
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.simOptionCard,
                    simulationMode === 'scenario_b' && styles.simOptionCardActive,
                  ]}
                  onPress={() => setSimulationMode('scenario_b')}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={simulationMode === 'scenario_b' ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={simulationMode === 'scenario_b' ? Colors.danger : Colors.text.tertiary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.simOptionTitle, { color: Colors.danger }]}>
                      🔴 Scenario B: Complete Failure (Push, SMS & Audible Fail)
                    </Text>
                    <Text style={styles.simOptionDesc}>
                      Simulates complete failure across all channels; warning marked as &apos;Dispatch Failed&apos;.
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </Card>

            {/* Dispatch Progress Banner */}
            {submitting && (
              <Card style={styles.dispatchingProgressCard}>
                <View style={styles.dispatchingProgressHeader}>
                  <ActivityIndicator size="small" color={Colors.accent.primary} />
                  <Text style={styles.dispatchingProgressTitle}>DISPATCH PIPELINE IN PROGRESS</Text>
                </View>
                <Text style={styles.dispatchingProgressDesc}>
                  Creating warning document in Cloud Firestore and executing multi-channel broadcast across Push, SMS, and Audible siren networks...
                </Text>
              </Card>
            )}

            {/* Form Step 9: Dispatch Warning Button */}
            <View style={styles.dispatchSection}>
              {isDmcOfficer ? (
                <Button
                  title={submitting ? 'DISPATCHING WARNING...' : 'DISPATCH WARNING'}
                  variant="primary"
                  loading={submitting}
                  disabled={submitting || recipientCount <= 0 || targetAreas.length === 0 || resolvingRecipients}
                  icon={<Ionicons name="send" size={18} color="#FFFFFF" />}
                  onPress={handleDispatch}
                  style={styles.dispatchBtn}
                />
              ) : (
                <View style={styles.nonOfficerNotice}>
                  <Ionicons name="information-circle-outline" size={16} color={Colors.text.tertiary} />
                  <Text style={styles.nonOfficerText}>
                    Warning dispatch is restricted to authorized DMC Duty Officers.
                  </Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Warning Dispatch Execution Summary Modal */}
      {preparedPayload && (
        <FormModal
          visible={showPayloadModal}
          onClose={() => setShowPayloadModal(false)}
          title="Warning Dispatch Execution Summary"
        >
          <View style={styles.payloadBox}>
            <Text style={styles.helperText}>
              Warning document created in Cloud Firestore and dispatched across selected channels.
            </Text>

            <View style={styles.payloadHeader}>
              <Ionicons
                name={
                  pipelineResult?.finalStatus === 'delivered'
                    ? 'checkmark-circle'
                    : pipelineResult?.finalStatus === 'partially_failed'
                    ? 'warning'
                    : 'close-circle'
                }
                size={20}
                color={
                  pipelineResult?.finalStatus === 'delivered'
                    ? Colors.success
                    : pipelineResult?.finalStatus === 'partially_failed'
                    ? Colors.warning
                    : Colors.danger
                }
              />
              <Text
                style={[
                  styles.payloadHeaderText,
                  {
                    color:
                      pipelineResult?.finalStatus === 'delivered'
                        ? Colors.success
                        : pipelineResult?.finalStatus === 'partially_failed'
                        ? Colors.warning
                        : Colors.danger,
                  },
                ]}
              >
                FINAL STATUS:{' '}
                {pipelineResult?.finalStatus === 'delivered'
                  ? 'DISPATCHED (SUCCESS)'
                  : pipelineResult?.finalStatus === 'partially_failed'
                  ? 'DISPATCHED (PARTIAL DELIVERY)'
                  : 'DISPATCH FAILED'}
              </Text>
            </View>

            {createdWarningId && (
              <View style={styles.payloadItem}>
                <Text style={styles.payloadLabel}>Firestore Warning ID:</Text>
                <Text style={[styles.payloadValue, { color: Colors.accent.primary, fontWeight: '900' }]}>
                  {createdWarningId}
                </Text>
              </View>
            )}

            <View style={styles.payloadItem}>
              <Text style={styles.payloadLabel}>Headline:</Text>
              <Text style={styles.payloadValue}>{preparedPayload.headline}</Text>
            </View>

            <View style={styles.payloadItem}>
              <Text style={styles.payloadLabel}>Severity Level:</Text>
              <Text style={[styles.payloadValue, { color: Colors.danger }]}>
                {preparedPayload.severity.toUpperCase()}
              </Text>
            </View>

            <View style={styles.payloadItem}>
              <Text style={styles.payloadLabel}>Resolved Recipients:</Text>
              <Text style={[styles.payloadValue, { color: Colors.success, fontWeight: '900' }]}>
                {(pipelineResult?.recipientCount || preparedPayload.recipientCount).toLocaleString()} Citizens
              </Text>
            </View>

            {/* Per-Channel Breakdown */}
            {pipelineResult?.channelResults && (
              <View style={styles.channelResultsBox}>
                <Text style={styles.channelResultsTitle}>DELIVERY CHANNEL BREAKDOWN</Text>
                {pipelineResult.channelResults.map((res) => (
                  <View key={res.channel} style={styles.chResultCard}>
                    <View style={styles.chResultHeader}>
                      <Text style={styles.chResultName}>{res.channel.toUpperCase()}</Text>
                      <View
                        style={[
                          styles.chStatusBadge,
                          res.status === 'Success' || String(res.status).toLowerCase() === 'success'
                            ? styles.chStatusSuccess
                            : res.status === 'Partial'
                            ? styles.chStatusPartial
                            : styles.chStatusFailed,
                        ]}
                      >
                        <Text style={styles.chStatusText}>{String(res.status).toUpperCase()}</Text>
                      </View>
                    </View>

                    <Text style={styles.chResultCounts}>
                      Delivered: {res.deliveredCount.toLocaleString()} | Failed: {res.failedCount.toLocaleString()}
                    </Text>

                    {res.errorMessage && (
                      <Text style={styles.chResultError}>⚠️ {res.errorMessage}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            <Button
              title="Close & Return to Command"
              variant="secondary"
              onPress={() => {
                setShowPayloadModal(false);
                router.back();
              }}
              style={{ marginTop: Spacing.md }}
            />
          </View>
        </FormModal>
      )}

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
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.35)',
    marginBottom: Spacing.lg,
  },
  heroSub: {
    fontSize: FontSize.micro,
    fontWeight: '800',
    color: Colors.accent.primary,
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontSize: FontSize.md,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
  },
  heroDesc: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  formCard: {
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    fontSize: FontSize.micro,
    fontWeight: '800',
    color: Colors.text.tertiary,
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  readOnlyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#0F172A',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  readOnlyText: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.text.primary,
    flex: 1,
  },
  readOnlyBadge: {
    fontSize: FontSize.micro,
    fontWeight: '800',
    color: Colors.text.tertiary,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  helperText: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginTop: 6,
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  segmentedBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    backgroundColor: '#0F172A',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  segmentedBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: Colors.accent.primary,
  },
  segmentedText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.text.tertiary,
  },
  segmentedTextActive: {
    color: Colors.accent.primary,
    fontWeight: '900',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0F172A',
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  chipSelected: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: Colors.accent.primary,
  },
  chipText: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
  },
  chipTextSelected: {
    color: Colors.accent.primary,
    fontWeight: '800',
  },
  recipientBox: {
    backgroundColor: '#0F172A',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  resolvingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  resolvingText: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
  },
  countRow: {
    marginBottom: Spacing.sm,
  },
  countNumber: {
    fontSize: FontSize.xxl,
    fontWeight: '900',
    color: Colors.success,
  },
  countUnit: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    fontWeight: '700',
  },
  resolvedDistrictsLabel: {
    fontSize: FontSize.micro,
    fontWeight: '800',
    color: Colors.text.tertiary,
    marginTop: Spacing.xs,
    marginBottom: 6,
  },
  districtsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  distBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  distBadgeText: {
    fontSize: FontSize.xs,
    color: Colors.success,
    fontWeight: '700',
  },
  noDistrictsText: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    fontStyle: 'italic',
  },
  channelCol: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  channelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: '#0F172A',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  channelCardSelected: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: Colors.accent.primary,
  },
  channelMeta: {
    flex: 1,
  },
  channelLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text.secondary,
  },
  channelLabelSelected: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  channelDesc: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  validationCard: {
    borderColor: 'rgba(239, 68, 68, 0.4)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    marginBottom: Spacing.lg,
  },
  validationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  validationTitle: {
    fontSize: FontSize.xs,
    fontWeight: '900',
    color: Colors.danger,
  },
  validationItem: {
    fontSize: FontSize.xs,
    color: '#FCA5A5',
    lineHeight: 18,
    marginTop: 2,
  },
  dispatchSection: {
    marginTop: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  dispatchBtn: {
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
  },
  payloadBox: {
    gap: Spacing.xs,
  },
  payloadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  payloadHeaderText: {
    fontSize: FontSize.xs,
    fontWeight: '900',
    color: Colors.success,
  },
  payloadItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingVertical: 4,
  },
  payloadLabel: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    fontWeight: '700',
  },
  payloadValue: {
    fontSize: FontSize.xs,
    color: Colors.text.primary,
    fontWeight: '800',
    flex: 1,
    textAlign: 'right',
  },
  channelResultsBox: {
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  channelResultsTitle: {
    fontSize: FontSize.micro,
    fontWeight: '800',
    color: Colors.text.tertiary,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  chResultCard: {
    backgroundColor: '#0F172A',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  chResultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chResultName: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  chStatusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  chStatusSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  chStatusPartial: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  chStatusFailed: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  chStatusText: {
    fontSize: FontSize.micro,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  chResultCounts: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
  },
  chResultError: {
    fontSize: FontSize.xs,
    color: Colors.danger,
    marginTop: 4,
  },
  zeroRecipientsNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    marginVertical: Spacing.xs,
  },
  zeroRecipientsNoticeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.warning,
    flex: 1,
  },
  simOptionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: '#0F172A',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  simOptionCardActive: {
    borderColor: Colors.accent.primary,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  simOptionTitle: {
    fontSize: FontSize.xs,
    fontWeight: '800',
  },
  simOptionDesc: {
    fontSize: FontSize.micro,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  dispatchingProgressCard: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderColor: 'rgba(99, 102, 241, 0.35)',
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  dispatchingProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 4,
  },
  dispatchingProgressTitle: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.accent.primary,
    letterSpacing: 0.5,
  },
  dispatchingProgressDesc: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
});
