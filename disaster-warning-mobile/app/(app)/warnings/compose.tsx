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
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { Input } from '@/components/Input';
import { FormError } from '@/components/FormError';
import { MobileNavBar } from '@/components/MobileNavBar';
import { FormModal } from '@/components/FormModal';
import { OfficerColors as Colors } from '@/components/OfficerUi';
import { SRI_LANKAN_DISTRICTS } from '@/constants/districts';
import { SRI_LANKA_RIVER_BASINS } from '@/constants/riverBasins';
import { getHazardEvent } from '@/services/hazardEventService';
import { resolveRecipients } from '@/services/recipientService';
import { executeWarningDispatchPipeline, getWarningById } from '@/services/warningService';
import type { HazardEvent, HazardType } from '@/types/resources';
import type {
  WarningSeverity,
  TargetMode,
  DeliveryChannel,
  CreateWarningPayload,
  HazardWarning,
} from '@/types/warning';

const AVAILABLE_CHANNELS: {
  id: DeliveryChannel;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  desc: string;
}[] = [
  {
    id: 'push',
    label: 'App notification',
    icon: 'notifications',
    desc: 'Instant mobile app alert',
  },
  {
    id: 'sms',
    label: 'SMS message',
    icon: 'chatbox-ellipses',
    desc: 'Direct cellular text message',
  },
  {
    id: 'audible',
    label: 'Emergency siren',
    icon: 'volume-high',
    desc: 'Audible alert for affected communities',
  },
];

export default function WarningComposerScreen() {
  const { eventId, escalateWarningId } = useLocalSearchParams<{
    eventId?: string;
    escalateWarningId?: string;
  }>();
  const router = useRouter();
  const { state } = useAuth();
  const user = state.user;

  const isDmcOfficer = user?.role === 'dmc_officer';

  // Selected Hazard Event & Prior Warning State
  const [event, setEvent] = useState<HazardEvent | null>(null);
  const [escalatedWarning, setEscalatedWarning] = useState<HazardWarning | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [eventError, setEventError] = useState<string | null>(null);

  // Warning Composer Form State
  const [hazardType, setHazardType] = useState<HazardType>('flood');
  const [severity, setSeverity] = useState<WarningSeverity | ''>('warning');
  const [targetMode, setTargetMode] = useState<TargetMode>('district');
  const [targetAreas, setTargetAreas] = useState<string[]>([]);
  const [headline, setHeadline] = useState('');
  const [instructions, setInstructions] = useState('');
  const [deliveryChannels, setDeliveryChannels] = useState<DeliveryChannel[]>([
    'push',
    'sms',
    'audible',
  ]);
  const [showAreas, setShowAreas] = useState(false);
  const [areaSearch, setAreaSearch] = useState('');
  const [recipientError, setRecipientError] = useState('');

  // Recipient Resolution State
  const [resolvedDistricts, setResolvedDistricts] = useState<string[]>([]);
  const [recipientCount, setRecipientCount] = useState<number>(0);
  const [resolvingRecipients, setResolvingRecipients] = useState(false);

  // Validation & Payload Modal State
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const fieldMessages = [
    'Warning Headline is required.',
    'Instruction Text is required.',
    'At least one target area must be selected.',
    'At least one Delivery Channel (Push, SMS, or Audible) must be selected.',
  ];
  const generalErrors = validationErrors.filter(message => !fieldMessages.includes(message));
  const [preparedPayload, setPreparedPayload] = useState<CreateWarningPayload | null>(null);
  const [showPayloadModal, setShowPayloadModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch Event & Prior Warning from Cloud Firestore by ID
  const fetchEvent = useCallback(async () => {
    if (!eventId && !escalateWarningId) {
      setLoadingEvent(false);
      setEventError('No hazard event or prior warning specified.');
      return;
    }

    setLoadingEvent(true);
    setEventError(null);

    try {
      let fetchedEvent: HazardEvent | null = null;
      let fetchedWarning: HazardWarning | null = null;

      if (escalateWarningId) {
        fetchedWarning = await getWarningById(escalateWarningId);
        if (fetchedWarning) {
          setEscalatedWarning(fetchedWarning);
        }
      }

      const targetEventId = eventId || fetchedWarning?.eventId;
      if (targetEventId) {
        fetchedEvent = await getHazardEvent(targetEventId);
        if (fetchedEvent) {
          setEvent(fetchedEvent);
          setHazardType(fetchedEvent.hazardType);
          if (fetchedEvent.status !== 'active')
            setEventError(
              'This event is closed. Reopen it from Manage hazard events before issuing another warning.'
            );
        }
      }

      if (fetchedWarning) {
        // Warning Escalation Mode: prefill parameters and raise severity
        setHazardType(fetchedWarning.hazardType);
        setTargetMode(fetchedWarning.targetMode);
        setTargetAreas(fetchedWarning.targetAreas);

        // Elevate severity: advisory -> warning; warning -> evacuation; evacuation remains evacuation
        let elevatedSeverity: WarningSeverity = 'evacuation';
        if (fetchedWarning.severity === 'advisory') {
          elevatedSeverity = 'warning';
        } else if (fetchedWarning.severity === 'warning') {
          elevatedSeverity = 'evacuation';
        }
        setSeverity(elevatedSeverity);

        if (fetchedWarning.deliveryChannels && fetchedWarning.deliveryChannels.length > 0) {
          setDeliveryChannels(fetchedWarning.deliveryChannels);
        }

        const baseHeadline = fetchedWarning.headline.replace(
          /^(?:ESCALATED ALERT:\s*|EMERGENCY ALERT:\s*)+/i,
          ''
        );
        setHeadline(baseHeadline);
        setInstructions(fetchedWarning.instructions || '');
      } else if (fetchedEvent) {
        // Normal compose mode: pre-fill target areas from event if available
        if (fetchedEvent.affectedDistricts && fetchedEvent.affectedDistricts.length > 0) {
          setTargetAreas(fetchedEvent.affectedDistricts);
          setTargetMode('district');
        } else if (
          fetchedEvent.affectedRiverBasins &&
          fetchedEvent.affectedRiverBasins.length > 0
        ) {
          setTargetAreas(fetchedEvent.affectedRiverBasins);
          setTargetMode('river_basin');
        }

        // Pre-fill smart defaults for headline & instructions
        setHeadline(
          `${fetchedEvent.hazardType.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())} warning`
        );
        setInstructions('');
      } else {
        setEventError('Could not load hazard event or prior warning details from Cloud Firestore.');
      }
    } catch (err) {
      console.error('Error fetching hazard event for composer:', err);
      setEventError('Failed to load hazard event from Cloud Firestore.');
    } finally {
      setLoadingEvent(false);
    }
  }, [eventId, escalateWarningId]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  // Recipient Resolution Effect: Triggered when targetMode or targetAreas change
  useEffect(() => {
    let isCurrent = true;
    setRecipientError('');
    if (targetAreas.length === 0) {
      setResolvedDistricts([]);
      setRecipientCount(0);
      setResolvingRecipients(false);
      return;
    }

    setResolvingRecipients(true);
    setRecipientCount(0);
    resolveRecipients(targetMode, targetAreas)
      .then(res => {
        if (isCurrent) {
          setResolvedDistricts(res.resolvedDistricts);
          setRecipientCount(res.recipientCount);
          setResolvingRecipients(false);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setRecipientError('Could not check recipients. Try selecting the areas again.');
          setRecipientCount(0);
          setResolvingRecipients(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [targetMode, targetAreas]);

  // Handle Target Mode Toggle
  const handleTargetModeChange = (mode: TargetMode) => {
    if (mode === targetMode) return;
    setTargetMode(mode);
    if (!event) {
      setTargetAreas([]);
      return;
    }
    if (mode === 'district') {
      setTargetAreas(event.affectedDistricts);
    } else {
      setTargetAreas(
        event.affectedRiverBasins && event.affectedRiverBasins.length > 0
          ? event.affectedRiverBasins
          : []
      );
    }
  };

  // Toggle Target Area Selection
  const toggleTargetArea = (area: string) => {
    if (targetAreas.includes(area)) {
      setTargetAreas(targetAreas.filter(a => a !== area));
    } else {
      setTargetAreas([...targetAreas, area]);
    }
  };

  // Toggle Delivery Channel Selection
  const toggleDeliveryChannel = (channel: DeliveryChannel) => {
    if (deliveryChannels.includes(channel)) {
      setDeliveryChannels(deliveryChannels.filter(c => c !== channel));
    } else {
      setDeliveryChannels([...deliveryChannels, channel]);
    }
  };

  // Form Validation & Firestore Warning Document Creation
  const handleDispatch = async (confirmed = false) => {
    if (!isDmcOfficer) return;
    if (submitting) return; // Prevent accidental double clicks during active dispatch
    setValidationErrors([]);
    const errors: string[] = [];

    if (resolvingRecipients) errors.push('Wait until recipient checking finishes.');
    if (recipientError)
      errors.push('Could not check recipients. Select the affected areas again to retry.');
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

    const eventToCheck = event?.id || eventId || escalatedWarning?.eventId;
    if (!eventToCheck || event?.status === 'closed') {
      setValidationErrors(['Select an active hazard event before issuing a warning.']);
      return;
    }

    if (!confirmed) {
      setPreparedPayload({
        hazardEventTitle: event?.title || escalatedWarning?.hazardEventTitle || 'Hazard event',
        eventId: event?.id || eventId || escalatedWarning?.eventId || '',
        hazardType,
        severity: severity as WarningSeverity,
        targetMode,
        targetAreas: [...targetAreas],
        resolvedDistricts: [...resolvedDistricts],
        recipientCount,
        headline: headline.trim(),
        instructions: instructions.trim(),
        channels: [...deliveryChannels],
        deliveryChannels: [...deliveryChannels],
      });
      setShowPayloadModal(true);
      return;
    }
    setSubmitting(true);

    try {
      const currentEvent = await getHazardEvent(eventToCheck);
      if (!currentEvent || currentEvent.status !== 'active')
        throw new Error(
          'This hazard event has been closed. Return to events and select an active event.'
        );
      const payload: CreateWarningPayload = {
        eventId: event?.id || eventId || escalatedWarning?.eventId || '',
        hazardEventId: event?.id || eventId || escalatedWarning?.eventId || '',
        hazardEventTitle: event?.title || escalatedWarning?.hazardEventTitle || 'Open Hazard Event',
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
        previousWarningId: escalateWarningId || undefined,
      };

      const result = await executeWarningDispatchPipeline(
        payload,
        user?.id || user?.email || 'dmc-officer',
        user?.fullName || 'DMC Duty Officer'
      );

      setPreparedPayload(payload);

      setShowPayloadModal(false);
      // Navigate to UC01 Delivery Summary screen
      router.push({
        pathname: '/(app)/warnings/summary',
        params: { warningId: result.warningId, eventId: payload.eventId },
      } as never);
    } catch (err: unknown) {
      const errorMsg =
        (err as Error).message || 'Failed to create warning document in Cloud Firestore.';
      setValidationErrors([errorMsg]);
    } finally {
      setSubmitting(false);
    }
  };

  // List of Available Areas based on Target Mode
  const availableAreaOptions =
    targetMode === 'district' ? SRI_LANKAN_DISTRICTS : Object.keys(SRI_LANKA_RIVER_BASINS);

  const severityChoices: {
    value: WarningSeverity;
    label: string;
    detail: string;
    color: string;
  }[] = [
    {
      value: 'advisory',
      label: 'Advisory',
      detail: 'Stay informed and take precautions.',
      color: '#946000',
    },
    {
      value: 'warning',
      label: 'Warning',
      detail: 'Prepare to act. Conditions may become dangerous.',
      color: '#B45C00',
    },
    {
      value: 'evacuation',
      label: 'Evacuation order',
      detail: 'People in the affected areas must leave safely.',
      color: '#D92D3A',
    },
  ];
  const currentSeverity = severityChoices.find(option => option.value === severity);
  const updatingEvacuation = escalatedWarning?.severity === 'evacuation';
  return (
    <ScreenContainer style={officerScreenStyle} contentStyle={officerShellStyle}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <OfficerHero
          title={escalatedWarning ? 'Update a warning' : 'Issue a warning'}
          description="Set the audience, write clear instructions and review before sending."
          caption="DMC Officer"
          icon="notifications-outline"
          onBack={() => router.back()}
        />
        {loadingEvent ? (
          <Card>
            <ActivityIndicator color={Colors.accent.primary} />
            <Text style={styles.helper}>Loading event details...</Text>
          </Card>
        ) : eventError && ((!event && !escalatedWarning) || event?.status === 'closed') ? (
          <Card>
            <Text style={styles.error}>{eventError}</Text>
            <Button title="Back to events" onPress={() => router.back()} />
          </Card>
        ) : !isDmcOfficer ? (
          <Card>
            <Text style={styles.title}>Officer access required</Text>
            <Text style={styles.helper}>Only DMC officers can issue or update warnings.</Text>
            <Button title="Back to warnings" onPress={() => router.back()} />
          </Card>
        ) : (
          <>
            <Card style={styles.context}>
              <Text style={styles.caption}>Related hazard event</Text>
              <Text style={styles.title}>{event?.title || escalatedWarning?.hazardEventTitle}</Text>
              <View style={styles.row}>
                <Ionicons name="warning-outline" size={18} color={Colors.accent.primary} />
                <Text style={styles.body}>
                  {hazardType.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())}
                </Text>
              </View>
              {escalatedWarning && (
                <Text style={styles.helper}>
                  {updatingEvacuation
                    ? 'This is already an evacuation order, the highest alert level. Update the message or affected areas as needed.'
                    : `Previous alert: ${severityChoices.find(option => option.value === escalatedWarning.severity)?.label}. Review the proposed severity and update the message.`}
                </Text>
              )}
            </Card>
            {generalErrors.length > 0 && (
              <Card>
                <Text style={styles.title}>Check these details</Text>
                {generalErrors.map(error => (
                  <Text key={error} accessibilityRole="alert" style={styles.error}>
                    {error}
                  </Text>
                ))}
              </Card>
            )}
            <Card style={styles.section}>
              <Text style={styles.title}>1. Severity and audience</Text>
              <Text style={styles.helper}>Choose the action people should take.</Text>
              <View style={styles.stack}>
                {severityChoices.map(option => (
                  <TouchableOpacity
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityLabel={option.label}
                    accessibilityState={{ checked: severity === option.value }}
                    onPress={() => setSeverity(option.value)}
                    style={[
                      styles.option,
                      severity === option.value && {
                        borderColor: option.color,
                        backgroundColor: '#F4F8FD',
                      },
                    ]}
                  >
                    <Ionicons
                      name={severity === option.value ? 'radio-button-on' : 'radio-button-off'}
                      size={22}
                      color={option.color}
                    />
                    <View style={styles.flex}>
                      <Text style={styles.label}>{option.label}</Text>
                      <Text style={styles.caption}>{option.detail}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>Choose areas by</Text>
              <View style={styles.row}>
                {(['district', 'river_basin'] as const).map(mode => (
                  <TouchableOpacity
                    key={mode}
                    accessibilityRole="radio"
                    accessibilityLabel={mode === 'district' ? 'District' : 'River basin'}
                    accessibilityState={{ checked: targetMode === mode }}
                    onPress={() => handleTargetModeChange(mode)}
                    style={[styles.mode, targetMode === mode && styles.selected]}
                  >
                    <Text style={[styles.label, targetMode === mode && styles.blue]}>
                      {mode === 'district' ? 'District' : 'River basin'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.areaBox}>
                <Text style={styles.label}>
                  Affected {targetMode === 'district' ? 'districts' : 'river basins'} (
                  {targetAreas.length})
                </Text>
                <Text style={styles.body}>
                  {targetAreas.length ? targetAreas.join(', ') : 'No areas selected'}
                </Text>
                <Button
                  title="Choose affected areas"
                  variant="secondary"
                  onPress={() => {
                    setAreaSearch('');
                    setShowAreas(true);
                  }}
                />
              </View>
              <FormError
                message={
                  !targetAreas.length
                    ? validationErrors.find(message => message === fieldMessages[2])
                    : undefined
                }
              />
              <View style={styles.recipients}>
                <Ionicons name="people-outline" size={23} color={Colors.accent.primary} />
                <View style={styles.flex}>
                  <Text style={styles.label}>
                    {resolvingRecipients
                      ? 'Checking recipients...'
                      : `${recipientCount} registered ${recipientCount === 1 ? 'recipient' : 'recipients'}`}
                  </Text>
                  <Text style={styles.caption}>
                    {recipientError || 'Based on the selected areas. Each person is counted once.'}
                  </Text>
                </View>
              </View>
            </Card>
            <Card style={styles.section}>
              <Text style={styles.title}>2. Message to the public</Text>
              <Text style={styles.helper}>State the risk and tell people what to do next.</Text>
              <Input
                appearance="light"
                label="Warning headline *"
                error={
                  !headline.trim()
                    ? validationErrors.find(message => message === fieldMessages[0])
                    : undefined
                }
                accessibilityLabel="Warning headline"
                value={headline}
                onChangeText={setHeadline}
                multiline
                scrollEnabled={false}
                placeholder="For example: Flood warning for Ratnapura"
                inputStyle={{ minHeight: 64, textAlignVertical: 'top' }}
              />
              <Input
                appearance="light"
                label="Safety instructions *"
                error={
                  !instructions.trim()
                    ? validationErrors.find(message => message === fieldMessages[1])
                    : undefined
                }
                accessibilityLabel="Safety instructions"
                value={instructions}
                onChangeText={setInstructions}
                multiline
                scrollEnabled={false}
                placeholder="Describe the affected places, safe action and where to get help."
                inputStyle={{ minHeight: 140, textAlignVertical: 'top' }}
              />
            </Card>
            <Card style={styles.section}>
              <Text style={styles.title}>3. How to send it</Text>
              <FormError
                message={
                  !deliveryChannels.length
                    ? validationErrors.find(message => message === fieldMessages[3])
                    : undefined
                }
              />
              <Text style={styles.helper}>Select at least one delivery channel.</Text>
              <Text style={styles.helper}>
                Demo delivery: channel results are simulated. No real push notifications, SMS
                messages or emergency sirens are sent. Issued warnings appear in the app.
              </Text>
              <View style={styles.stack}>
                {AVAILABLE_CHANNELS.map(channel => (
                  <TouchableOpacity
                    key={channel.id}
                    accessibilityRole="checkbox"
                    accessibilityLabel={channel.label}
                    aria-checked={deliveryChannels.includes(channel.id)}
                    accessibilityState={{ checked: deliveryChannels.includes(channel.id) }}
                    onPress={() => toggleDeliveryChannel(channel.id)}
                    style={[
                      styles.option,
                      deliveryChannels.includes(channel.id) && styles.selected,
                    ]}
                  >
                    <Ionicons name={channel.icon} size={24} color={Colors.accent.primary} />
                    <View style={styles.flex}>
                      <Text style={styles.label}>{channel.label}</Text>
                      <Text style={styles.caption}>{channel.desc}</Text>
                    </View>
                    <Ionicons
                      name={deliveryChannels.includes(channel.id) ? 'checkbox' : 'square-outline'}
                      size={23}
                      color={Colors.accent.primary}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </Card>
            <Text style={styles.helper}>
              You can check all details on the next screen before sending.
            </Text>
            <Button
              title="Review warning"
              onPress={() => {
                void handleDispatch();
              }}
              disabled={resolvingRecipients || submitting}
            />
          </>
        )}
      </ScrollView>
      <FormModal
        appearance="light"
        visible={showAreas}
        title="Choose affected areas"
        onClose={() => setShowAreas(false)}
      >
        <Input
          appearance="light"
          label="Search areas"
          placeholder="Search a district or river basin"
          value={areaSearch}
          onChangeText={setAreaSearch}
        />
        <Text style={styles.helper}>
          {targetAreas.length} selected. Tap an area to select or remove it.
        </Text>
        <View style={styles.stack}>
          {availableAreaOptions
            .filter(area => area.toLowerCase().includes(areaSearch.toLowerCase()))
            .map(area => (
              <TouchableOpacity
                key={area}
                accessibilityRole="checkbox"
                accessibilityLabel={area}
                accessibilityState={{ checked: targetAreas.includes(area) }}
                onPress={() => toggleTargetArea(area)}
                style={[styles.option, targetAreas.includes(area) && styles.selected]}
              >
                <Text style={[styles.label, styles.flex]}>{area}</Text>
                <Ionicons
                  name={targetAreas.includes(area) ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={Colors.accent.primary}
                />
              </TouchableOpacity>
            ))}
        </View>
        {!availableAreaOptions.some(area =>
          area.toLowerCase().includes(areaSearch.toLowerCase())
        ) && <Text style={styles.helper}>No matching areas. Try a different name.</Text>}
        <Button
          title={`Done (${targetAreas.length} selected)`}
          onPress={() => setShowAreas(false)}
          style={{ marginTop: 16 }}
        />
      </FormModal>
      <FormModal
        appearance="light"
        visible={showPayloadModal}
        title="Review warning"
        onClose={() => {
          if (!submitting) setShowPayloadModal(false);
        }}
      >
        <Text style={styles.title}>{preparedPayload?.headline}</Text>
        <Text style={[styles.label, { color: currentSeverity?.color, marginTop: 12 }]}>
          {currentSeverity?.label}
        </Text>
        <View style={styles.reviewBlock}>
          <Text style={styles.label}>Affected areas</Text>
          <Text style={styles.body}>{preparedPayload?.targetAreas.join(', ')}</Text>
          <Text style={styles.caption}>
            {preparedPayload?.recipientCount} registered recipients
          </Text>
        </View>
        <View style={styles.reviewBlock}>
          <Text style={styles.label}>Safety instructions</Text>
          <Text style={styles.body}>{preparedPayload?.instructions}</Text>
        </View>
        <View style={styles.reviewBlock}>
          <Text style={styles.label}>Delivery channels</Text>
          <Text style={styles.body}>
            {preparedPayload?.channels
              .map(id => AVAILABLE_CHANNELS.find(channel => channel.id === id)?.label)
              .join(', ')}
          </Text>
        </View>
        {validationErrors.map(error => (
          <Text key={error} accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ))}
        <Text style={styles.helper}>
          Sending will issue this official warning to the selected audience.
        </Text>
        <Button
          title={submitting ? 'Sending warning...' : 'Send warning'}
          loading={submitting}
          onPress={() => {
            void handleDispatch(true);
          }}
        />
        <Button
          title="Back to editing"
          variant="secondary"
          disabled={submitting}
          onPress={() => setShowPayloadModal(false)}
          style={{ marginTop: 10 }}
        />
      </FormModal>
      <MobileNavBar appearance="light" />
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 110 },
  context: { marginBottom: 16 },
  section: { marginBottom: 16 },
  title: { fontSize: 18, lineHeight: 26, fontWeight: '700', color: Colors.text.primary },
  label: { fontSize: 16, lineHeight: 24, fontWeight: '600', color: Colors.text.primary },
  body: { fontSize: 16, lineHeight: 24, color: Colors.text.primary },
  caption: { fontSize: 14, lineHeight: 20, color: Colors.text.secondary },
  helper: { fontSize: 14, lineHeight: 21, color: Colors.text.secondary, marginVertical: 12 },
  error: { fontSize: 14, lineHeight: 22, color: Colors.danger, marginVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 },
  flex: { flex: 1, minWidth: 0 },
  stack: { gap: 10, marginBottom: 16 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    padding: 12,
    borderWidth: 1.5,
    borderColor: Colors.border.default,
    borderRadius: 14,
    backgroundColor: '#F8FAFD',
  },
  selected: { backgroundColor: '#EAF2FF', borderColor: Colors.accent.primary },
  blue: { color: Colors.accent.primary },
  mode: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.default,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  areaBox: {
    gap: 12,
    padding: 14,
    backgroundColor: '#F8FAFD',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  recipients: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  reviewBlock: {
    gap: 8,
    marginTop: 18,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
  },
});
